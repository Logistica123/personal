<?php

namespace App\Services\Liq;

use App\Models\LiqLiquidacionCliente;
use App\Models\LiqOperacion;
use Illuminate\Support\Facades\DB;

/**
 * SPEC v3 · BUG B — Detección de subpago OCASA (reclamos a cliente).
 *
 * OCASA a veces paga a LA menos que lo acordado contractualmente. Este servicio detecta
 * esas diferencias comparando CostoFijo_TMS contra liq_tarifas_contrato_cliente y las
 * flaguea en liq_reclamos_ocasa para que Liquidaciones emita nota de débito.
 *
 * Algoritmo por operación:
 *   1. Derivar 'concepto' de la op (hasta_120 / 121_240 / mas_240 / 2da_3ra_vuelta /
 *      motos / jornada_{N} / etc.) a partir de distancia_km, capacidad_vehiculo_kg,
 *      idtrack_tms y denominacion de ruta.
 *   2. Buscar tarifa_contrato(cliente, sucursal, capacidad, concepto, vigencia).
 *   3. Comparar CostoFijo_TMS vs tarifa_contrato × (1 − tolerancia).
 *   4. Si CostoFijo_TMS < umbral → registrar subpago en liq_reclamos_ocasa.
 *   5. Si CostoFijo_TMS > tarifa × (1 + tolerancia) → sobrepago (registra igual para alertar).
 *
 * Es idempotente: al re-correr, borra los reclamos previos de esa liquidación + fecha
 * de corrida y los recrea. Así se pueden ajustar tolerancias y re-detectar sin duplicar.
 */
class LiqDeteccionSubpagoService
{
    /**
     * Tolerancia por defecto (5%). Una op con CostoFijo_TMS dentro de ±5% de la tarifa
     * contrato se considera "OK, sin reclamo". Ajustable por parámetro al correr.
     */
    private const TOLERANCIA_DEFAULT = 0.05;

    /**
     * Detecta subpagos OCASA en una liquidación cliente y los registra en liq_reclamos_ocasa.
     *
     * @return array{
     *   ops_analizadas: int,
     *   reclamos_creados: int,
     *   total_subpago: float,
     *   total_sobrepago: float,
     *   sin_tarifa_contrato: int,
     *   por_sucursal: array,
     * }
     */
    public function detectar(LiqLiquidacionCliente $liqCliente, float $tolerancia = self::TOLERANCIA_DEFAULT): array
    {
        $clienteId = (int) $liqCliente->cliente_id;

        // Limpiar reclamos previos de esta liquidación (idempotencia)
        DB::table('liq_reclamos_ocasa')
            ->whereIn('op_id',
                LiqOperacion::where('liquidacion_cliente_id', $liqCliente->id)->pluck('id')
            )
            ->delete();

        $fecha = $liqCliente->periodo_desde?->toDateString() ?? now()->toDateString();

        $todasOps = LiqOperacion::where('liquidacion_cliente_id', $liqCliente->id)
            ->where('excluida', false)
            ->whereIn('estado', ['ok', 'diferencia', 'pendiente', 'sin_tarifa'])
            ->get();

        // SPEC v4.2: separar por modo de pago. Las productividad se chequean parada-por-parada
        // contra liq_tarifas_ocasa_la; las jornada contra liq_tarifas_contrato_cliente (lógica vieja).
        $opsJornada = $todasOps->filter(fn ($op) => ($op->modelo_calculo ?? '') !== 'PRODUCTIVIDAD');
        $opsProductividad = $todasOps->filter(fn ($op) => ($op->modelo_calculo ?? '') === 'PRODUCTIVIDAD');

        $ops = $opsJornada;

        $stats = [
            'ops_analizadas'      => $todasOps->count(),
            'reclamos_creados'    => 0,
            'total_subpago'       => 0.0,
            'total_sobrepago'     => 0.0,
            'sin_tarifa_contrato' => 0,
            'por_sucursal'        => [],
        ];

        foreach ($ops as $op) {
            $sucursal = trim((string) ($op->sucursal_tarifa ?? ''));
            $capacidad = (int) ($op->capacidad_vehiculo_kg ?? 0);
            if ($sucursal === '' || $capacidad === 0) continue;

            $concepto = $this->derivarConcepto($op);
            if ($concepto === null) continue;

            // Buscar tarifa contrato vigente
            $tarifa = DB::table('liq_tarifas_contrato_cliente')
                ->where('cliente_id', $clienteId)
                ->where('sucursal', $this->normalizarSucursal($sucursal))
                ->where('capacidad_vehiculo', $capacidad)
                ->where('concepto', $concepto)
                ->where('vigencia_desde', '<=', $fecha)
                ->where(function ($q) use ($fecha) {
                    $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $fecha);
                })
                ->orderByDesc('vigencia_desde')
                ->first();

            if (!$tarifa) {
                $stats['sin_tarifa_contrato']++;
                continue;
            }

            $importeTms      = (float) ($op->costo_fijo ?? 0);
            $importeEsperado = (float) $tarifa->importe_contrato;
            $diferencia      = round($importeEsperado - $importeTms, 2);
            $umbralSubpago   = $importeEsperado * (1 - $tolerancia);
            $umbralSobrepago = $importeEsperado * (1 + $tolerancia);

            $tipo = null;
            $motivo = null;
            if ($importeTms < $umbralSubpago) {
                $tipo = 'subpago';
                $motivo = sprintf(
                    'TMS=%s < tarifa_contrato=%s × (1−%.0f%%) = %s · diff=%s',
                    number_format($importeTms, 2), number_format($importeEsperado, 2),
                    $tolerancia * 100, number_format($umbralSubpago, 2),
                    number_format($diferencia, 2)
                );
                $stats['total_subpago'] += abs($diferencia);
            } elseif ($importeTms > $umbralSobrepago) {
                $tipo = 'sobrepago';
                $motivo = sprintf(
                    'TMS=%s > tarifa_contrato=%s × (1+%.0f%%) = %s · diff=%s',
                    number_format($importeTms, 2), number_format($importeEsperado, 2),
                    $tolerancia * 100, number_format($umbralSobrepago, 2),
                    number_format(abs($diferencia), 2)
                );
                $stats['total_sobrepago'] += abs($diferencia);
            }

            if ($tipo === null) continue;

            // SPEC v4.3 · Clasificar motivo del subpago para reclamos efectivos
            $clasif = $this->clasificarMotivoJornada(
                $op, $tarifa, $importeTms, $importeEsperado, $diferencia, $clienteId, $fecha
            );

            DB::table('liq_reclamos_ocasa')->insert([
                'op_id'              => $op->id,
                'tarifa_contrato_id' => $tarifa->id,
                'importe_tms'        => $importeTms,
                'importe_esperado'   => $importeEsperado,
                'diferencia'         => $diferencia,
                'estado'             => 'pendiente_reclamo',
                'motivo_detectado'   => "[{$tipo}] " . $clasif['descripcion'],
                'motivo_categoria'   => $clasif['categoria'],
                'creado_at'          => now(),
            ]);

            $stats['reclamos_creados']++;
            $key = $sucursal;
            if (!isset($stats['por_sucursal'][$key])) {
                $stats['por_sucursal'][$key] = ['ops' => 0, 'diferencia' => 0.0];
            }
            $stats['por_sucursal'][$key]['ops']++;
            $stats['por_sucursal'][$key]['diferencia'] += abs($diferencia);
        }

        // SPEC v4.2: detección parada-por-parada para ops productividad
        $reclamosProd = $this->detectarSubpagoProductividad($opsProductividad, $clienteId, $fecha, $tolerancia);
        $stats['reclamos_productividad']      = $reclamosProd['count'];
        $stats['total_subpago_productividad'] = $reclamosProd['total_subpago'];
        $stats['paradas_sin_tarifa_ocasa_la'] = $reclamosProd['sin_tarifa'];
        $stats['reclamos_creados']           += $reclamosProd['count'];
        $stats['total_subpago']              += $reclamosProd['total_subpago'];

        return $stats;
    }

    /**
     * SPEC v4.2: detecta subpagos OCASA → LA en ops productividad comparando cada grupo
     * de paradas YCC contra liq_tarifas_ocasa_la. Si YCC.costo del grupo < esperado
     * × (1 - tolerancia) → reclamo por parada.
     *
     * @return array{count:int, total_subpago:float, sin_tarifa:int}
     */
    private function detectarSubpagoProductividad($ops, int $clienteId, string $fecha, float $tolerancia): array
    {
        $resolver = app(\App\Services\Liq\ResolverTarifaOcasaLa::class);

        $mapeoMaterial = DB::table('liq_material_mapeo')
            ->where('cliente_id', $clienteId)
            ->pluck('material_tarifario', 'codigo_ycc')
            ->toArray();

        $count = 0;
        $totalSubpago = 0.0;
        $sinTarifa = 0;

        foreach ($ops as $op) {
            $paradas = DB::table('liq_operaciones_detalle')
                ->where('operacion_id', $op->id)
                ->orderBy('parada')
                ->get();

            // Agrupar por (parada × material × motivo)
            $grupos = [];
            foreach ($paradas as $p) {
                $matYcc = trim((string) ($p->material_ycc ?? ''));
                $matLa  = $mapeoMaterial[$matYcc] ?? 'DESCONOCIDO';
                $motivo = trim((string) ($p->motivo ?? ''));
                $zona   = trim((string) ($p->cod_regio ?? ''));
                $key    = ((int) $p->parada) . '|' . $matLa . '|' . $motivo;

                if (!isset($grupos[$key])) {
                    $grupos[$key] = [
                        'parada_num'  => (int) $p->parada,
                        'material_la' => $matLa,
                        'zona'        => $zona,
                        'motivo'      => $motivo,
                        'distrito'    => $p->distrito ?? null,
                        'bultos'      => 0,
                        'costo_orig'  => 0.0,
                    ];
                }
                $grupos[$key]['bultos']     += (int) ($p->bultos ?? 0);
                $grupos[$key]['costo_orig'] += (float) ($p->costo ?? 0);
            }

            foreach ($grupos as $g) {
                $contexto = [
                    'distrito'    => $g['distrito'],
                    'material_la' => $g['material_la'],
                    'zona'        => $g['zona'],
                    'motivo'      => $g['motivo'],
                ];
                $tarifa = $resolver->resolver($op, $fecha, $contexto);
                if (!$tarifa) {
                    $sinTarifa++;
                    continue;
                }

                $esperado = round($resolver->calcular($g['bultos'], $tarifa), 2);
                if ($esperado <= 0) continue;
                $real = round($g['costo_orig'], 2);
                $diff = round($esperado - $real, 2);
                $umbralSubpago = $esperado * (1 - $tolerancia);

                if ($real >= $umbralSubpago) continue;

                $clasif = $this->clasificarMotivoProductividad($op, $g, $tarifa, $real, $esperado, $diff);

                DB::table('liq_reclamos_ocasa')->insert([
                    'op_id'              => $op->id,
                    'parada_num'         => $g['parada_num'],
                    'tarifa_esperada'    => $esperado,
                    'pagado_ocasa'       => $real,
                    'tarifa_contrato_id' => null,
                    'importe_tms'        => $real,
                    'importe_esperado'   => $esperado,
                    'diferencia'         => $diff,
                    'estado'             => 'pendiente_reclamo',
                    'motivo_detectado'   => '[subpago_prod] ' . $clasif['descripcion'],
                    'motivo_categoria'   => $clasif['categoria'],
                    'detalle'            => json_encode([
                        'parada_num'  => $g['parada_num'],
                        'material_la' => $g['material_la'],
                        'zona'        => $g['zona'],
                        'motivo'      => $g['motivo'],
                        'bultos'      => $g['bultos'],
                        'tarifa_id'   => $tarifa->id,
                        'tipo_tarifa' => $tarifa->tipo_tarifa,
                    ], JSON_UNESCAPED_UNICODE),
                    'creado_at'          => now(),
                ]);

                $count++;
                $totalSubpago += abs($diff);
            }
        }

        return ['count' => $count, 'total_subpago' => $totalSubpago, 'sin_tarifa' => $sinTarifa];
    }

    /**
     * SPEC v3 · Derivador de concepto (pregunta 5 de RESPUESTAS_5_Preguntas).
     *
     * Prioridad:
     *   1. idtrack_tms in {2,3} → '2da_3ra_vuelta'
     *   2. Moto (capacidad ≤ 150 O ruta contiene 'moto') → 'motos'
     *   3. Capacidad ≥ 1500 → 'jornada_{cap}'
     *   4. Capacidad < 1500 → por distancia: hasta_120 / 121_240 / mas_240
     *
     * Notas:
     *   - mas_240 implica un recargo adicional 'valor_km_240' por km sobre 240, que se
     *     suma APARTE (no es un concepto distinto, es recargo). Este método solo devuelve
     *     el concepto principal de la op.
     *   - Retorna null si no se puede derivar (datos insuficientes).
     */
    public function derivarConcepto(LiqOperacion $op): ?string
    {
        // 1) idtrack_tms 2 o 3 → 2da/3ra vuelta
        $idtrack = trim((string) ($op->idtrack_tms ?? ''));
        if (in_array($idtrack, ['2', '3'], true)) {
            return '2da_3ra_vuelta';
        }

        $capacidad = (int) ($op->capacidad_vehiculo_kg ?? 0);

        // 2) Moto: capacidad muy baja O denominación contiene 'moto'
        $denom = $this->getDenominacion($op);
        if ($capacidad > 0 && $capacidad <= 150) return 'motos';
        if (stripos($denom, 'moto') !== false) return 'motos';

        // 3) Capacidad ≥ 1500 → jornada por tonelaje
        if ($capacidad >= 1500) {
            return 'jornada_' . $capacidad;
        }

        // 4) Capacidad < 1500 (típicamente 700) → por distancia
        if ($capacidad === 0) return null;
        $distancia = (float) ($op->distancia_km ?? 0);
        if ($distancia <= 120) return 'hasta_120';
        if ($distancia <= 240) return '121_240';
        return 'mas_240';
    }

    /**
     * Extrae denominación de ruta desde campos_originales (fallback para el rule 'moto').
     */
    private function getDenominacion(LiqOperacion $op): string
    {
        $campos = $op->campos_originales;
        if (is_string($campos)) $campos = json_decode($campos, true) ?: [];
        if (!is_array($campos)) return '';
        foreach (['Denominación Ruta', 'Denominacion Ruta', 'denominacion_ruta', 'denominacion'] as $k) {
            if (!empty($campos[$k])) return (string) $campos[$k];
        }
        return '';
    }

    /**
     * Normaliza el nombre de la sucursal para match contra liq_tarifas_contrato_cliente.
     * Las tarifas contrato están en MAYÚSCULAS (AZUL, POSADAS, etc.). Las ops guardan la
     * sucursal como viene del PDF parent (ej "Posadas", "RESISTENCIA", etc.).
     */
    private function normalizarSucursal(string $s): string
    {
        $s = trim($s);
        $s = strtoupper($s);
        $s = strtr($s, [
            'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U',
            'Ñ' => 'N', 'Ü' => 'U',
        ]);
        // "BAHIA BLANCA" vs "BAHÍA BLANCA" → ambas igualan
        // "LUQ MDZ" viene tal cual
        return $s;
    }

    /**
     * SPEC v4.3 · Clasifica el motivo del subpago/sobrepago de una op JORNADA.
     * Devuelve {categoria, descripcion}: categoría para filtrado UI, descripción
     * para argumentar el reclamo a OCASA.
     *
     * @return array{categoria: string, descripcion: string}
     */
    private function clasificarMotivoJornada(
        LiqOperacion $op,
        $tarifa,
        float $pagado,
        float $esperado,
        float $diferencia,
        int $clienteId,
        string $fecha
    ): array {
        $diffPct = $esperado > 0 ? abs($diferencia) / $esperado : 0;

        // 1. Bajo tolerancia: distinguir factor sistemático (tarifa_desactualizada)
        //    vs ajuste/redondeo aislado (bajo_tolerancia).
        if ($diffPct < 0.05) {
            // Si hay >=3 ops del mismo cliente+sucursal+capacidad+concepto con diferencia
            // proporcional consistente (≥1.5% pero <5%), es OCASA aplicando tarifa anterior.
            $sucursalNorm = $this->normalizarSucursal((string) ($op->sucursal_tarifa ?? ''));
            $opsSistematicas = LiqOperacion::query()
                ->where('liquidacion_cliente_id', $op->liquidacion_cliente_id)
                ->where('sucursal_tarifa', $op->sucursal_tarifa)
                ->where('capacidad_vehiculo_kg', $op->capacidad_vehiculo_kg)
                ->where('costo_fijo', $pagado)  // mismo importe pagado por OCASA
                ->where('excluida', false)
                ->count();
            if ($diffPct >= 0.015 && $opsSistematicas >= 3) {
                $factor = $esperado > 0 ? $pagado / $esperado : 0;
                return [
                    'categoria'   => 'tarifa_desactualizada',
                    'descripcion' => sprintf(
                        'OCASA aplicó tarifa anterior (factor sistemático %.4f). %d ops con mismo importe %s vs nuevo contractual %s · diff/op=%s',
                        $factor, $opsSistematicas,
                        number_format($pagado, 2), number_format($esperado, 2),
                        number_format(abs($diferencia), 2)
                    ),
                ];
            }
            return [
                'categoria'   => 'bajo_tolerancia',
                'descripcion' => sprintf(
                    'Diferencia menor al 5%% (%.2f%%) — probable ajuste/redondeo. Pagado=%s vs esperado=%s',
                    $diffPct * 100, number_format($pagado, 2), number_format($esperado, 2)
                ),
            ];
        }

        // 2. Tarifa de capacidad inferior: existe tarifa de capacidad mayor que matchea mejor
        $sucursalNorm = $this->normalizarSucursal((string) ($op->sucursal_tarifa ?? ''));
        $tarifaCapMayor = DB::table('liq_tarifas_contrato_cliente')
            ->where('cliente_id', $clienteId)
            ->where('sucursal', $sucursalNorm)
            ->where('concepto', $tarifa->concepto)
            ->where('capacidad_vehiculo', '>', (int) ($op->capacidad_vehiculo_kg ?? 0))
            ->where('vigencia_desde', '<=', $fecha)
            ->orderBy('capacidad_vehiculo')
            ->first();

        if ($tarifaCapMayor && abs((float) $tarifaCapMayor->importe_contrato - $pagado) < abs($pagado - $esperado) * 0.5) {
            return [
                'categoria'   => 'tarifa_capacidad_inferior',
                'descripcion' => sprintf(
                    'OCASA pagó tarifa cap=%d (%s) pero la op probablemente debería ser cap=%d (esperado %s · diff=%s)',
                    $op->capacidad_vehiculo_kg, number_format($pagado, 2),
                    $tarifaCapMayor->capacidad_vehiculo, number_format($tarifaCapMayor->importe_contrato, 2),
                    number_format($diferencia, 2)
                ),
            ];
        }

        // 3. Concepto mal clasificado: existe tarifa con concepto distinto que matchea mejor el TMS
        $conceptoCorrecto = $this->derivarConcepto($op);
        if ($conceptoCorrecto !== null && $conceptoCorrecto !== $tarifa->concepto) {
            $tarifaConceptoOK = DB::table('liq_tarifas_contrato_cliente')
                ->where('cliente_id', $clienteId)
                ->where('sucursal', $sucursalNorm)
                ->where('capacidad_vehiculo', (int) ($op->capacidad_vehiculo_kg ?? 0))
                ->where('concepto', $conceptoCorrecto)
                ->where('vigencia_desde', '<=', $fecha)
                ->first();
            if ($tarifaConceptoOK) {
                return [
                    'categoria'   => 'concepto_mal_clasificado',
                    'descripcion' => sprintf(
                        'OCASA aplicó concepto "%s" pero la distancia/idtrack sugiere "%s" (esperado %s · pagado %s · diff=%s)',
                        $tarifa->concepto, $conceptoCorrecto,
                        number_format((float) $tarifaConceptoOK->importe_contrato, 2),
                        number_format($pagado, 2), number_format($diferencia, 2)
                    ),
                ];
            }
        }

        // 4. Default: requiere revisión manual
        return [
            'categoria'   => 'otra',
            'descripcion' => sprintf(
                'Diferencia de %s sin causa identificable automáticamente. Pagado=%s vs esperado=%s — revisar manual',
                number_format($diferencia, 2), number_format($pagado, 2), number_format($esperado, 2)
            ),
        ];
    }

    /**
     * SPEC v4.3 · Clasifica el motivo del subpago de una parada PRODUCTIVIDAD.
     *
     * @param  array  $grupo  grupo de paradas YCC (parada × material × motivo)
     * @return array{categoria: string, descripcion: string}
     */
    private function clasificarMotivoProductividad(
        LiqOperacion $op,
        array $grupo,
        $tarifa,
        float $pagado,
        float $esperado,
        float $diferencia
    ): array {
        $diffPct = $esperado > 0 ? abs($diferencia) / $esperado : 0;

        // Bajo tolerancia
        if ($diffPct < 0.05) {
            return [
                'categoria'   => 'bajo_tolerancia',
                'descripcion' => sprintf(
                    'Parada %d %s/%s/%s · diferencia %.2f%% (probable ajuste). Pagado=%s vs esperado=%s',
                    $grupo['parada_num'], $grupo['material_la'], $grupo['zona'], $grupo['motivo'],
                    $diffPct * 100, number_format($pagado, 2), number_format($esperado, 2)
                ),
            ];
        }

        // Multibulto no aplicado: bultos >= 5 pero pagaron solo 1 tarifa unitaria
        $tarifaUnit = (float) $tarifa->valor;
        if ($grupo['bultos'] >= 5 && $tarifaUnit > 0 && abs($pagado - $tarifaUnit) < $tarifaUnit * 0.10) {
            return [
                'categoria'   => 'multibulto_no_aplicado',
                'descripcion' => sprintf(
                    'Parada %d con %d bultos %s/%s · OCASA pagó solo 1 tarifa unit (%s) en lugar de %d × %s = %s',
                    $grupo['parada_num'], $grupo['bultos'], $grupo['material_la'], $grupo['zona'],
                    number_format($pagado, 2), (int) ceil($grupo['bultos'] / 5),
                    number_format($tarifaUnit, 2), number_format($esperado, 2)
                ),
            ];
        }

        // Material/zona/motivo mal clasificado: el costo OCASA está cerca de tarifa de OTRA
        // combinación cargada en la tabla. Intento detectar la combinación más cercana.
        $clienteId = (int) \DB::table('liq_liquidaciones_cliente')
            ->where('id', $op->liquidacion_cliente_id)
            ->value('cliente_id');
        $tarifasMismaRuta = DB::table('liq_tarifas_ocasa_la')
            ->where('cliente_id', $clienteId)
            ->where('ruta', $op->concepto)
            ->where('vigencia_desde', '<=', $op->liquidacionCliente?->periodo_desde?->toDateString() ?? now()->toDateString())
            ->get();

        $mejorMatch = null;
        $mejorDiff  = PHP_FLOAT_MAX;
        foreach ($tarifasMismaRuta as $t) {
            $tEsperado = $t->aplica_multibulto && $grupo['bultos'] >= 5
                ? (int) ceil($grupo['bultos'] / 5) * (float) $t->valor
                : (float) $t->valor;
            $d = abs($pagado - $tEsperado);
            if ($d < $mejorDiff) {
                $mejorDiff = $d;
                $mejorMatch = $t;
            }
        }

        if ($mejorMatch && $mejorDiff < $esperado * 0.10) {
            // Diferenciamos según qué dimensión cambia
            if ($mejorMatch->material_la !== $grupo['material_la']) {
                return [
                    'categoria'   => 'material_mal_clasificado',
                    'descripcion' => sprintf(
                        'Parada %d · OCASA cobró como %s/%s/%s pero el costo coincide con %s/%s/%s (esperado real=%s vs pagado=%s)',
                        $grupo['parada_num'], $grupo['material_la'], $grupo['zona'], $grupo['motivo'],
                        $mejorMatch->material_la, $mejorMatch->zona, $mejorMatch->motivo,
                        number_format($esperado, 2), number_format($pagado, 2)
                    ),
                ];
            }
            if ($mejorMatch->zona !== $grupo['zona']) {
                return [
                    'categoria'   => 'zona_mal_asignada',
                    'descripcion' => sprintf(
                        'Parada %d %s · OCASA aplicó zona %s pero el costo coincide con zona %s (diff=%s)',
                        $grupo['parada_num'], $grupo['material_la'],
                        $grupo['zona'], $mejorMatch->zona, number_format($diferencia, 2)
                    ),
                ];
            }
            if ($mejorMatch->motivo !== $grupo['motivo']) {
                return [
                    'categoria'   => 'motivo_mal_etiquetado',
                    'descripcion' => sprintf(
                        'Parada %d %s/%s · etiquetada motivo %s pero el costo coincide con motivo %s (diff=%s)',
                        $grupo['parada_num'], $grupo['material_la'], $grupo['zona'],
                        $grupo['motivo'], $mejorMatch->motivo, number_format($diferencia, 2)
                    ),
                ];
            }
        }

        // Default
        return [
            'categoria'   => 'otra',
            'descripcion' => sprintf(
                'Parada %d %s/%s/%s · diff=%s (sin causa identificable automáticamente)',
                $grupo['parada_num'], $grupo['material_la'], $grupo['zona'], $grupo['motivo'],
                number_format($diferencia, 2)
            ),
        ];
    }
}

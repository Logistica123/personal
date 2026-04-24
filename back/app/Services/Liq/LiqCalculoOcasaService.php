<?php

namespace App\Services\Liq;

use App\Models\LiqEsquemaTarifario;
use App\Models\LiqLineaTarifa;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqOperacion;
use Illuminate\Support\Facades\DB;

/**
 * SPEC v3 · Motor de cálculo OCASA — resolver unificado de 4 ramas.
 *
 * El motor decide QUÉ fórmula aplicar según dónde matcheó la tarifa:
 *
 *   RAMA D · Productividad por paradas
 *     Fuente: liq_tarifas_productividad_cliente (por cliente + ruta + fecha vigente)
 *     Fórmula: Σ (tarifa_LA por parada según material × zona × estado)
 *     Se persiste detalle_paradas jsonb para el PDF del distribuidor.
 *
 *   RAMA A · Override absoluto (jornada negociada)
 *     Fuente: liq_lineas_tarifa con costo_fijo_base NOT NULL (o precio_distribuidor fallback)
 *     Fórmula: costo_fijo_base × fracción_jornada + factor_km × CostoKm_TMS
 *     Usar cuando hay un valor fijo acordado por distribuidor (Walter, Benítez, Hurt, Pérez, Trejo).
 *
 *   RAMA B · Factor explícito
 *     Fuente: liq_lineas_tarifa con factor_distrib NOT NULL (y sin override absoluto)
 *     Fórmula: factor × (CostoFijo_TMS + CostoKm_TMS + CostoProd_TMS + CostoCant_TMS)
 *     Usar cuando la tarifa contractual escala con el TMS.
 *
 *   RAMA C · Error visible
 *     Ninguna tabla matcheó → estado_calculo='sin_tarifa_definida', importe=null.
 *     El motor NO inventa un default — el área Liquidaciones debe resolver.
 *
 * Orden del resolver (productividad PRIMERO, gana contra jornada):
 *   1) ¿Ruta en liq_tarifas_productividad_cliente? → Rama D
 *   2) ¿Override por distribuidor_nombre en liq_lineas_tarifa? → Rama A (si costo_fijo_base) / Rama B (si factor_distrib)
 *   3) ¿Override por patente_match? → Rama A/B
 *   4) ¿Línea BASE ruta+cap? → Rama A/B
 *   5) Nada → Rama C
 *
 * Los match_tipo reportados a la capa de comando son:
 *   DISTRIBUIDOR | PATENTE | BASE | PRODUCTIVIDAD | sin_match
 */
class LiqCalculoOcasaService
{
    /**
     * @return array{
     *   match_tipo: string|null,
     *   modo_pago: string|null,
     *   linea_tarifa_id: int|null,
     *   importe: float|null,
     *   desglose: array,
     *   detalle_paradas: array|null,
     *   estado_calculo: string,
     *   error_msg: string|null,
     *   warnings: array,
     * }
     */
    public function calcularOperacion(LiqOperacion $op, LiqEsquemaTarifario $esquema): array
    {
        $ruta = (string) ($op->concepto ?? '');
        $capacidad = (int) ($op->capacidad_vehiculo_kg ?? 0);
        $patente = strtoupper(trim((string) ($op->dominio ?? '')));

        // Nombre del distribuidor normalizado (case+accent-insensitive)
        [$distNombre, $distNombreAlt] = $this->resolverNombreDistribuidor($op);

        // Fecha de la operación para lookup de tarifa vigente.
        // Si la op no tiene fecha propia, usamos el periodo_desde de la liquidación.
        $fecha = $this->resolverFechaOperacion($op);

        // ============================================================
        // RAMA D · Productividad por paradas
        // ============================================================
        // Busca PRIMERO en liq_tarifas_productividad_cliente. Si la ruta está ahí
        // para esta fecha y cliente, gana contra cualquier rama de jornada.
        $tieneProductividad = DB::table('liq_tarifas_productividad_cliente')
            ->where('cliente_id', $esquema->cliente_id)
            ->where('ruta', $ruta)
            ->where('vigencia_desde', '<=', $fecha)
            ->where(function ($q) use ($fecha) {
                $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $fecha);
            })
            ->exists();
        if ($tieneProductividad) {
            return $this->resolverRamaD($op, $esquema, $fecha);
        }

        // ============================================================
        // RAMA A/B · Jornada (override absoluto o factor explícito)
        // ============================================================
        // Busca tarifa en liq_lineas_tarifa en orden: DISTRIBUIDOR → PATENTE → BASE.
        // Cada match se resuelve por rama A o B según qué campo tenga la línea.

        // DISTRIBUIDOR
        if ($distNombre) {
            $candidatos = LiqLineaTarifa::where('esquema_id', $esquema->id)
                ->where('activo', true)
                ->where('es_tarifa_base', false)
                ->where('ruta_codigo', $ruta)
                ->where('capacidad_vehiculo_kg', $capacidad)
                ->whereNotNull('distribuidor_nombre')
                ->get();
            foreach ($candidatos as $c) {
                $n = $this->normalizarNombre($c->distribuidor_nombre);
                if ($n === $distNombre || $n === $distNombreAlt) {
                    return $this->resolverJornada($op, $c, 'DISTRIBUIDOR');
                }
            }
        }

        // PATENTE
        if ($patente !== '') {
            $linea = LiqLineaTarifa::where('esquema_id', $esquema->id)
                ->where('activo', true)
                ->where('es_tarifa_base', false)
                ->where('ruta_codigo', $ruta)
                ->where('capacidad_vehiculo_kg', $capacidad)
                ->where('patente_match', $patente)
                ->first();
            if ($linea) {
                return $this->resolverJornada($op, $linea, 'PATENTE');
            }
        }

        // BASE
        $linea = LiqLineaTarifa::where('esquema_id', $esquema->id)
            ->where('activo', true)
            ->where('es_tarifa_base', true)
            ->where('ruta_codigo', $ruta)
            ->where('capacidad_vehiculo_kg', $capacidad)
            ->first();
        if ($linea) {
            return $this->resolverJornada($op, $linea, 'BASE');
        }

        // ============================================================
        // RAMA C · Sin tarifa
        // ============================================================
        return $this->resolverRamaC($op, $ruta, $capacidad, $distNombre, $patente);
    }

    /**
     * Decide entre Rama A (override absoluto) o Rama B (factor explícito) según
     * qué campo tiene poblado la línea encontrada.
     */
    private function resolverJornada(LiqOperacion $op, LiqLineaTarifa $linea, string $tipoMatch): array
    {
        $tieneAbsoluto = $linea->costo_fijo_base !== null
            || ($linea->precio_distribuidor !== null && (float) $linea->precio_distribuidor > 0);
        $tieneFactor = $linea->factor_distrib !== null;

        if ($tieneAbsoluto) {
            return $this->aplicarFormulaRamaA($op, $linea, $tipoMatch);
        }
        if ($tieneFactor) {
            return $this->aplicarFormulaRamaB($op, $linea, $tipoMatch);
        }

        // Línea sin override absoluto ni factor → no se puede calcular
        return $this->resolverRamaC(
            $op,
            $linea->ruta_codigo,
            (int) $linea->capacidad_vehiculo_kg,
            $linea->distribuidor_nombre,
            $linea->patente_match,
            "Línea #{$linea->id} sin costo_fijo_base ni factor_distrib — cargar uno de los dos en el Excel de tarifas"
        );
    }

    /**
     * Rama A · Override absoluto (jornada negociada).
     *
     *   pago = costo_fijo_base × fracción_jornada
     *        + factor_km       × CostoKm_TMS
     *        + factor_prod     × CostoProd_TMS
     *        + factor_cant     × CostoCant_TMS
     *        − penalidades_TMS
     *
     * Usa costo_fijo_base (o fallback precio_distribuidor) como valor absoluto negociado.
     * Los factores km/prod/cant escalan linealmente con los costos TMS.
     * Este es el camino "estándar" hoy — Walter, Ahuad, Benítez, Hurt, Pérez, Trejo.
     */
    private function aplicarFormulaRamaA(LiqOperacion $op, LiqLineaTarifa $linea, string $tipoMatch): array
    {
        $costoFijo    = (float) ($linea->costo_fijo_base ?? $linea->precio_distribuidor ?? 0);
        $factorKm     = $linea->factor_km !== null ? (float) $linea->factor_km : null;
        $factorProd   = $linea->factor_prod_distrib !== null ? (float) $linea->factor_prod_distrib : null;
        $factorCant   = $linea->factor_cant_distrib !== null ? (float) $linea->factor_cant_distrib : null;

        $fraccion     = (float) ($op->fraccion_jornada ?? 1.0);
        $costoKmTms   = (float) ($op->costo_km ?? 0);
        $costoProdTms = (float) ($op->costo_prod ?? 0);
        $costoCantTms = (float) ($op->costo_cant ?? 0);
        $penalidades  = (float) ($op->penalidades_tms
            ?? ($op->campos_originales['penalidades'] ?? 0));

        $componentes = [
            'costo_fijo'    => round($costoFijo * $fraccion, 2),
            'km'            => $factorKm   !== null ? round($factorKm * $costoKmTms, 2)     : 0.0,
            'productividad' => $factorProd !== null ? round($factorProd * $costoProdTms, 2) : 0.0,
            'cantidad'      => $factorCant !== null ? round($factorCant * $costoCantTms, 2) : 0.0,
            'penalidades'   => round($penalidades, 2),
        ];
        $importe = round(
            $componentes['costo_fijo'] + $componentes['km']
            + $componentes['productividad'] + $componentes['cantidad']
            - $componentes['penalidades'],
            2
        );

        return [
            'match_tipo'      => $tipoMatch,
            'modo_pago'       => 'override_jornada',
            'linea_tarifa_id' => $linea->id,
            'importe'         => $importe,
            'desglose'        => [
                'rama'             => 'A',
                'formula'          => 'costo_fijo_base × frac + factor_km × CostoKm + factor_prod × CostoProd + factor_cant × CostoCant − penalidades',
                'costo_fijo_distrib' => $costoFijo,
                'fraccion_jornada' => $fraccion,
                'factor_km'        => $factorKm,
                'factor_prod'      => $factorProd,
                'factor_cant'      => $factorCant,
                'costo_km_tms'     => $costoKmTms,
                'costo_prod_tms'   => $costoProdTms,
                'costo_cant_tms'   => $costoCantTms,
                'penalidades_tms'  => $penalidades,
                'componentes'      => $componentes,
            ],
            'detalle_paradas' => null,
            'estado_calculo'  => 'ok',
            'error_msg'       => null,
            'warnings'        => [],
        ];
    }

    /**
     * Rama B · Factor explícito.
     *
     *   pago = factor × (CostoFijo_TMS + CostoKm_TMS + CostoProd_TMS + CostoCant_TMS) − penalidades
     *
     * Se aplica sobre los costos que el TMS trae por operación. El factor escala todo
     * linealmente — útil cuando la tarifa LA→Distrib es un porcentaje fijo de lo que
     * OCASA paga a LA (ej 0.85 = margen 15%).
     *
     * Regla dura del SPEC v3: el factor NUNCA se deriva de porcentaje_agencia. Si falta,
     * pasa a Rama C (error visible) en lugar de inventar un default.
     */
    private function aplicarFormulaRamaB(LiqOperacion $op, LiqLineaTarifa $linea, string $tipoMatch): array
    {
        $factor       = (float) $linea->factor_distrib;
        $costoFijoTms = (float) ($op->costo_fijo ?? 0);
        $costoKmTms   = (float) ($op->costo_km ?? 0);
        $costoProdTms = (float) ($op->costo_prod ?? 0);
        $costoCantTms = (float) ($op->costo_cant ?? 0);
        $penalidades  = (float) ($op->penalidades_tms
            ?? ($op->campos_originales['penalidades'] ?? 0));

        $componentes = [
            'costo_fijo'    => round($factor * $costoFijoTms, 2),
            'km'            => round($factor * $costoKmTms, 2),
            'productividad' => round($factor * $costoProdTms, 2),
            'cantidad'      => round($factor * $costoCantTms, 2),
            'penalidades'   => round($penalidades, 2),
        ];
        $importe = round(
            $componentes['costo_fijo'] + $componentes['km']
            + $componentes['productividad'] + $componentes['cantidad']
            - $componentes['penalidades'],
            2
        );

        return [
            'match_tipo'      => $tipoMatch,
            'modo_pago'       => 'factor_tms',
            'linea_tarifa_id' => $linea->id,
            'importe'         => $importe,
            'desglose'        => [
                'rama'             => 'B',
                'formula'          => 'factor × (CostoFijo_TMS + CostoKm_TMS + CostoProd_TMS + CostoCant_TMS) − penalidades',
                'factor_distrib'   => $factor,
                'costo_fijo_tms'   => $costoFijoTms,
                'costo_km_tms'     => $costoKmTms,
                'costo_prod_tms'   => $costoProdTms,
                'costo_cant_tms'   => $costoCantTms,
                'penalidades_tms'  => $penalidades,
                'componentes'      => $componentes,
            ],
            'detalle_paradas' => null,
            'estado_calculo'  => 'ok',
            'error_msg'       => null,
            'warnings'        => [],
        ];
    }

    /**
     * Rama C · Sin tarifa resoluble (error visible).
     *
     * No se encontró tarifa en productividad ni en liq_lineas_tarifa (o la que se encontró
     * no tiene ni costo_fijo_base ni factor_distrib). El motor NO calcula ni inventa default.
     * La op queda con estado_calculo='sin_tarifa_definida' y se ve desde liquidaciones.
     */
    private function resolverRamaC(
        LiqOperacion $op,
        ?string $ruta,
        int $capacidad,
        ?string $distNombre,
        ?string $patente,
        ?string $mensajeExtra = null
    ): array {
        $msg = $mensajeExtra
            ?? "Sin tarifa para cliente · ruta={$ruta}, capacidad={$capacidad}kg, distribuidor={$distNombre}, patente={$patente}";

        return [
            'match_tipo'      => null,
            'modo_pago'       => null,
            'linea_tarifa_id' => null,
            'importe'         => null,
            'desglose'        => ['rama' => 'C', 'motivo' => $msg],
            'detalle_paradas' => null,
            'estado_calculo'  => 'sin_tarifa_definida',
            'error_msg'       => $msg,
            'warnings'        => [$msg],
        ];
    }

    /**
     * Rama D · Productividad por paradas.
     *
     * Lee los detalles YCC de la operación (liq_operaciones_detalle), mapea cada parada
     * contra liq_tarifas_productividad_cliente según (ruta, material_la, zona, tipo) y
     * suma las tarifas LA → pago del distribuidor.
     *
     * Mapeos usados:
     *   - material_ycc (PA/SO/BO/BI) → material_la (vía liq_material_mapeo)
     *   - motivo YCC → tipo ('exitoso' si está en liq_motivos_exitosos con es_exitoso=1, 'fallido' si no)
     *   - cod_regio del detalle → zona de la tarifa
     *
     * Persiste el array detalle_paradas en la op para que el PDF distribuidor lo use.
     */
    private function resolverRamaD(LiqOperacion $op, LiqEsquemaTarifario $esquema, string $fecha): array
    {
        $clienteId = (int) $esquema->cliente_id;
        $ruta      = (string) $op->concepto;

        // Cargar paradas YCC de esta op
        $paradas = DB::table('liq_operaciones_detalle')
            ->where('operacion_id', $op->id)
            ->orderBy('parada')
            ->get();

        if ($paradas->isEmpty()) {
            return $this->resolverRamaC(
                $op, $ruta, (int) $op->capacidad_vehiculo_kg, null, $op->dominio,
                "Ruta {$ruta} es productividad pero la op no tiene paradas YCC cargadas"
            );
        }

        // Mapeo material YCC → material_la (una sola query, in-memory map)
        $mapeoMaterial = DB::table('liq_material_mapeo')
            ->where('cliente_id', $clienteId)
            ->pluck('material_tarifario', 'codigo_ycc')
            ->toArray();

        // Motivos exitosos del cliente (in-memory set)
        $motivosExitosos = DB::table('liq_motivos_exitosos')
            ->where('cliente_id', $clienteId)
            ->where('es_exitoso', 1)
            ->pluck('codigo')
            ->map(fn($c) => (string) $c)
            ->toArray();

        // Pre-cargar todas las tarifas productividad de esta ruta en memoria
        // Key: material_la|zona|tipo
        $tarifasRaw = DB::table('liq_tarifas_productividad_cliente')
            ->where('cliente_id', $clienteId)
            ->where('ruta', $ruta)
            ->where('vigencia_desde', '<=', $fecha)
            ->where(function ($q) use ($fecha) {
                $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $fecha);
            })
            ->get();
        $tarifas = [];
        foreach ($tarifasRaw as $t) {
            $key = $t->material_la . '|' . $t->zona . '|' . $t->tipo;
            $tarifas[$key] = $t;
        }

        $detalles = [];
        $importe  = 0.0;
        $paradasSinTarifa = 0;
        $paradasOk = 0;

        foreach ($paradas as $parada) {
            $matYcc = trim((string) ($parada->material_ycc ?? ''));
            $matLa  = $mapeoMaterial[$matYcc] ?? null;
            $zona   = trim((string) ($parada->cod_regio ?? ''));
            $motivo = trim((string) ($parada->motivo ?? ''));
            $bultos = (int) ($parada->bultos ?? 0);

            // Sin motivo: no cuenta para el pago (igual que hoy en eficiencia)
            if ($motivo === '') continue;

            $esExitoso = in_array($motivo, $motivosExitosos, true);
            $estado    = $esExitoso ? 'exitoso' : 'fallido';

            if ($matLa === null || $zona === '') {
                $paradasSinTarifa++;
                continue;
            }

            $tarifa = $tarifas[$matLa . '|' . $zona . '|' . $estado] ?? null;
            if (!$tarifa) {
                $paradasSinTarifa++;
                continue;
            }

            $tarifaLa      = (float) $tarifa->precio_distribuidor;
            $tarifaOrig    = (float) $tarifa->precio_original;
            $factorAgencia = (float) $tarifa->porcentaje_agencia;
            $factorDistrib = $tarifaOrig > 0 ? round($tarifaLa / $tarifaOrig, 4) : null;

            $importe += $tarifaLa;
            $paradasOk++;

            $detalles[] = [
                'parada_num'      => (int) $parada->parada,
                'material_ycc'    => $matYcc,
                'material_la'     => $matLa,
                'zona'            => $zona,
                'distrito'        => $parada->distrito ?? null,
                'motivo'          => $motivo,
                'estado'          => $estado,
                'bultos'          => $bultos,
                'tarifa_orig'     => $tarifaOrig,
                'tarifa_la'       => $tarifaLa,
                'factor_aplicado' => $factorDistrib,
            ];
        }

        $importe = round($importe, 2);

        return [
            'match_tipo'      => 'PRODUCTIVIDAD',
            'modo_pago'       => 'productividad_paradas',
            'linea_tarifa_id' => null, // no hay linea en liq_lineas_tarifa
            'importe'         => $importe,
            'desglose'        => [
                'rama'              => 'D',
                'formula'           => 'Σ tarifa_LA por parada (material × zona × estado)',
                'paradas_total'     => $paradas->count(),
                'paradas_pagadas'   => $paradasOk,
                'paradas_sin_tarifa'=> $paradasSinTarifa,
            ],
            'detalle_paradas' => $detalles,
            'estado_calculo'  => 'ok',
            'error_msg'       => null,
            'warnings'        => $paradasSinTarifa > 0
                ? ["Op #{$op->id} ruta {$ruta}: {$paradasSinTarifa} paradas sin tarifa productividad (material/zona no mapeada)"]
                : [],
        ];
    }

    /**
     * Resuelve el nombre del distribuidor (y variante nombres-apellidos) normalizado
     * para matching case+accent-insensitive contra liq_lineas_tarifa.distribuidor_nombre.
     *
     * @return array{0: string|null, 1: string|null}
     */
    private function resolverNombreDistribuidor(LiqOperacion $op): array
    {
        if (!$op->distribuidor_id) return [null, null];
        $p = DB::table('personas')->where('id', $op->distribuidor_id)
            ->first(['apellidos', 'nombres']);
        if (!$p) return [null, null];
        return [
            $this->normalizarNombre(($p->apellidos ?? '') . ' ' . ($p->nombres ?? '')),
            $this->normalizarNombre(($p->nombres ?? '') . ' ' . ($p->apellidos ?? '')),
        ];
    }

    /**
     * Resuelve la fecha "de referencia" de la operación para lookup de tarifas vigentes.
     * Orden de preferencia: campos_originales.Fecha → periodo_desde de la liq cliente → hoy.
     */
    private function resolverFechaOperacion(LiqOperacion $op): string
    {
        // Intento 1: campos_originales JSON del TMS
        $campos = $op->campos_originales;
        if (is_string($campos)) {
            $campos = json_decode($campos, true) ?: [];
        } elseif (!is_array($campos)) {
            $campos = [];
        }
        foreach (['Fecha Planif/', 'FechaPlanif', 'fecha_planif', 'Fecha', 'fecha'] as $k) {
            if (!empty($campos[$k])) {
                try {
                    return \Carbon\Carbon::parse($campos[$k])->toDateString();
                } catch (\Throwable $e) { /* fallthrough */ }
            }
        }

        // Intento 2: periodo_desde de la liq cliente
        $liqCli = DB::table('liq_liquidaciones_cliente')
            ->where('id', $op->liquidacion_cliente_id)
            ->value('periodo_desde');
        if ($liqCli) return (string) $liqCli;

        // Fallback: hoy
        return now()->toDateString();
    }

    /**
     * Normaliza un nombre para comparación: UPPERCASE, sin tildes, colapsa espacios.
     * El Excel importado suele traer tildes ("Benítez Germán") pero personas las guarda sin
     * ("BENITEZ GERMAN"). Sin esta normalización, los overrides jamás matchean por nombre.
     */
    private function normalizarNombre(?string $s): string
    {
        if ($s === null) return '';
        // Quitar tildes manteniendo la letra base
        $s = strtr($s, [
            'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u',
            'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U',
            'ñ' => 'n', 'Ñ' => 'N',
            'ü' => 'u', 'Ü' => 'U',
        ]);
        $s = strtoupper(trim($s));
        $s = preg_replace('/\s+/', ' ', $s);
        return $s;
    }

    /**
     * Recalcula todas las operaciones OK/diferencia de una liquidación cliente con el motor v5.
     */
    public function recalcularLiquidacion(
        LiqLiquidacionCliente $liqCliente,
        bool $dryRun = false
    ): array {
        $esquema = LiqEsquemaTarifario::where('cliente_id', $liqCliente->cliente_id)
            ->where('activo', true)
            ->latest()
            ->first();
        if (!$esquema) {
            return ['total' => 0, 'motivo' => 'Sin esquema tarifario activo para cliente', 'actualizadas' => 0];
        }

        $ops = LiqOperacion::where('liquidacion_cliente_id', $liqCliente->id)
            ->whereIn('estado', ['ok', 'diferencia', 'pendiente', 'sin_tarifa'])
            ->where('excluida', false)
            ->get();

        $stats = [
            'total' => $ops->count(),
            'actualizadas' => 0,
            'sin_tarifa' => 0,
            'por_match' => [
                'DISTRIBUIDOR' => 0, 'PATENTE' => 0, 'BASE' => 0,
                'PRODUCTIVIDAD' => 0,  // SPEC v3 · Rama D
                'sin_match' => 0,
            ],
            'por_modo' => [
                'override_jornada' => 0,
                'factor_tms' => 0,
                'productividad_paradas' => 0,
                'sin_modo' => 0,
            ],
            'warnings' => [],
            'muestras' => [],
        ];

        foreach ($ops as $op) {
            $res = $this->calcularOperacion($op, $esquema);

            $tipo = $res['match_tipo'] ?? 'sin_match';
            $modo = $res['modo_pago'] ?? 'sin_modo';
            $stats['por_match'][$tipo ?: 'sin_match']++;
            $stats['por_modo'][$modo ?? 'sin_modo']++;
            if ($res['importe'] === null) $stats['sin_tarifa']++;

            foreach ($res['warnings'] as $w) {
                $stats['warnings'][$w] = ($stats['warnings'][$w] ?? 0) + 1;
            }

            if (count($stats['muestras']) < 5) {
                $stats['muestras'][] = [
                    'op_id' => $op->id,
                    'dominio' => $op->dominio,
                    'ruta' => $op->concepto,
                    'capacidad' => $op->capacidad_vehiculo_kg,
                    'match_tipo' => $tipo,
                    'modo_pago' => $modo,
                    'importe' => $res['importe'],
                ];
            }

            if ($dryRun) continue;

            // Persistir componentes del desglose + campos de resolver (SPEC v3 · Rama A/B/C/D).
            $comp = $res['desglose']['componentes'] ?? [];
            $op->update([
                'modelo_calculo' => $tipo,
                'modo_pago' => $res['modo_pago'] ?? null,
                'estado_calculo' => $res['estado_calculo'] ?? 'ok',
                'error_msg' => $res['error_msg'] ?? null,
                'linea_tarifa_id' => $res['linea_tarifa_id'] ?? $op->linea_tarifa_id,
                'valor_tarifa_distribuidor' => $res['importe'],
                'tarifa_jornada_distrib' => $comp['costo_fijo'] ?? null,
                'tarifa_km_distrib_valor' => $comp['km'] ?? null,
                'tarifa_prod_distrib' => $comp['productividad'] ?? null,
                'detalle_paradas' => $res['detalle_paradas'] !== null
                    ? json_encode($res['detalle_paradas'], JSON_UNESCAPED_UNICODE)
                    : null,
                'requiere_override_manual' => false,
                'estado' => $res['importe'] !== null ? 'ok' : 'sin_tarifa',
            ]);

            if ($res['importe'] !== null) $stats['actualizadas']++;
        }

        return $stats;
    }
}

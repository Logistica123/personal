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

        $ops = LiqOperacion::where('liquidacion_cliente_id', $liqCliente->id)
            ->where('excluida', false)
            ->whereIn('estado', ['ok', 'diferencia', 'pendiente', 'sin_tarifa'])
            ->get();

        $stats = [
            'ops_analizadas'      => $ops->count(),
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

            DB::table('liq_reclamos_ocasa')->insert([
                'op_id'              => $op->id,
                'tarifa_contrato_id' => $tarifa->id,
                'importe_tms'        => $importeTms,
                'importe_esperado'   => $importeEsperado,
                'diferencia'         => $diferencia,
                'estado'             => 'pendiente_reclamo',
                'motivo_detectado'   => "[{$tipo}] {$motivo}",
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

        return $stats;
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
}

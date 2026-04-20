<?php

namespace App\Services\Liq\Eficiencia;

use App\Models\LiqLiquidacionDistribuidor;
use App\Models\LiqOperacion;

/**
 * BUGFIX 24 MVP — Eficiencia OCASA v1.
 *
 * Fórmula:
 *   base = SUM(costo_fijo) / SUM(valor_tarifa_original)
 *   considerando sólo ops con modelo_tarifa ∈ {JORNADA, JORNADA_KM}, fraccion_jornada ≤ 1.0, no excluidas
 *
 * Interpretación: fracción promedio ponderada por tarifa esperada.
 *   - Si todas las jornadas son completas (fracción=1.0) → eficiencia = 100%
 *   - Si hay jornadas parciales → eficiencia baja proporcional
 *   - Si hay ops con fracción > 1.0 (bug residual) → se excluyen y se reporta
 *
 * No contempla penalidades del TMS (requiere migración previa a iteración 2).
 * No contempla PRODUCTIVIDAD (ROS001/SUR001) — se reporta como "no medido".
 */
class EficienciaOcasaStrategy implements EficienciaStrategy
{
    private const MODELOS_CONTABLES = ['JORNADA', 'JORNADA_KM'];

    public function calcular(LiqLiquidacionDistribuidor $liq): array
    {
        $baseQuery = LiqOperacion::where('liquidacion_cliente_id', $liq->liquidacion_cliente_id)
            ->where('distribuidor_id', $liq->distribuidor_id)
            ->where('excluida', false);

        $opsTotal = (clone $baseQuery)->count();
        if ($opsTotal === 0) {
            return [null, [
                'formula' => null,
                'motivo'  => 'Sin operaciones del distribuidor en el período',
                'version' => 'ocasa-v1',
            ]];
        }

        // Ops contables: JORNADA/JORNADA_KM con fracción <= 1
        $opsContables = (clone $baseQuery)
            ->whereIn('modelo_tarifa', self::MODELOS_CONTABLES)
            ->where('fraccion_jornada', '<=', 1.0)
            ->selectRaw('
                COUNT(*) as cant,
                COALESCE(SUM(costo_fijo), 0)             as sum_costo_fijo,
                COALESCE(SUM(valor_tarifa_original), 0)  as sum_valor_original
            ')
            ->first();

        // Ops excluidas del cálculo (por modelo o fracción anómala)
        $opsFraccionAlta = (clone $baseQuery)
            ->where('fraccion_jornada', '>', 1.0)
            ->count();
        $opsProductividad = (clone $baseQuery)
            ->where('modelo_tarifa', 'PRODUCTIVIDAD')
            ->count();

        $cant = (int) ($opsContables->cant ?? 0);
        $sumCF = (float) ($opsContables->sum_costo_fijo ?? 0);
        $sumVO = (float) ($opsContables->sum_valor_original ?? 0);

        if ($cant === 0 || $sumVO <= 0) {
            return [null, [
                'formula' => 'SUM(costo_fijo) / SUM(valor_tarifa_original)',
                'motivo'  => $cant === 0
                    ? 'Sin ops JORNADA/JORNADA_KM contables en el período'
                    : 'SUM(valor_tarifa_original)=0',
                'ops_total'               => $opsTotal,
                'ops_fraccion_alta'       => $opsFraccionAlta,
                'ops_productividad'       => $opsProductividad,
                'version'                 => 'ocasa-v1',
            ]];
        }

        $pct = round(($sumCF / $sumVO) * 100, 2);

        return [$pct, [
            'formula'                => 'SUM(costo_fijo) / SUM(valor_tarifa_original) × 100 — modelo JORNADA/JORNADA_KM, fraccion_jornada ≤ 1.0',
            'numerador_costo_fijo'   => round($sumCF, 2),
            'denominador_valor_orig' => round($sumVO, 2),
            'ops_total'              => $opsTotal,
            'ops_contables'          => $cant,
            'ops_fraccion_alta'      => $opsFraccionAlta,
            'ops_productividad'      => $opsProductividad,
            'nota_penalidades'       => 'No contempladas en v1 (pendiente migración de campos TMS)',
            'version'                => 'ocasa-v1',
        ]];
    }
}

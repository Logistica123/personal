<?php

namespace App\Services\Liq\Eficiencia;

use App\Models\LiqLiquidacionDistribuidor;
use App\Models\LiqOperacion;

/**
 * SPEC INTEGRAL Fase A — Eficiencia OCASA v2 (paradas YCC).
 *
 * Reemplaza la v1 (BUGFIX 24) que usaba SUM(costo_fijo)/SUM(valor_tarifa_original).
 *
 * Fórmula nueva:
 *   eficiencia = 100 × SUM(paradas_exitosas) / SUM(paradas_con_motivo)
 *
 * Donde las columnas SUM provienen de liq_operaciones pobladas por LiqEficienciaService::recalcularOperacion.
 * Si hay operaciones sin YCC (paradas_con_motivo=NULL) no cuentan en el denominador.
 *
 * Si el distribuidor no tiene NINGUNA op con paradas YCC en el período, devuelve null ("sin datos").
 */
class EficienciaOcasaStrategy implements EficienciaStrategy
{
    public function calcular(LiqLiquidacionDistribuidor $liq): array
    {
        $ops = LiqOperacion::where('liquidacion_cliente_id', $liq->liquidacion_cliente_id)
            ->where('distribuidor_id', $liq->distribuidor_id)
            ->where('excluida', false)
            ->get();

        $opsTotal = $ops->count();
        if ($opsTotal === 0) {
            return [null, [
                'formula' => null,
                'motivo'  => 'Sin operaciones del distribuidor en el período',
                'version' => 'ocasa-v2-paradas',
            ]];
        }

        $sumConMotivo = (int) $ops->sum('paradas_con_motivo');
        $sumExitosas  = (int) $ops->sum('paradas_exitosas');
        $sumTotal     = (int) $ops->sum('paradas_ycc_total');
        $opsConYcc    = $ops->filter(fn ($o) => $o->paradas_ycc_total !== null)->count();

        if ($sumConMotivo === 0) {
            return [null, [
                'formula' => '100 × SUM(paradas_exitosas) / SUM(paradas_con_motivo) — modelo paradas YCC',
                'motivo'  => $opsConYcc === 0
                    ? 'Ninguna operación tiene YCC cargado — correr liq:recalc-eficiencia o subir YCC'
                    : 'Todas las paradas tienen motivo vacío (sin denominador calculable)',
                'ops_total'   => $opsTotal,
                'ops_con_ycc' => $opsConYcc,
                'paradas_total' => $sumTotal,
                'version' => 'ocasa-v2-paradas',
            ]];
        }

        $pct = round(100.0 * $sumExitosas / $sumConMotivo, 2);

        return [$pct, [
            'formula'         => '100 × SUM(paradas_exitosas) / SUM(paradas_con_motivo)',
            'paradas_exitosas' => $sumExitosas,
            'paradas_con_motivo' => $sumConMotivo,
            'paradas_total'   => $sumTotal,
            'ops_total'       => $opsTotal,
            'ops_con_ycc'     => $opsConYcc,
            'version'         => 'ocasa-v2-paradas',
        ]];
    }
}

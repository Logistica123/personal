<?php

namespace App\Services\Liq\Eficiencia;

use App\Models\LiqLiquidacionDistribuidor;

/**
 * BUGFIX 24: Interface para estrategias de cálculo de eficiencia por cliente.
 *
 * Cada cliente (OCASA, OCA, Loginter) tiene su propia implementación.
 * Retorna un array [$pct, $detalle]:
 *   - $pct: porcentaje 0-100+ (float, null si no aplica)
 *   - $detalle: array con desglose para auditoría/tooltip
 */
interface EficienciaStrategy
{
    /**
     * @return array{0: ?float, 1: array}
     */
    public function calcular(LiqLiquidacionDistribuidor $liq): array;
}

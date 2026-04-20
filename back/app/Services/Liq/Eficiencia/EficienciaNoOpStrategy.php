<?php

namespace App\Services\Liq\Eficiencia;

use App\Models\LiqLiquidacionDistribuidor;

/**
 * BUGFIX 24: Strategy placeholder para clientes sin fórmula implementada aún.
 * Retorna null + motivo para que la UI muestre "no calculado" sin romper.
 */
class EficienciaNoOpStrategy implements EficienciaStrategy
{
    public function __construct(private readonly string $clienteNombre) {}

    public function calcular(LiqLiquidacionDistribuidor $liq): array
    {
        return [null, [
            'formula'  => null,
            'motivo'   => "Fórmula de eficiencia no implementada aún para cliente '{$this->clienteNombre}'",
            'version'  => 'noop-v1',
        ]];
    }
}

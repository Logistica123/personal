<?php

namespace App\Services\Liq;

use App\Models\LiqLiquidacionDistribuidor;
use App\Services\Liq\Eficiencia\EficienciaNoOpStrategy;
use App\Services\Liq\Eficiencia\EficienciaOcasaStrategy;
use App\Services\Liq\Eficiencia\EficienciaStrategy;

/**
 * BUGFIX 24: Orquesta el cálculo de eficiencia por cliente (strategy pattern).
 *
 * Uso:
 *   $service = app(LiqEficienciaService::class);
 *   $pct = $service->calcular($liqDistribuidor);
 *   // el resultado queda persistido en $liqDistribuidor->eficiencia_pct / _detalle / _calculada_at
 */
class LiqEficienciaService
{
    public function calcular(LiqLiquidacionDistribuidor $liq): ?float
    {
        $liq->loadMissing('liquidacionCliente.cliente');
        $cliente = $liq->liquidacionCliente?->cliente;
        $nombre  = strtoupper(trim((string) ($cliente?->nombre_corto ?? $cliente?->razon_social ?? 'DESCONOCIDO')));

        $strategy = $this->resolveStrategy($nombre);
        [$pct, $detalle] = $strategy->calcular($liq);

        $liq->eficiencia_pct          = $pct;
        $liq->eficiencia_detalle      = $detalle;
        $liq->eficiencia_calculada_at = now();
        $liq->save();

        return $pct !== null ? (float) $pct : null;
    }

    /**
     * Resuelve la estrategia según el nombre del cliente.
     * Los clientes sin implementación usan NoOpStrategy (deja el campo null con motivo).
     */
    private function resolveStrategy(string $clienteNombre): EficienciaStrategy
    {
        // Match flexible (nombre_corto puede ser 'OCASA' o '5' o razón social)
        if (str_contains($clienteNombre, 'OCASA')) {
            return new EficienciaOcasaStrategy();
        }

        // OCA / Loginter / otros: pendiente (iteración 2)
        return new EficienciaNoOpStrategy($clienteNombre);
    }
}

<?php

namespace App\Services\Liq\Banco;

/**
 * Adapter stub para testing. Simula respuestas del banco sin hacer llamadas reales.
 * Cuando se tenga la documentación del WS bancario, crear un adapter concreto.
 */
class BancoStubAdapter implements BancoAdapterInterface
{
    public function testConexion(): bool
    {
        return true;
    }

    public function crearTransferencia(
        string $cbuOrigen,
        string $cbuDestino,
        string $cuilDestino,
        float $importe,
        string $concepto,
    ): array {
        return [
            'referencia' => 'STUB-' . strtoupper(bin2hex(random_bytes(6))),
            'estado'     => 'CONFIRMADA',
            'mensaje'    => 'Transferencia simulada exitosa (modo testing)',
        ];
    }

    public function consultarEstado(string $referenciaBanco): array
    {
        return [
            'estado'              => 'CONFIRMADA',
            'fecha_confirmacion'  => now()->toIso8601String(),
            'mensaje'             => 'Simulación: transferencia confirmada',
        ];
    }

    public function cancelarTransferencia(string $referenciaBanco): array
    {
        return [
            'exito'   => true,
            'mensaje' => 'Simulación: transferencia cancelada',
        ];
    }
}

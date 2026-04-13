<?php

namespace App\Services\Liq\Banco;

use App\DTOs\EstadoTransferencia;
use App\DTOs\ResultadoTransferencia;
use App\DTOs\TransferenciaDTO;

/**
 * Adapter stub para testing. Simula respuestas del banco sin hacer llamadas reales.
 */
class BancoStubAdapter implements BancoAdapterInterface
{
    public function testConexion(): bool
    {
        return true;
    }

    public function enviarTransferencia(TransferenciaDTO $dto): ResultadoTransferencia
    {
        return new ResultadoTransferencia(
            exitoso:         true,
            referenciaBanco: 'STUB-' . strtoupper(bin2hex(random_bytes(6))),
            codigo:          '00',
            mensaje:         'Transferencia simulada exitosa (modo testing)',
        );
    }

    public function consultarEstado(string $referencia): EstadoTransferencia
    {
        return new EstadoTransferencia(
            estado:       'confirmado',
            mensaje:      'Simulación: transferencia confirmada',
            fechaProceso: now()->toIso8601String(),
        );
    }
}

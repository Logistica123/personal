<?php

namespace App\Services\Liq\Banco;

use App\DTOs\EstadoTransferencia;
use App\DTOs\ResultadoTransferencia;
use App\DTOs\TransferenciaDTO;

/**
 * Interfaz genérica para comunicación con Web Services bancarios.
 * Implementar una clase concreta por cada banco.
 */
interface BancoAdapterInterface
{
    public function testConexion(): bool;

    public function enviarTransferencia(TransferenciaDTO $dto): ResultadoTransferencia;

    public function consultarEstado(string $referencia): EstadoTransferencia;
}

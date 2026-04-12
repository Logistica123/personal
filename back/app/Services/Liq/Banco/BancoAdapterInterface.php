<?php

namespace App\Services\Liq\Banco;

/**
 * Interfaz genérica para comunicación con Web Services bancarios.
 * Implementar una clase concreta por cada banco (ej: BancoNacionAdapter).
 */
interface BancoAdapterInterface
{
    /**
     * Prueba de conexión al WS del banco.
     */
    public function testConexion(): bool;

    /**
     * Crea una transferencia bancaria.
     *
     * @return array{referencia: ?string, estado: string, mensaje: string}
     */
    public function crearTransferencia(
        string $cbuOrigen,
        string $cbuDestino,
        string $cuilDestino,
        float $importe,
        string $concepto,
    ): array;

    /**
     * Consulta el estado de una transferencia por su referencia bancaria.
     *
     * @return array{estado: string, fecha_confirmacion: ?string, mensaje: string}
     */
    public function consultarEstado(string $referenciaBanco): array;

    /**
     * Intenta cancelar una transferencia por su referencia bancaria.
     *
     * @return array{exito: bool, mensaje: string}
     */
    public function cancelarTransferencia(string $referenciaBanco): array;
}

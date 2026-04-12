<?php

namespace App\Services\Liq\Banco;

use App\Models\LiqConfigBanco;
use App\Models\LiqOrdenPago;
use App\Models\LiqTransferenciaBanco;
use App\Services\Liq\OrdenPagoService;
use Illuminate\Support\Facades\Log;

class BancoTransferenciaService
{
    public function __construct(
        private readonly OrdenPagoService $ordenPagoService,
    ) {
    }

    // -------------------------------------------------------------------------
    // Resolver adapter
    // -------------------------------------------------------------------------

    private function resolverAdapter(): BancoAdapterInterface
    {
        $config = LiqConfigBanco::activa();

        if (!$config) {
            throw new \RuntimeException('No hay configuración bancaria activa.');
        }

        // En el futuro, resolver dinámicamente según config o .env
        // Por ahora siempre usa el stub para testing
        if ($config->esTesting()) {
            return new BancoStubAdapter();
        }

        // Cuando se tenga la doc del banco, instanciar el adapter real aquí
        // Ejemplo: return new BancoNacionAdapter($config);
        throw new \RuntimeException('No hay adapter de banco configurado para modo PRODUCCION.');
    }

    // -------------------------------------------------------------------------
    // Test de conexión
    // -------------------------------------------------------------------------

    public function testConexion(): bool
    {
        return $this->resolverAdapter()->testConexion();
    }

    // -------------------------------------------------------------------------
    // Ejecutar pago
    // -------------------------------------------------------------------------

    public function ejecutarPago(LiqOrdenPago $op, int $usuarioId): LiqTransferenciaBanco
    {
        if (!$op->puedeEjecutarPago()) {
            throw new \RuntimeException('La OP no está en estado PENDIENTE_PAGO. Estado actual: ' . $op->estado);
        }

        $config = LiqConfigBanco::activa();
        if (!$config) {
            throw new \RuntimeException('No hay configuración bancaria activa.');
        }

        $adapter = $this->resolverAdapter();

        $conceptoBancario = "{$op->numero_display} - Pago {$op->beneficiario_tipo} {$op->beneficiario_nombre}";

        // Crear registro de transferencia
        $transferencia = LiqTransferenciaBanco::create([
            'orden_pago_id'     => $op->id,
            'cbu_origen'        => $config->cbu_empresa,
            'cbu_destino'       => $op->beneficiario_cbu,
            'cuil_destino'      => $op->beneficiario_cuil,
            'importe'           => $op->total_a_pagar,
            'concepto_bancario' => $conceptoBancario,
            'estado_ws'         => LiqTransferenciaBanco::ESTADO_PENDIENTE,
            'fecha_envio'       => now(),
            'usuario_id'        => $usuarioId,
        ]);

        // Cambiar estado de la OP a ENVIADA_BANCO
        $op->update(['estado' => LiqOrdenPago::ESTADO_ENVIADA_BANCO]);

        try {
            $resultado = $adapter->crearTransferencia(
                $config->cbu_empresa,
                $op->beneficiario_cbu,
                $op->beneficiario_cuil,
                (float) $op->total_a_pagar,
                $conceptoBancario,
            );

            $transferencia->update([
                'banco_referencia'  => $resultado['referencia'] ?? null,
                'estado_ws'         => $this->mapearEstadoBanco($resultado['estado']),
                'mensaje_respuesta' => $resultado['mensaje'] ?? null,
                'response_payload'  => $resultado,
            ]);

            // Si fue confirmada, actualizar OP y liquidaciones
            if ($transferencia->fueExitosa()) {
                $transferencia->update(['fecha_confirmacion' => now()]);
                $this->ordenPagoService->marcarPagada($op);
            } elseif ($transferencia->estado_ws === LiqTransferenciaBanco::ESTADO_RECHAZADA) {
                $op->update(['estado' => LiqOrdenPago::ESTADO_RECHAZADA]);
            }

        } catch (\Exception $e) {
            Log::error('Error al ejecutar transferencia bancaria', [
                'orden_pago_id' => $op->id,
                'error'         => $e->getMessage(),
            ]);

            $transferencia->update([
                'estado_ws'         => LiqTransferenciaBanco::ESTADO_ERROR,
                'mensaje_respuesta' => $e->getMessage(),
            ]);

            $op->update(['estado' => LiqOrdenPago::ESTADO_RECHAZADA]);
        }

        return $transferencia->fresh();
    }

    // -------------------------------------------------------------------------
    // Reintentar pago rechazado
    // -------------------------------------------------------------------------

    public function reintentar(LiqOrdenPago $op, int $usuarioId): LiqTransferenciaBanco
    {
        if (!$op->puedeReintentarse()) {
            throw new \RuntimeException('Solo se puede reintentar una OP en estado RECHAZADA.');
        }

        // Volver a PENDIENTE_PAGO y ejecutar
        $op->update(['estado' => LiqOrdenPago::ESTADO_PENDIENTE_PAGO]);

        $ultimoIntento = $op->transferencias()->latest()->first();
        $intentos = $ultimoIntento ? $ultimoIntento->intentos + 1 : 1;

        $transferencia = $this->ejecutarPago($op, $usuarioId);
        $transferencia->update(['intentos' => $intentos]);

        return $transferencia->fresh();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function mapearEstadoBanco(string $estadoBanco): string
    {
        return match (strtoupper($estadoBanco)) {
            'CONFIRMADA', 'OK', 'APROBADA'          => LiqTransferenciaBanco::ESTADO_CONFIRMADA,
            'RECHAZADA', 'ERROR', 'DENEGADA'         => LiqTransferenciaBanco::ESTADO_RECHAZADA,
            'PENDIENTE', 'EN_PROCESO', 'PROCESANDO'  => LiqTransferenciaBanco::ESTADO_ENVIADA,
            default                                   => LiqTransferenciaBanco::ESTADO_ERROR,
        };
    }
}

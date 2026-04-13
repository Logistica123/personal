<?php

namespace App\Services\Liq\Banco;

use App\DTOs\TransferenciaDTO;
use App\Jobs\ProcesarTransferenciaBanco;
use App\Models\LiqConfigBanco;
use App\Models\LiqOrdenPago;
use App\Models\LiqTransferenciaBanco;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class BancoTransferenciaService
{
    // -------------------------------------------------------------------------
    // Resolver adapter
    // -------------------------------------------------------------------------

    public function resolverAdapter(): BancoAdapterInterface
    {
        $config = LiqConfigBanco::activa();

        if (!$config) {
            throw new \RuntimeException('No hay configuración bancaria activa.');
        }

        if ($config->esTesting()) {
            return new BancoStubAdapter();
        }

        return new ICBCMultipayAdapter($config);
    }

    // -------------------------------------------------------------------------
    // Test de conexión
    // -------------------------------------------------------------------------

    public function testConexion(): bool
    {
        $adapter = $this->resolverAdapter();
        $ok = $adapter->testConexion();

        // Registrar resultado del test
        $config = LiqConfigBanco::activa();
        if ($config) {
            $config->update([
                'ultimo_test'           => now(),
                'ultimo_test_resultado' => $ok ? 'OK' : 'FALLO',
            ]);
        }

        return $ok;
    }

    // -------------------------------------------------------------------------
    // Ejecutar pago (despacha Job asincrónico)
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

        $conceptoBancario = "{$op->numero_display} - Pago {$op->beneficiario_tipo} {$op->beneficiario_nombre}";

        // Crear registro de transferencia
        $transferencia = LiqTransferenciaBanco::create([
            'orden_pago_id'       => $op->id,
            'referencia_interna'  => Str::uuid()->toString(),
            'cbu_origen'          => $config->cbu_empresa,
            'cbu_destino'         => $op->beneficiario_cbu,
            'cuil_destino'        => $op->beneficiario_cuil,
            'nombre_beneficiario' => $op->beneficiario_nombre,
            'importe'             => $op->total_a_pagar,
            'moneda'              => 'ARS',
            'concepto_bancario'   => $conceptoBancario,
            'estado_ws'           => LiqTransferenciaBanco::ESTADO_PENDIENTE,
            'fecha_envio'         => now(),
            'usuario_id'          => $usuarioId,
        ]);

        // Cambiar estado de la OP
        $op->update(['estado' => LiqOrdenPago::ESTADO_ENVIADA_BANCO]);

        // Despachar Job asincrónico (o sincrónico si queue=sync)
        ProcesarTransferenciaBanco::dispatch($transferencia->id);

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

        $op->update(['estado' => LiqOrdenPago::ESTADO_PENDIENTE_PAGO]);

        $ultimoIntento = $op->transferencias()->latest()->first();
        $transferencia = $this->ejecutarPago($op, $usuarioId);

        if ($ultimoIntento) {
            $transferencia->update(['intentos' => $ultimoIntento->intentos + 1]);
        }

        return $transferencia->fresh();
    }
}

<?php

namespace App\Jobs;

use App\DTOs\TransferenciaDTO;
use App\Models\Archivo;
use App\Models\LiqConfigBanco;
use App\Models\LiqLiquidacionDistribuidor;
use App\Models\LiqOrdenPago;
use App\Models\LiqTransferenciaBanco;
use App\Services\Liq\Banco\BancoStubAdapter;
use App\Services\Liq\Banco\ICBCMultipayAdapter;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcesarTransferenciaBanco implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 3;
    public int $timeout = 60;
    public array $backoff = [30, 60, 120];

    public function __construct(
        private int $transferenciaId,
    ) {
    }

    public function handle(): void
    {
        $transferencia = LiqTransferenciaBanco::find($this->transferenciaId);
        if (!$transferencia) {
            Log::warning('ProcesarTransferenciaBanco: transferencia no encontrada', ['id' => $this->transferenciaId]);
            return;
        }

        $config = LiqConfigBanco::activa();
        if (!$config) {
            $transferencia->update([
                'estado_ws'         => LiqTransferenciaBanco::ESTADO_ERROR,
                'mensaje_respuesta' => 'No hay configuración bancaria activa.',
            ]);
            return;
        }

        // Resolver adapter según modo
        $adapter = $config->esTesting()
            ? new BancoStubAdapter()
            : new ICBCMultipayAdapter($config);

        try {
            // 1. Marcar como enviada
            $transferencia->update([
                'estado_ws'   => LiqTransferenciaBanco::ESTADO_ENVIADA,
                'fecha_envio' => now(),
            ]);

            // 2. Construir DTO
            $dto = new TransferenciaDTO(
                cbuOrigen:    $transferencia->cbu_origen,
                cbuDestino:   $transferencia->cbu_destino,
                importe:      (float) $transferencia->importe,
                concepto:     $transferencia->concepto_bancario,
                referencia:   $transferencia->referencia_interna ?? (string) $transferencia->id,
                beneficiario: $transferencia->nombre_beneficiario ?? '',
                cuitBenef:    $transferencia->cuil_destino,
            );

            // 3. Enviar al banco
            $resultado = $adapter->enviarTransferencia($dto);

            // 4. Registrar resultado
            $nuevoEstado = $resultado->exitoso
                ? LiqTransferenciaBanco::ESTADO_CONFIRMADA
                : LiqTransferenciaBanco::ESTADO_RECHAZADA;

            $transferencia->update([
                'estado_ws'          => $nuevoEstado,
                'banco_referencia'   => $resultado->referenciaBanco,
                'codigo_respuesta'   => $resultado->codigo,
                'mensaje_respuesta'  => $resultado->mensaje,
                'response_payload'   => $resultado->responseRaw ? ['raw' => $resultado->responseRaw] : null,
                'fecha_confirmacion' => $resultado->exitoso ? now() : null,
            ]);

            // 5. Si exitoso, marcar como pagado
            if ($resultado->exitoso) {
                $this->marcarPagado($transferencia);
            } else {
                // Marcar OP como rechazada
                $transferencia->ordenPago?->update(['estado' => LiqOrdenPago::ESTADO_RECHAZADA]);
            }

        } catch (\Exception $e) {
            Log::error('ProcesarTransferenciaBanco falló', [
                'transferencia_id' => $this->transferenciaId,
                'intento'          => $this->attempts(),
                'error'            => $e->getMessage(),
            ]);

            $transferencia->update([
                'estado_ws'         => LiqTransferenciaBanco::ESTADO_ERROR,
                'mensaje_respuesta' => $e->getMessage(),
                'intentos'          => $transferencia->intentos + 1,
            ]);

            throw $e; // Re-throw para que el queue reintente
        }
    }

    private function marcarPagado(LiqTransferenciaBanco $transferencia): void
    {
        $op = $transferencia->ordenPago;
        if (!$op) return;

        // Verificar si TODAS las transferencias de esta OP están confirmadas
        $todasConfirmadas = $op->transferencias()
            ->where('estado_ws', '!=', LiqTransferenciaBanco::ESTADO_CONFIRMADA)
            ->doesntExist();

        if ($todasConfirmadas) {
            $op->update(['estado' => LiqOrdenPago::ESTADO_CONFIRMADA]);

            // Marcar cada liquidación como pagada
            foreach ($op->detalles as $detalle) {
                if ($detalle->liquidacion_distribuidor_id) {
                    LiqLiquidacionDistribuidor::where('id', $detalle->liquidacion_distribuidor_id)
                        ->update(['estado' => LiqLiquidacionDistribuidor::ESTADO_PAGADA]);
                }
                if ($detalle->archivo_id) {
                    Archivo::where('id', $detalle->archivo_id)
                        ->update(['pagado' => true]);
                }
            }
        }
    }
}

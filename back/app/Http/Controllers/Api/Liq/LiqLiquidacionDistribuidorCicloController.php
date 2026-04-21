<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqHistorialAuditoria;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqLiquidacionDistribuidor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * BUGFIX 27.1 — Ciclo de vida de liq_liquidaciones_distribuidor y liq_liquidaciones_cliente.
 *
 * Endpoints:
 *   POST   /liq/liquidaciones-distribuidor/{id}/preparar         → generada → preparada
 *   PATCH  /liq/liquidaciones-distribuidor/{id}/anular           → * → anulada (reversible con motivo)
 *   DELETE /liq/liquidaciones-distribuidor/{id}                  → soft delete (motivo obligatorio)
 *   PATCH  /liq/liquidaciones/{id}/rechazar                      → liq cliente: estado=rechazada
 *   DELETE /liq/liquidaciones/{id}                               → soft delete (motivo obligatorio)
 */
class LiqLiquidacionDistribuidorCicloController extends Controller
{
    // ─── POST /liq/liquidaciones-distribuidor/{id}/preparar ────────────────
    public function preparar(Request $request, LiqLiquidacionDistribuidor $liquidacionDistribuidor): JsonResponse
    {
        if ($liquidacionDistribuidor->estado !== LiqLiquidacionDistribuidor::ESTADO_GENERADA) {
            return response()->json([
                'error'  => 'estado_invalido',
                'message' => "Sólo se pueden preparar liquidaciones en estado 'generada'. Estado actual: '{$liquidacionDistribuidor->estado}'.",
            ], 422);
        }

        $user = $request->user();
        DB::beginTransaction();
        try {
            $liquidacionDistribuidor->update([
                'estado'         => LiqLiquidacionDistribuidor::ESTADO_PREPARADA,
                'preparada_at'   => now(),
                'preparada_por'  => $user?->id,
            ]);

            LiqHistorialAuditoria::registrar(
                'liquidacion_distribuidor', $liquidacionDistribuidor->id, 'promover_a_oficial',
                ['estado' => LiqLiquidacionDistribuidor::ESTADO_GENERADA],
                ['estado' => LiqLiquidacionDistribuidor::ESTADO_PREPARADA],
                'Promoción a liquidación oficial (BUGFIX 27.1)',
                $user, $request->ip()
            );

            DB::commit();
            return response()->json([
                'message' => 'Liquidación marcada como preparada. Lista para que el distribuidor cargue su factura.',
                'data'    => $liquidacionDistribuidor->fresh(),
                // TODO: notificar al distribuidor (email/WhatsApp) cuando se integre el sistema de notificaciones.
                'notificacion_enviada' => false,
                'notificacion_motivo'  => 'sistema_de_notificaciones_no_integrado',
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'Error al preparar: ' . $e->getMessage()], 500);
        }
    }

    // ─── PATCH /liq/liquidaciones-distribuidor/{id}/anular ─────────────────
    public function anularDistribuidor(Request $request, LiqLiquidacionDistribuidor $liquidacionDistribuidor): JsonResponse
    {
        $data = $request->validate([
            'motivo' => 'required|string|min:10|max:500',
        ]);

        if ($liquidacionDistribuidor->estado === LiqLiquidacionDistribuidor::ESTADO_PAGADA) {
            return response()->json([
                'error' => 'estado_invalido',
                'message' => "No se puede anular una liquidación 'pagada'. Registrar como ajuste/reverso en la siguiente.",
            ], 422);
        }

        $estadoPrevio = $liquidacionDistribuidor->estado;
        $liquidacionDistribuidor->update([
            'estado' => LiqLiquidacionDistribuidor::ESTADO_ANULADA,
        ]);

        LiqHistorialAuditoria::registrar(
            'liquidacion_distribuidor', $liquidacionDistribuidor->id, 'anular',
            ['estado' => $estadoPrevio],
            ['estado' => LiqLiquidacionDistribuidor::ESTADO_ANULADA, 'motivo' => $data['motivo']],
            $data['motivo'],
            $request->user(), $request->ip()
        );

        return response()->json(['message' => 'Liquidación anulada', 'data' => $liquidacionDistribuidor->fresh()]);
    }

    // ─── DELETE /liq/liquidaciones-distribuidor/{id} ───────────────────────
    public function destroyDistribuidor(Request $request, LiqLiquidacionDistribuidor $liquidacionDistribuidor): JsonResponse
    {
        $data = $request->validate([
            'motivo' => 'required|string|min:10|max:500',
        ]);

        if ($liquidacionDistribuidor->estado === LiqLiquidacionDistribuidor::ESTADO_PAGADA) {
            return response()->json([
                'error' => 'estado_invalido',
                'message' => 'No se puede borrar una liquidación pagada. Anularla primero y contabilizar el reverso.',
            ], 422);
        }

        $liquidacionDistribuidor->update([
            'deleted_by'    => $request->user()?->id,
            'delete_motivo' => $data['motivo'],
        ]);
        $liquidacionDistribuidor->delete();  // soft delete

        LiqHistorialAuditoria::registrar(
            'liquidacion_distribuidor', $liquidacionDistribuidor->id, 'borrar_liquidacion',
            null, ['motivo' => $data['motivo']], $data['motivo'],
            $request->user(), $request->ip()
        );

        return response()->json(['message' => 'Liquidación borrada (soft delete)']);
    }

    // ─── PATCH /liq/liquidaciones/{id}/rechazar ────────────────────────────
    public function rechazarCliente(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $data = $request->validate([
            'motivo' => 'required|string|min:10|max:500',
        ]);

        $previo = $liquidacionCliente->estado;
        $liquidacionCliente->update(['estado' => LiqLiquidacionCliente::ESTADO_RECHAZADA]);

        LiqHistorialAuditoria::registrar(
            'liquidacion_cliente', $liquidacionCliente->id, 'rechazar',
            ['estado' => $previo],
            ['estado' => LiqLiquidacionCliente::ESTADO_RECHAZADA, 'motivo' => $data['motivo']],
            $data['motivo'],
            $request->user(), $request->ip()
        );

        return response()->json(['message' => 'Liquidación cliente rechazada', 'data' => $liquidacionCliente->fresh()]);
    }

    // ─── DELETE /liq/liquidaciones/{id} ────────────────────────────────────
    public function destroyCliente(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $data = $request->validate([
            'motivo' => 'required|string|min:10|max:500',
        ]);

        DB::beginTransaction();
        try {
            // Cascade soft-delete de distribuidores asociados
            LiqLiquidacionDistribuidor::where('liquidacion_cliente_id', $liquidacionCliente->id)
                ->get()->each(function ($ld) use ($data, $request) {
                    $ld->update([
                        'deleted_by'    => $request->user()?->id,
                        'delete_motivo' => '[Cascada liq cliente] ' . $data['motivo'],
                    ]);
                    $ld->delete();
                });

            $liquidacionCliente->update([
                'deleted_by'    => $request->user()?->id,
                'delete_motivo' => $data['motivo'],
            ]);
            $liquidacionCliente->delete();

            LiqHistorialAuditoria::registrar(
                'liquidacion_cliente', $liquidacionCliente->id, 'borrar_liquidacion',
                null, ['motivo' => $data['motivo']], $data['motivo'],
                $request->user(), $request->ip()
            );

            DB::commit();
            return response()->json(['message' => 'Liquidación cliente y sus distribuidores borradas (soft delete)']);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'Error al borrar: ' . $e->getMessage()], 500);
        }
    }
}

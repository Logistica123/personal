<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqArchivoEntrada;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqLiquidacionDistribuidor;
use App\Models\LiqOperacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LiqOperacionController extends Controller
{
    public function destroy(Request $request, LiqOperacion $operacion): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (! in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['message' => 'No tenés permisos para eliminar operaciones.'], 403);
        }

        $liquidacionId = (int) $operacion->liquidacion_cliente_id;
        $archivoId = $operacion->archivo_entrada_id ? (int) $operacion->archivo_entrada_id : null;

        DB::beginTransaction();
        try {
            $operacion->delete();

            // Borrar liquidaciones de distribuidor generadas (quedan desactualizadas)
            LiqLiquidacionDistribuidor::where('liquidacion_cliente_id', $liquidacionId)->delete();

            // Recalcular totales de la liquidación
            $this->recalcularTotales($liquidacionId);

            // Actualizar stats del archivo si aplica
            if ($archivoId) {
                $count = LiqOperacion::where('archivo_entrada_id', $archivoId)->count();
                LiqArchivoEntrada::whereKey($archivoId)->update(['cant_registros' => $count]);
            }

            DB::commit();
            return response()->json(['message' => 'Operación eliminada']);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'No se pudo eliminar la operación: ' . $e->getMessage()], 500);
        }
    }

    private function recalcularTotales(int $liquidacionId): void
    {
        $totals = LiqOperacion::where('liquidacion_cliente_id', $liquidacionId)
            ->selectRaw('COUNT(*) as total_ops, SUM(valor_cliente) as total_cliente, SUM(valor_tarifa_original) as total_correcto, SUM(diferencia_cliente) as total_diff')
            ->first();

        $totalOps = (int) ($totals->total_ops ?? 0);

        LiqLiquidacionCliente::whereKey($liquidacionId)->update([
            'total_operaciones' => $totalOps,
            'total_importe_cliente' => $totals->total_cliente ?? 0,
            'total_importe_correcto' => $totals->total_correcto ?? 0,
            'total_diferencia' => $totals->total_diff ?? 0,
            'estado' => $totalOps > 0 ? LiqLiquidacionCliente::ESTADO_EN_PROCESO : LiqLiquidacionCliente::ESTADO_PENDIENTE,
        ]);
    }

    // PUT /liq/operaciones/{operacion}/excluir
    public function excluir(Request $request, LiqOperacion $operacion): JsonResponse
    {
        $motivo = $request->input('motivo', 'Excluida manualmente');
        $operacion->update([
            'excluida'         => true,
            'estado'           => 'excluida',
            'motivo_exclusion' => $motivo,
        ]);
        LiqLiquidacionDistribuidor::where('liquidacion_cliente_id', $operacion->liquidacion_cliente_id)->delete();
        return response()->json(['message' => 'Operación excluida', 'data' => $operacion->fresh()]);
    }

    // PUT /liq/operaciones/{operacion}/editar-importes (BUGFIX 22 H)
    // Permite editar manualmente importe_gravado/importe_no_gravado con motivo obligatorio
    public function editarImportes(Request $request, LiqOperacion $operacion): JsonResponse
    {
        $data = $request->validate([
            'importe_gravado'     => 'nullable|numeric|min:0',
            'importe_no_gravado'  => 'nullable|numeric|min:0',
            'motivo'              => 'required|string|min:3|max:500',
        ]);

        if (!array_key_exists('importe_gravado', $data) && !array_key_exists('importe_no_gravado', $data)) {
            return response()->json(['error' => 'Debe especificar al menos un importe a modificar'], 422);
        }

        $previos = [
            'importe_gravado'    => (float) $operacion->importe_gravado,
            'importe_no_gravado' => (float) $operacion->importe_no_gravado,
        ];

        DB::beginTransaction();
        try {
            $updates = [];
            if (array_key_exists('importe_gravado', $data)) {
                $updates['importe_gravado'] = $data['importe_gravado'];
            }
            if (array_key_exists('importe_no_gravado', $data)) {
                $updates['importe_no_gravado'] = $data['importe_no_gravado'];
            }

            $operacion->update($updates);

            // Registrar auditoría en historial
            if (class_exists(\App\Models\LiqHistorialAuditoria::class)) {
                \App\Models\LiqHistorialAuditoria::registrar(
                    'operacion',
                    $operacion->id,
                    'edicion_importes_manual',
                    $previos,
                    $updates + ['motivo' => $data['motivo']],
                    $data['motivo'],
                    $request->user(),
                    $request->ip()
                );
            }

            // Invalidar liquidaciones de distribuidor generadas
            LiqLiquidacionDistribuidor::where('liquidacion_cliente_id', $operacion->liquidacion_cliente_id)->delete();

            DB::commit();
            return response()->json(['message' => 'Importes actualizados', 'data' => $operacion->fresh()]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'Error al actualizar: ' . $e->getMessage()], 500);
        }
    }

    // PUT /liq/operaciones/{operacion}/incluir
    public function incluir(LiqOperacion $operacion): JsonResponse
    {
        // Re-derive estado from existing data
        $estado = 'ok';
        if ($operacion->linea_tarifa_id === null) {
            $estado = 'sin_tarifa';
        } elseif ($operacion->distribuidor_id === null) {
            $estado = 'sin_distribuidor';
        } elseif ($operacion->diferencia_cliente !== null && abs((float) $operacion->diferencia_cliente) > 0.01) {
            $estado = 'diferencia';
        }

        $operacion->update([
            'excluida'         => false,
            'estado'           => $estado,
            'motivo_exclusion' => null,
        ]);
        LiqLiquidacionDistribuidor::where('liquidacion_cliente_id', $operacion->liquidacion_cliente_id)->delete();
        return response()->json(['message' => 'Operación incluida', 'data' => $operacion->fresh()]);
    }
}


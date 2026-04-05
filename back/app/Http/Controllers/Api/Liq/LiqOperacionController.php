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
}


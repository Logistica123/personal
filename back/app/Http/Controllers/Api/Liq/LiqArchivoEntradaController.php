<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqArchivoEntrada;
use App\Models\LiqOperacion;
use App\Services\Liq\LiqIngestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use App\Models\LiqLiquidacionDistribuidor;

class LiqArchivoEntradaController extends Controller
{
    public function __construct(
        private readonly LiqIngestService $ingestService,
    ) {}

    // GET /liq/liquidaciones/{liquidacionCliente}/archivos
    public function index(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $archivos = LiqArchivoEntrada::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->withCount('operaciones')
            ->orderBy('created_at')
            ->get();
        return response()->json(['data' => $archivos]);
    }

    // PATCH /liq/archivos/{archivo}/sucursal - update sucursal manually
    public function updateSucursal(Request $request, LiqArchivoEntrada $archivo): JsonResponse
    {
        $data = $request->validate([
            'sucursal' => 'required|string|max:255',
        ]);
        $sucursal = trim((string) $data['sucursal']);
        $sucursal = preg_replace('/\s+/u', ' ', $sucursal) ?? $sucursal;
        $archivo->update(['sucursal' => Str::upper($sucursal)]);
        return response()->json(['data' => $archivo, 'message' => 'Sucursal actualizada']);
    }

    // POST /liq/archivos/{archivo}/reprocesar - re-run ingest for this file using current config/mapeos
    public function reprocesar(Request $request, LiqArchivoEntrada $archivo): JsonResponse
    {
        $liquidacion = LiqLiquidacionCliente::with('cliente')->findOrFail($archivo->liquidacion_cliente_id);

        DB::beginTransaction();
        try {
            LiqOperacion::where('archivo_entrada_id', $archivo->id)->delete();
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'No se pudo limpiar operaciones previas: ' . $e->getMessage()], 500);
        }

        try {
            $result = $this->ingestService->procesarArchivo($archivo->refresh(), $liquidacion->refresh());
            return response()->json(['data' => $result, 'message' => 'Archivo reprocesado correctamente'], 200);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Error al reprocesar el archivo: ' . $e->getMessage()], 422);
        }
    }

    // DELETE /liq/archivos/{archivo} - eliminar archivo + operaciones (y el binario en storage)
    public function destroy(Request $request, LiqArchivoEntrada $archivo): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (! in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['message' => 'No tenés permisos para eliminar archivos.'], 403);
        }

        $liquidacionId = (int) $archivo->liquidacion_cliente_id;
        $disk = $archivo->disk ?: 'local';
        $ruta = $archivo->ruta_storage;

        DB::beginTransaction();
        try {
            LiqOperacion::where('archivo_entrada_id', $archivo->id)->delete();
            $archivo->delete();

            // Borrar liquidaciones de distribuidor generadas (quedan desactualizadas)
            LiqLiquidacionDistribuidor::where('liquidacion_cliente_id', $liquidacionId)->delete();

            $this->recalcularTotales($liquidacionId);

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'No se pudo eliminar el archivo: ' . $e->getMessage()], 500);
        }

        // Fuera de la transacción: borrar archivo físico (best-effort)
        if ($ruta) {
            try {
                Storage::disk($disk)->delete($ruta);
            } catch (\Throwable $e) {
                // no bloqueante
            }
        }

        return response()->json(['message' => 'Archivo eliminado']);
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

<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqTarifasImportLog;
use App\Services\Liq\LiqImportadorTarifasService;
use App\Services\Liq\LiqPlantillaImportBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * SPEC "Importador de Tarifas OCASA" v1.0 (2026-04-21) — endpoints API.
 *
 *   POST   /liq/tarifas/importar/preview    — valida y devuelve token de preview
 *   POST   /liq/tarifas/importar/confirmar  — aplica el preview, persiste atómicamente
 *   GET    /liq/tarifas/importar/plantilla  — descarga plantilla xlsx con ejemplos
 *   GET    /liq/tarifas/importar/log        — historial de importaciones
 */
class LiqTarifaImportController extends Controller
{
    public function preview(Request $request, LiqImportadorTarifasService $svc): JsonResponse
    {
        $request->validate([
            'archivo'        => 'required|file|mimes:xlsx,xls|max:10240',
            'esquema_id'     => 'required|integer|exists:liq_esquemas_tarifarios,id',
            'vigencia_desde' => 'nullable|date',
            'vigencia_hasta' => 'nullable|date',
            'motivo'         => 'nullable|string|max:500',
        ]);

        try {
            $file = $request->file('archivo');
            $result = $svc->preview(
                pathXlsx: $file->getRealPath(),
                esquemaId: (int) $request->input('esquema_id'),
                ctx: [
                    'vigencia_desde' => $request->input('vigencia_desde'),
                    'vigencia_hasta' => $request->input('vigencia_hasta'),
                    'motivo'         => $request->input('motivo'),
                    'archivo_nombre' => $file->getClientOriginalName(),
                ],
            );
            return response()->json($result);
        } catch (\Throwable $e) {
            return response()->json([
                'error'   => 'preview_error',
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    public function confirmar(Request $request, LiqImportadorTarifasService $svc): JsonResponse
    {
        $request->validate([
            'preview_token'        => 'required|string',
            'aplicar_solo_validas' => 'sometimes|boolean',
        ]);

        try {
            $result = $svc->aplicar(
                previewToken: $request->input('preview_token'),
                aplicarSoloValidas: (bool) $request->boolean('aplicar_solo_validas'),
            );
            return response()->json([
                'message' => "Aplicadas: {$result['aplicadas']} filas ({$result['tarifas_base']} base, {$result['overrides']} overrides, {$result['motivos']} motivos, {$result['materiales']} materiales)",
                'data'    => $result,
            ]);
        } catch (\Throwable $e) {
            $status = str_contains($e->getMessage(), 'expirado') ? 410 : 422;
            return response()->json([
                'error'   => str_contains($e->getMessage(), 'expirado') ? 'preview_expirado' : 'confirm_error',
                'message' => $e->getMessage(),
            ], $status);
        }
    }

    public function plantilla(Request $request, LiqPlantillaImportBuilder $builder): BinaryFileResponse
    {
        $clienteCodigo = $request->input('cliente', 'OCASA');
        $path = $builder->build(strtoupper($clienteCodigo));

        $filename = 'plantilla_tarifas_' . strtoupper($clienteCodigo) . '.xlsx';
        return response()->download($path, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    public function log(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cliente_id' => 'nullable|integer|exists:liq_clientes,id',
            'limit'      => 'nullable|integer|min:1|max:200',
        ]);
        $limit = $data['limit'] ?? 20;

        $query = LiqTarifasImportLog::query()
            ->with(['usuario:id,name', 'cliente:id,nombre_corto,codigo_corto'])
            ->orderByDesc('created_at');

        if (!empty($data['cliente_id'])) {
            $query->where('cliente_id', $data['cliente_id']);
        }

        $logs = $query->limit($limit)->get()->map(fn ($l) => [
            'id'              => $l->id,
            'usuario'         => $l->usuario?->name ?? '—',
            'cliente'         => $l->cliente?->nombre_corto ?? $l->cliente?->codigo_corto ?? '—',
            'esquema_id'      => $l->esquema_id,
            'archivo_nombre'  => $l->archivo_nombre,
            'filas_totales'   => $l->filas_totales,
            'filas_ok'        => $l->filas_ok,
            'filas_error'     => $l->filas_error,
            'tipo_import'     => $l->tipo_import,
            'created_at'      => $l->created_at?->toIso8601String(),
        ]);

        return response()->json(['data' => $logs]);
    }
}

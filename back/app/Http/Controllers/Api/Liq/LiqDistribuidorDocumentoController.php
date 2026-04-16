<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\Archivo;
use App\Models\FileType;
use App\Models\LiqHistorialMovimiento;
use App\Models\LiqLiquidacionDistribuidor;
use App\Models\LiqOperacion;
use App\Services\Liq\LiqDistribuidorPdfService;
use App\Support\Liq\LiqV2DocumentoHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

class LiqDistribuidorDocumentoController extends Controller
{
    // POST /liq/liquidaciones-distribuidor/{liquidacionDistribuidor}/documento
    // Crea (o reactiva) un documento "Liquidación" en el módulo viejo (archivos) para permitir "Subir liquidaciones".
    public function store(Request $request, LiqLiquidacionDistribuidor $liquidacionDistribuidor): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (! in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['message' => 'No tenés permisos para generar documentos de liquidación.'], 403);
        }

        $liquidacionDistribuidor->loadMissing([
            'distribuidor:id,apellidos,nombres,email,patente',
            'liquidacionCliente:id,cliente_id,periodo_desde,periodo_hasta',
            'liquidacionCliente.cliente:id,nombre_corto,razon_social',
        ]);

        $personaId = (int) $liquidacionDistribuidor->distribuidor_id;
        if ($personaId <= 0) {
            return response()->json(['error' => 'Distribuidor inválido.'], 422);
        }

        $tipoLiquidacion = FileType::query()->firstOrCreate(
            ['nombre' => 'Liquidación'],
            ['vence' => false]
        );

        $clienteLabel = $liquidacionDistribuidor->liquidacionCliente?->cliente?->nombre_corto
            ?? $liquidacionDistribuidor->liquidacionCliente?->cliente?->razon_social
            ?? 'Cliente';

        $desde = $liquidacionDistribuidor->periodo_desde?->toDateString() ?? (string) $liquidacionDistribuidor->periodo_desde;
        $hasta = $liquidacionDistribuidor->periodo_hasta?->toDateString() ?? (string) $liquidacionDistribuidor->periodo_hasta;

        $nombreOriginal = sprintf(
            'Liquidación (Extractos) - %s - %s al %s - Dist %d',
            $clienteLabel,
            $desde,
            $hasta,
            $personaId
        );

        $disk = LiqV2DocumentoHelper::disk();
        $directory = LiqV2DocumentoHelper::directoryForPersona($personaId);
        $storedPath = LiqV2DocumentoHelper::buildStoredPath($personaId, $liquidacionDistribuidor);
        $legacyTxtPath = LiqV2DocumentoHelper::buildLegacyTxtStoredPath($personaId, $liquidacionDistribuidor);

        $fechaMes = null;
        try {
            $fechaMes = Carbon::parse($hasta)->startOfMonth();
        } catch (\Throwable) {
            $fechaMes = now()->startOfMonth();
        }
        $fortnight = null;
        try {
            $end = Carbon::parse($hasta);
            $fortnight = $end->day <= 15 ? 'Q1' : 'Q2';
        } catch (\Throwable) {
            $fortnight = null;
        }

        // Idempotente por ruta: si existe, reactivar y actualizar.
        $doc = Archivo::withTrashed()
            ->where('persona_id', $personaId)
            ->where('disk', $disk)
            ->whereIn('ruta', [$storedPath, $legacyTxtPath])
            ->first();

        // Si ya existía el .txt viejo, lo migramos a .pdf para no duplicar.
        if ($doc && $doc->ruta === $legacyTxtPath && $legacyTxtPath !== $storedPath) {
            try {
                if (Storage::disk($disk)->exists($legacyTxtPath) && ! Storage::disk($disk)->exists($storedPath)) {
                    Storage::disk($disk)->move($legacyTxtPath, $storedPath);
                }
            } catch (\Throwable) {
                // si falla el move, igual vamos a regenerar el PDF abajo
            }
        }

        // Operaciones incluidas en la liquidación (mismo criterio que generarLiquidaciones).
        $operaciones = LiqOperacion::query()
            ->where('liquidacion_cliente_id', (int) $liquidacionDistribuidor->liquidacion_cliente_id)
            ->where('distribuidor_id', $personaId)
            ->whereIn('estado', ['ok', 'diferencia'])
            ->where('excluida', false)
            ->get();

        $pdf = app(LiqDistribuidorPdfService::class)->renderPdf($liquidacionDistribuidor, $operaciones);

        Storage::disk($disk)->put($storedPath, $pdf);
        $size = Storage::disk($disk)->exists($storedPath) ? (int) (Storage::disk($disk)->size($storedPath) ?? 0) : 0;

        $payload = [
            'persona_id' => $personaId,
            'parent_document_id' => null,
            'liquidacion_id' => null,
            'es_pendiente' => true,
            'tipo_archivo_id' => $tipoLiquidacion->id,
            'carpeta' => $directory,
            'ruta' => $storedPath,
            'download_url' => null,
            'disk' => $disk,
            'nombre_original' => str_ends_with(strtolower($nombreOriginal), '.pdf') ? $nombreOriginal : ($nombreOriginal . '.pdf'),
            'mime' => 'application/pdf',
            'size' => $size,
            'fecha_vencimiento' => $fechaMes,
            'fortnight_key' => $fortnight,
            'importe_facturar' => (float) $liquidacionDistribuidor->total_a_pagar,
            'enviada' => false,
            'recibido' => false,
            'pagado' => false,
            'liquidacion_destinatario_tipo' => null,
            'liquidacion_destinatario_emails' => null,
        ];

        if ($doc) {
            if ($doc->trashed()) {
                $doc->restore();
            }
            $doc->fill($payload);
            $doc->save();
        } else {
            $doc = Archivo::create($payload);
        }

        // Guardar ruta en liqDist (por trazabilidad)
        try {
            $liquidacionDistribuidor->update(['pdf_path' => $storedPath]);
        } catch (\Throwable) {
        }

        // Ajustar timestamps al mes (para que filtre/ordene parecido al resto)
        if ($fechaMes) {
            $doc->created_at = $fechaMes;
            $doc->updated_at = $fechaMes;
            $doc->save();
        }

        // Auditoria
        \App\Models\LiqHistorialAuditoria::registrar(
            'liquidacion_distribuidor', $liquidacionDistribuidor->id, 'regeneracion_pdf',
            null,
            ['documento_id' => $doc->id, 'total' => (float) $liquidacionDistribuidor->total_a_pagar],
            'PDF generado',
            $request->user(), $request->ip()
        );

        // Historial (legacy)
        $distNombre = trim(($liquidacionDistribuidor->distribuidor?->apellidos ?? '') . ' ' . ($liquidacionDistribuidor->distribuidor?->nombres ?? ''));
        LiqHistorialMovimiento::registrar(
            'pdf_generado',
            "PDF generado y subido para {$distNombre} (${$fmtTotal = number_format((float) $liquidacionDistribuidor->total_a_pagar, 2)})",
            $request->user()?->id,
            (int) $liquidacionDistribuidor->liquidacion_cliente_id,
            (int) $liquidacionDistribuidor->id,
            $personaId,
            ['documento_id' => $doc->id, 'total' => (float) $liquidacionDistribuidor->total_a_pagar]
        );

        return response()->json([
            'message' => 'PDF de liquidación creado y vinculado al proveedor.',
            'data' => [
                'documento_id' => (int) $doc->id,
                'ruta' => $storedPath,
                'mime' => 'application/pdf',
            ],
        ], 201);
    }

    // GET /liq/liquidaciones-distribuidor/{liquidacionDistribuidor}/pdf
    public function descargarPdf(LiqLiquidacionDistribuidor $liquidacionDistribuidor)
    {
        $pdfPath = $liquidacionDistribuidor->pdf_path;
        if (!$pdfPath) {
            return response()->json(['error' => 'No se ha generado el PDF aún.'], 404);
        }

        $disk = LiqV2DocumentoHelper::disk();
        if (!Storage::disk($disk)->exists($pdfPath)) {
            return response()->json(['error' => 'El archivo PDF no se encuentra en el storage.'], 404);
        }

        return Storage::disk($disk)->download($pdfPath, basename($pdfPath), [
            'Content-Type' => 'application/pdf',
        ]);
    }
}

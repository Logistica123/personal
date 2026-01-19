<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Archivo;
use App\Models\Factura;
use App\Models\FacturaOcr;
use App\Models\FacturaValidacion;
use App\Models\Persona;
use App\Services\FacturaAi\FacturaValidationService;
use App\Services\FacturaAi\OpenAiFacturaParser;
use App\Services\FacturaAi\PdfTextExtractor;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FacturaAiController extends Controller
{
    public function validar(Request $request, PdfTextExtractor $extractor, OpenAiFacturaParser $parser, FacturaValidationService $validator): JsonResponse
    {
        $validated = $request->validate([
            'archivo' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png'],
            'liquidacionId' => ['nullable', 'integer'],
            'skipCuil' => ['nullable'],
            'skipImporte' => ['nullable'],
        ]);

        $disk = 'public';
        $path = $validated['archivo']->store('facturas', $disk);

        $factura = Factura::create([
            'archivo_path' => $path,
            'archivo_disk' => $disk,
            'estado' => 'pendiente',
        ]);

        $absolutePath = Storage::disk($disk)->path($path);
        $rawText = $extractor->extract($absolutePath);
        $parsed = $parser->parse($rawText);

        $factura->razon_social = $this->stringOrNull($parsed['razon_social'] ?? null);
        $factura->cuit_emisor = $this->normalizeTaxId($parsed['cuit'] ?? null);
        $factura->numero_factura = $this->stringOrNull($parsed['numero_factura'] ?? null);
        $factura->fecha_emision = $this->parseDate($parsed['fecha_emision'] ?? null);
        $factura->tipo_factura = $this->normalizeFacturaType($parsed['tipo_factura'] ?? null);
        $factura->importe_total = $this->parseAmount($parsed['importe_total'] ?? null);
        $factura->iva = $this->parseAmount($parsed['iva'] ?? null);
        $factura->concepto = $this->stringOrNull($parsed['concepto'] ?? null)
            ?? $this->extractConceptFromText($rawText);
        $factura->cbu = $this->stringOrNull($parsed['cbu'] ?? null);

        $liquidacionId = $validated['liquidacionId'] ?? $this->parseLiquidacionId($parsed['liquidacion_id'] ?? null);
        $liquidacion = $this->resolveLiquidacion($liquidacionId);
        $persona = $liquidacion?->persona;

        if ($liquidacion) {
            $factura->liquidacion_id = $liquidacion->id;
            $factura->persona_id = $liquidacion->persona_id;
        }

        $factura->save();

        FacturaOcr::create([
            'factura_id' => $factura->id,
            'raw_text' => $rawText,
            'extracted_json' => $parsed,
            'model' => config('services.openai.model', 'gpt-4o-mini'),
        ]);

        $skipCuil = filter_var($request->input('skipCuil'), FILTER_VALIDATE_BOOL);
        $skipImporte = filter_var($request->input('skipImporte'), FILTER_VALIDATE_BOOL);
        $result = $validator->validate($factura, $liquidacion, $persona, $skipCuil, $skipImporte);
        $factura->estado = $result['decision']['estado'];
        $factura->decision_motivo = $result['decision']['motivo'];
        $factura->decision_mensaje = $result['decision']['mensaje'];
        $factura->save();

        foreach ($result['validations'] as $validation) {
            FacturaValidacion::create([
                'factura_id' => $factura->id,
                'regla' => $validation['regla'],
                'resultado' => $validation['resultado'],
                'mensaje' => $validation['mensaje'],
            ]);
        }

        if ($liquidacion && $factura->estado === 'aprobada') {
            $liquidacion->recibido = true;
            $liquidacion->save();
        }

        return response()->json([
            'data' => [
                'id' => $factura->id,
                'estado' => $factura->estado,
                'decision_motivo' => $factura->decision_motivo,
                'decision_mensaje' => $factura->decision_mensaje,
                'liquidacion_id' => $factura->liquidacion_id,
                'validaciones' => $result['validations'],
            ],
        ]);
    }

    private function resolveLiquidacion(?int $liquidacionId): ?Archivo
    {
        if (! $liquidacionId) {
            return null;
        }

        $documento = Archivo::with('persona', 'tipo')->find($liquidacionId);
        if (! $documento) {
            return null;
        }

        $typeName = Str::lower($documento->tipo?->nombre ?? '');
        $name = Str::lower($documento->nombre_original ?? '');
        if (! Str::contains($typeName, 'liquid') && ! Str::contains($name, 'liquid')) {
            return null;
        }

        return $documento;
    }

    private function parseDate($value): ?string
    {
        if (! $value) {
            return null;
        }

        try {
            return Carbon::parse($value)->format('Y-m-d');
        } catch (\Throwable $exception) {
            return null;
        }
    }

    private function parseAmount($value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        $raw = is_numeric($value) ? (string) $value : (string) $value;
        $normalized = str_replace(['$', ' '], '', $raw);
        if (str_contains($normalized, ',') && str_contains($normalized, '.')) {
            $normalized = str_replace('.', '', $normalized);
            $normalized = str_replace(',', '.', $normalized);
        } elseif (str_contains($normalized, ',')) {
            $normalized = str_replace(',', '.', $normalized);
        }

        return is_numeric($normalized) ? (float) $normalized : null;
    }

    private function normalizeTaxId($value): ?string
    {
        if (! $value) {
            return null;
        }
        $normalized = preg_replace('/\\D+/', '', (string) $value) ?? '';
        return $normalized !== '' ? $normalized : null;
    }

    private function parseLiquidacionId($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        if (preg_match('/\\d+/', (string) $value, $matches)) {
            return (int) $matches[0];
        }

        return null;
    }

    private function normalizeFacturaType($value): ?string
    {
        $trimmed = strtoupper(trim((string) $value));
        if (in_array($trimmed, ['A', 'B', 'C'], true)) {
            return $trimmed;
        }

        return null;
    }

    private function stringOrNull($value): ?string
    {
        $trimmed = trim((string) $value);
        return $trimmed !== '' ? $trimmed : null;
    }

    private function extractConceptFromText(string $text): ?string
    {
        $lines = preg_split("/\\R/", $text) ?: [];
        foreach ($lines as $line) {
            $clean = trim($line);
            if ($clean === '') {
                continue;
            }

            $lower = Str::lower($clean);
            if (Str::contains($lower, 'producto') || Str::contains($lower, 'codigo')) {
                continue;
            }

            if (Str::contains($lower, 'servicio')) {
                return $clean;
            }
        }

        return null;
    }
}

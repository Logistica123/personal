<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivoAsesorComercial;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use ZipArchive;

class ActivoAsesorComercialController extends Controller
{
    private const COMENTARIOS_EDITORS = ['luis', 'david', 'joel', 'dario', 'luciano'];

    public function index(Request $request): JsonResponse
    {
        $this->ensureAuthorized($request);

        $records = ActivoAsesorComercial::query()
            ->orderBy('row_order')
            ->orderBy('id')
            ->get()
            ->map(fn (ActivoAsesorComercial $record) => $this->formatRecord($record))
            ->values();

        return response()->json(['data' => $records]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAuthorized($request);

        $validated = $this->validateRecord($request);

        $asesorComercial = $this->sanitizeString($validated['asesorComercial'] ?? null);
        $record = ActivoAsesorComercial::query()->create([
            'encargado' => $this->sanitizeString($validated['encargado'] ?? null),
            'lider' => $this->sanitizeString($validated['lider'] ?? null),
            'asesor_comercial' => $asesorComercial,
            'rol' => $this->sanitizeString($validated['rol'] ?? null),
            'modalidad_trabajo' => $this->resolveModalidadTrabajo(
                $asesorComercial,
                $this->sanitizeString($validated['modalidadTrabajo'] ?? null)
            ),
            'transportista_activo' => $this->sanitizeString($validated['transportistaActivo'] ?? null),
            'numero' => $this->sanitizeString($validated['numero'] ?? null),
            'comentarios' => $this->canEditComentarios($request)
                ? $this->sanitizeLongText($validated['comentarios'] ?? null)
                : null,
            'cliente' => $this->sanitizeString($validated['cliente'] ?? null),
            'asesor_postventa' => $this->sanitizeString($validated['asesorPostventa'] ?? null),
            'sucursal' => $this->sanitizeString($validated['sucursal'] ?? null),
            'vehiculo' => $this->sanitizeString($validated['vehiculo'] ?? null),
            'fecha_ultima_asignacion' => $this->parseDateValue($validated['fechaUltimaAsignacion'] ?? null),
            'row_order' => ((int) ActivoAsesorComercial::query()->max('row_order')) + 1,
        ]);

        return response()->json([
            'message' => 'Activo agregado correctamente.',
            'data' => $this->formatRecord($record),
        ], 201);
    }

    public function update(Request $request, ActivoAsesorComercial $activoAsesorComercial): JsonResponse
    {
        $this->ensureAuthorized($request);

        $validated = $this->validateRecord($request);

        $attributes = [
            'encargado' => $this->sanitizeString($validated['encargado'] ?? null),
            'lider' => $this->sanitizeString($validated['lider'] ?? null),
            'asesor_comercial' => $this->sanitizeString($validated['asesorComercial'] ?? null),
            'rol' => $this->sanitizeString($validated['rol'] ?? null),
            'transportista_activo' => $this->sanitizeString($validated['transportistaActivo'] ?? null),
            'numero' => $this->sanitizeString($validated['numero'] ?? null),
            'cliente' => $this->sanitizeString($validated['cliente'] ?? null),
            'asesor_postventa' => $this->sanitizeString($validated['asesorPostventa'] ?? null),
            'sucursal' => $this->sanitizeString($validated['sucursal'] ?? null),
            'vehiculo' => $this->sanitizeString($validated['vehiculo'] ?? null),
            'fecha_ultima_asignacion' => $this->parseDateValue($validated['fechaUltimaAsignacion'] ?? null),
        ];

        if (array_key_exists('modalidadTrabajo', $validated)) {
            $attributes['modalidad_trabajo'] = $this->resolveModalidadTrabajo(
                $attributes['asesor_comercial'] ?? null,
                $this->sanitizeString($validated['modalidadTrabajo'] ?? null)
            );
        }

        if ($this->canEditComentarios($request) && array_key_exists('comentarios', $validated)) {
            $attributes['comentarios'] = $this->sanitizeLongText($validated['comentarios'] ?? null);
        }

        $activoAsesorComercial->fill($attributes);
        $activoAsesorComercial->save();

        return response()->json([
            'message' => 'Activo actualizado correctamente.',
            'data' => $this->formatRecord($activoAsesorComercial),
        ]);
    }

    public function destroy(Request $request, ActivoAsesorComercial $activoAsesorComercial): JsonResponse
    {
        $this->ensureAuthorized($request);

        $activoAsesorComercial->delete();

        return response()->json([
            'message' => 'Activo eliminado correctamente.',
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        $this->ensureAuthorized($request);

        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,csv,txt', 'max:20480'],
        ], [
            'file.required' => 'Seleccioná un archivo para importar.',
            'file.mimes' => 'El archivo debe ser .xlsx o .csv.',
        ]);

        $file = $validated['file'];
        $extension = strtolower((string) $file->getClientOriginalExtension());
        if ($extension === 'xls') {
            return response()->json([
                'message' => 'El formato .xls no es compatible. Usá .xlsx o .csv.',
            ], 422);
        }

        $rows = $extension === 'csv' || $extension === 'txt'
            ? $this->parseCsvRows((string) $file->get())
            : $this->parseXlsxRows((string) $file->getRealPath());

        $records = $this->normalizeImportedRows($rows);
        if (empty($records)) {
            return response()->json([
                'message' => 'No se encontraron filas válidas para importar.',
            ], 422);
        }

        $persisted = DB::transaction(function () use ($records) {
            ActivoAsesorComercial::query()->delete();

            foreach ($records as $index => $record) {
                ActivoAsesorComercial::query()->create([
                    'encargado' => $record['encargado'],
                    'lider' => $record['lider'],
                    'asesor_comercial' => $record['asesor_comercial'],
                    'rol' => $record['rol'],
                    'modalidad_trabajo' => $record['modalidad_trabajo'] ?? $this->resolveModalidadTrabajo($record['asesor_comercial'], null),
                    'transportista_activo' => $record['transportista_activo'],
                    'numero' => $record['numero'],
                    'comentarios' => null,
                    'cliente' => $record['cliente'] ?? null,
                    'asesor_postventa' => $record['asesor_postventa'] ?? null,
                    'sucursal' => $record['sucursal'] ?? null,
                    'vehiculo' => $record['vehiculo'] ?? null,
                    'fecha_ultima_asignacion' => $record['fecha_ultima_asignacion'] ?? null,
                    'row_order' => $index + 1,
                ]);
            }

            return ActivoAsesorComercial::query()
                ->orderBy('row_order')
                ->orderBy('id')
                ->get();
        });

        return response()->json([
            'message' => 'Base importada correctamente.',
            'data' => $persisted->map(fn (ActivoAsesorComercial $record) => $this->formatRecord($record))->values(),
            'meta' => [
                'imported' => $persisted->count(),
                'fileName' => $file->getClientOriginalName(),
            ],
        ]);
    }

    private function ensureAuthorized(Request $request): void
    {
        $user = $request->user();
        $role = strtolower(trim((string) ($user?->role ?? '')));
        $permissions = $user?->permissions ?? null;
        $hasPermission = is_array($permissions) && in_array('bdd-activos-asesores', $permissions, true);
        $allowedByRole = in_array($role, ['admin', 'admin2', 'asesor'], true);

        if ($allowedByRole || $hasPermission) {
            return;
        }

        abort(response()->json([
            'message' => 'No tenés permisos para gestionar la BDD de activos por asesores comerciales.',
        ], 403));
    }

    private function validateRecord(Request $request): array
    {
        return $request->validate([
            'encargado' => ['nullable', 'string', 'max:255'],
            'lider' => ['nullable', 'string', 'max:255'],
            'asesorComercial' => ['nullable', 'string', 'max:255'],
            'rol' => ['nullable', 'string', 'max:255'],
            'modalidadTrabajo' => ['nullable', 'string', 'max:255'],
            'transportistaActivo' => ['nullable', 'string', 'max:255'],
            'numero' => ['nullable', 'string', 'max:255'],
            'comentarios' => ['nullable', 'string', 'max:2000'],
            'cliente' => ['nullable', 'string', 'max:255'],
            'asesorPostventa' => ['nullable', 'string', 'max:255'],
            'sucursal' => ['nullable', 'string', 'max:255'],
            'vehiculo' => ['nullable', 'string', 'max:255'],
            'fechaUltimaAsignacion' => ['nullable', 'date'],
        ]);
    }

    private function formatRecord(ActivoAsesorComercial $record): array
    {
        return [
            'id' => $record->id,
            'encargado' => $record->encargado,
            'lider' => $record->lider,
            'asesorComercial' => $record->asesor_comercial,
            'rol' => $record->rol,
            'modalidadTrabajo' => $record->modalidad_trabajo,
            'transportistaActivo' => $record->transportista_activo,
            'numero' => $record->numero,
            'comentarios' => $record->comentarios,
            'cliente' => $record->cliente,
            'asesorPostventa' => $record->asesor_postventa,
            'sucursal' => $record->sucursal,
            'vehiculo' => $record->vehiculo,
            'fechaUltimaAsignacion' => optional($record->fecha_ultima_asignacion)->toIso8601String(),
            'rowOrder' => $record->row_order,
            'updatedAt' => optional($record->updated_at)->toIso8601String(),
        ];
    }

    private function sanitizeString(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function sanitizeLongText(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function parseDateValue(mixed $value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            return Carbon::parse((string) $value);
        } catch (\Throwable) {
            return null;
        }
    }

    private function resolveModalidadTrabajo(?string $asesorComercial, ?string $explicitValue): string
    {
        $value = $this->sanitizeString($explicitValue);
        if ($value !== null) {
            return $value;
        }

        $normalizedAsesor = Str::of((string) ($asesorComercial ?? ''))
            ->lower()
            ->ascii()
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->toString();

        if (Str::contains($normalizedAsesor, ['sofia', 'cecilia'])) {
            return 'Remoto';
        }

        return 'Presencial';
    }

    private function canEditComentarios(Request $request): bool
    {
        $user = $request->user();
        $name = Str::of((string) ($user?->name ?? ''))
            ->lower()
            ->ascii()
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->toString();

        $firstName = explode(' ', $name)[0] ?? '';
        if ($firstName !== '' && in_array($firstName, self::COMENTARIOS_EDITORS, true)) {
            return true;
        }

        $email = Str::of((string) ($user?->email ?? ''))
            ->lower()
            ->trim()
            ->toString();
        $emailName = $email !== '' ? explode('@', $email)[0] : '';

        return $emailName !== '' && in_array($emailName, self::COMENTARIOS_EDITORS, true);
    }

    private function parseCsvRows(string $contents): array
    {
        $lines = preg_split('/\r\n|\n|\r/', $contents) ?: [];
        $lines = array_values(array_filter($lines, fn ($line) => trim((string) $line) !== ''));
        if (empty($lines)) {
            return [];
        }

        $sample = $lines[0] ?? '';
        $delimiter = substr_count($sample, ';') > substr_count($sample, ',') ? ';' : ',';

        return array_map(
            fn ($line) => array_map(
                fn ($value) => is_string($value) ? trim($value) : (string) $value,
                str_getcsv($line, $delimiter)
            ),
            $lines
        );
    }

    private function parseXlsxRows(string $path): array
    {
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            return [];
        }

        try {
            $sharedStrings = $this->readSharedStrings($zip);
            $sheetPath = $this->resolveFirstSheetPath($zip);
            if ($sheetPath === null) {
                return [];
            }

            $sheetXml = $zip->getFromName($sheetPath);
            if (! is_string($sheetXml) || trim($sheetXml) === '') {
                return [];
            }

            return $this->extractRowsFromWorksheetXml($sheetXml, $sharedStrings);
        } finally {
            $zip->close();
        }
    }

    private function readSharedStrings(ZipArchive $zip): array
    {
        $xml = $zip->getFromName('xl/sharedStrings.xml');
        if (! is_string($xml) || trim($xml) === '') {
            return [];
        }

        $dom = @simplexml_load_string($xml);
        if (! $dom) {
            return [];
        }

        $dom->registerXPathNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
        $nodes = $dom->xpath('//x:si') ?: [];
        $values = [];

        foreach ($nodes as $node) {
            $values[] = $this->extractXmlNodeText($node);
        }

        return $values;
    }

    private function resolveFirstSheetPath(ZipArchive $zip): ?string
    {
        $workbookXml = $zip->getFromName('xl/workbook.xml');
        $relsXml = $zip->getFromName('xl/_rels/workbook.xml.rels');

        if (! is_string($workbookXml) || ! is_string($relsXml)) {
            return $zip->locateName('xl/worksheets/sheet1.xml') !== false ? 'xl/worksheets/sheet1.xml' : null;
        }

        $workbook = @simplexml_load_string($workbookXml);
        $rels = @simplexml_load_string($relsXml);
        if (! $workbook || ! $rels) {
            return $zip->locateName('xl/worksheets/sheet1.xml') !== false ? 'xl/worksheets/sheet1.xml' : null;
        }

        $workbook->registerXPathNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
        $workbook->registerXPathNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships');
        $rels->registerXPathNamespace('pr', 'http://schemas.openxmlformats.org/package/2006/relationships');

        $sheet = ($workbook->xpath('//x:sheets/x:sheet') ?: [])[0] ?? null;
        if (! $sheet) {
            return $zip->locateName('xl/worksheets/sheet1.xml') !== false ? 'xl/worksheets/sheet1.xml' : null;
        }

        $relationshipId = (string) ($sheet->attributes('r', true)->id ?? '');
        if ($relationshipId === '') {
            return $zip->locateName('xl/worksheets/sheet1.xml') !== false ? 'xl/worksheets/sheet1.xml' : null;
        }

        foreach ($rels->Relationship ?? [] as $relationship) {
            if ((string) ($relationship['Id'] ?? '') !== $relationshipId) {
                continue;
            }

            $target = (string) ($relationship['Target'] ?? '');
            if ($target === '') {
                return null;
            }

            if (! str_starts_with($target, 'xl/')) {
                $target = 'xl/' . ltrim($target, '/');
            }

            return $target;
        }

        return $zip->locateName('xl/worksheets/sheet1.xml') !== false ? 'xl/worksheets/sheet1.xml' : null;
    }

    private function extractRowsFromWorksheetXml(string $sheetXml, array $sharedStrings): array
    {
        $dom = @simplexml_load_string($sheetXml);
        if (! $dom) {
            return [];
        }

        $dom->registerXPathNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
        $rowNodes = $dom->xpath('//x:sheetData/x:row') ?: [];
        $rows = [];

        foreach ($rowNodes as $rowNode) {
            $cells = [];
            $maxIndex = -1;

            foreach ($rowNode->c ?? [] as $cellNode) {
                $reference = (string) ($cellNode['r'] ?? '');
                $columnIndex = $this->extractColumnIndexFromReference($reference);
                $cells[$columnIndex] = $this->extractWorksheetCellValue($cellNode, $sharedStrings);
                $maxIndex = max($maxIndex, $columnIndex);
            }

            if ($maxIndex < 0) {
                continue;
            }

            $row = [];
            for ($index = 0; $index <= $maxIndex; $index++) {
                $row[] = $cells[$index] ?? '';
            }

            $rows[] = $row;
        }

        return $rows;
    }

    private function extractWorksheetCellValue(\SimpleXMLElement $cellNode, array $sharedStrings): string
    {
        $type = (string) ($cellNode['t'] ?? '');
        if ($type === 'inlineStr') {
            return $this->extractXmlNodeText($cellNode);
        }

        $rawValue = isset($cellNode->v) ? trim((string) $cellNode->v) : '';

        if ($type === 's') {
            $index = (int) $rawValue;
            return isset($sharedStrings[$index]) ? trim((string) $sharedStrings[$index]) : '';
        }

        return trim($rawValue);
    }

    private function extractXmlNodeText(\SimpleXMLElement $node): string
    {
        $domNode = dom_import_simplexml($node);
        if (! $domNode) {
            return trim((string) $node);
        }

        return trim((string) $domNode->textContent);
    }

    private function extractColumnIndexFromReference(string $reference): int
    {
        if (! preg_match('/^[A-Z]+/i', $reference, $matches)) {
            return 0;
        }

        $letters = strtoupper($matches[0]);
        $index = 0;

        foreach (str_split($letters) as $letter) {
            $index = ($index * 26) + (ord($letter) - 64);
        }

        return max(0, $index - 1);
    }

    private function normalizeImportedRows(array $rows): array
    {
        if (empty($rows)) {
            return [];
        }

        $headerRowIndex = null;
        $columnMap = null;

        foreach ($rows as $index => $row) {
            $map = $this->resolveImportColumnMap($row);
            if ($map !== null) {
                $headerRowIndex = $index;
                $columnMap = $map;
                break;
            }
        }

        if ($headerRowIndex === null || $columnMap === null) {
            return [];
        }

        $records = [];
        foreach (array_slice($rows, $headerRowIndex + 1) as $row) {
            $asesorComercial = $this->cellValueOptional($row, $columnMap['asesor comercial'] ?? null);
            $record = [
                'encargado' => $this->cellValue($row, $columnMap['encargado']),
                'lider' => $this->cellValue($row, $columnMap['lider']),
                'asesor_comercial' => $asesorComercial,
                'rol' => $this->cellValue($row, $columnMap['rol']),
                'modalidad_trabajo' => $this->resolveModalidadTrabajo(
                    $asesorComercial,
                    $this->cellValueOptional($row, $columnMap['modalidad de trabajo'] ?? null)
                ),
                'transportista_activo' => $this->cellValue($row, $columnMap['transportista activo']),
                'numero' => $this->cellValue($row, $columnMap['numero']),
                'cliente' => $this->cellValueOptional($row, $columnMap['cliente'] ?? null),
                'asesor_postventa' => $this->cellValueOptional($row, $columnMap['asesor de postventa'] ?? null)
                    ?? $this->cellValueOptional($row, $columnMap['asesor postventa'] ?? null),
                'sucursal' => $this->cellValueOptional($row, $columnMap['sucursal'] ?? null),
                'vehiculo' => $this->cellValueOptional($row, $columnMap['vehiculo'] ?? null),
                'fecha_ultima_asignacion' => $this->parseDateValue(
                    $this->cellValueOptional($row, $columnMap['fecha ultima asignacion'] ?? null)
                ),
            ];

            $hasAnyValue = collect($record)->contains(fn ($value) => $value !== null && $value !== '');
            if ($hasAnyValue) {
                $records[] = $record;
            }
        }

        return $records;
    }

    private function resolveImportColumnMap(array $row): ?array
    {
        $normalizedHeaders = [];

        foreach ($row as $index => $header) {
            $normalized = $this->normalizeHeader((string) $header);
            if ($normalized !== '') {
                $normalizedHeaders[$normalized] = $index;
            }
        }

        $required = [
            'encargado',
            'lider',
            'asesor comercial',
            'rol',
            'transportista activo',
            'numero',
        ];

        foreach ($required as $key) {
            if (! array_key_exists($key, $normalizedHeaders)) {
                return null;
            }
        }

        return $normalizedHeaders;
    }

    private function normalizeHeader(string $value): string
    {
        return Str::of($value)
            ->lower()
            ->ascii()
            ->replace(['(', ')', '-', '_'], ' ')
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->toString();
    }

    private function cellValue(array $row, int $index): ?string
    {
        $value = $row[$index] ?? null;
        if (! is_string($value) && ! is_numeric($value)) {
            return null;
        }

        return $this->sanitizeString((string) $value);
    }

    private function cellValueOptional(array $row, ?int $index): ?string
    {
        if ($index === null) {
            return null;
        }

        return $this->cellValue($row, $index);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CierreDiario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use ZipArchive;

class CierreDiarioController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureAuthorized($request);

        $validated = $request->validate([
            'fecha' => ['nullable', 'date'],
            'asesor_comercial' => ['nullable', 'string', 'max:255'],
            'sucursal' => ['nullable', 'string', 'max:255'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = CierreDiario::query()->orderBy('id');

        if (! empty($validated['fecha'])) {
            $query->whereDate('fecha_importacion', $validated['fecha']);
        }

        if (! empty($validated['asesor_comercial'])) {
            $query->where('asesor_comercial', 'like', '%' . $validated['asesor_comercial'] . '%');
        }

        if (! empty($validated['sucursal'])) {
            $query->where('sucursal', $validated['sucursal']);
        }

        $perPage = (int) ($validated['per_page'] ?? 200);
        $paginator = $query->paginate($perPage, ['*'], 'page', $validated['page'] ?? 1);

        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function fechas(Request $request): JsonResponse
    {
        $this->ensureAuthorized($request);

        $fechas = CierreDiario::query()
            ->select('fecha_importacion')
            ->distinct()
            ->orderByDesc('fecha_importacion')
            ->pluck('fecha_importacion')
            ->map(fn ($date) => $date instanceof Carbon ? $date->toDateString() : (string) $date)
            ->values();

        return response()->json(['data' => $fechas]);
    }

    public function debug(Request $request): JsonResponse
    {
        $this->ensureAuthorized($request);

        $validated = $request->validate([
            'file' => ['required', 'file', 'max:20480'],
        ]);

        $file = $validated['file'];
        $extension = strtolower((string) $file->getClientOriginalExtension());

        $rows = $extension === 'csv' || $extension === 'txt'
            ? $this->parseCsvRows((string) $file->get())
            : $this->parseXlsxRows((string) $file->getRealPath());

        $firstRows = array_slice($rows, 0, 5);
        $normalizedFirstRow = [];
        if (! empty($rows[0])) {
            foreach ($rows[0] as $i => $cell) {
                $normalizedFirstRow[$i] = [
                    'raw' => $cell,
                    'normalized' => $this->normalizeHeader((string) $cell),
                ];
            }
        }

        return response()->json([
            'total_rows' => count($rows),
            'first_rows' => $firstRows,
            'normalized_headers' => $normalizedFirstRow,
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        $this->ensureAuthorized($request);

        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,csv,txt', 'max:20480'],
            'fecha' => ['nullable', 'date'],
            'append' => ['nullable', 'boolean'],
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

        if (empty($rows)) {
            return response()->json([
                'message' => 'El archivo está vacío o no se pudo leer. Intentá exportarlo de nuevo desde Kommo.',
            ], 422);
        }

        $records = $this->normalizeImportedRows($rows);

        if (empty($records)) {
            $headerSample = array_slice($rows[0] ?? [], 0, 6);
            $headerText = implode(' | ', array_filter(array_map('strval', $headerSample)));
            return response()->json([
                'message' => "No se encontraron filas válidas. Encabezados detectados: [{$headerText}]. "
                    . 'Asegurate de subir el export directo de Kommo (Excel).',
            ], 422);
        }

        $fechaImportacion = ! empty($validated['fecha'])
            ? Carbon::parse($validated['fecha'])->toDateString()
            : Carbon::today()->toDateString();

        $append = filter_var($validated['append'] ?? true, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        $append = $append ?? true;

        $user = $request->user();
        $importadoPor = $user?->email ?? $user?->name ?? null;

        $stats = DB::transaction(function () use ($records, $fechaImportacion, $importadoPor, $append) {
            $deleted = 0;
            if (! $append) {
                $deleted = CierreDiario::query()
                    ->whereDate('fecha_importacion', $fechaImportacion)
                    ->delete();
            }

            $created = 0;
            $updated = 0;

            $leadIds = array_values(array_filter(array_map(
                fn ($record) => $record['lead_id'] ?? null,
                $records
            ), fn ($leadId) => is_int($leadId) || ctype_digit((string) $leadId)));

            $existingByLeadId = [];
            if (! empty($leadIds)) {
                $existingByLeadId = CierreDiario::query()
                    ->select(['id', 'lead_id'])
                    ->whereDate('fecha_importacion', $fechaImportacion)
                    ->whereIn('lead_id', $leadIds)
                    ->get()
                    ->keyBy('lead_id')
                    ->all();
            }

            foreach ($records as $record) {
                $payload = [
                    'fecha_importacion' => $fechaImportacion,
                    'fecha_lead' => $record['fecha_lead'],
                    'lead_id' => $record['lead_id'],
                    'contacto' => $record['contacto'],
                    'estatus_lead' => $record['estatus_lead'],
                    'etiquetas_lead' => $record['etiquetas_lead'],
                    'sucursal' => $record['sucursal'],
                    'vehiculo' => $record['vehiculo'],
                    'empresa' => $record['empresa'],
                    'embudo' => $record['embudo'],
                    'nombre_distribuidor' => $record['nombre_distribuidor'],
                    'asesor_comercial' => $record['asesor_comercial'],
                    'mes' => $record['mes'],
                    'semana' => $record['semana'],
                    'dia' => $record['dia'],
                    'importado_por' => $importadoPor,
                ];

                $leadId = $record['lead_id'] ?? null;
                if ($leadId !== null && isset($existingByLeadId[$leadId])) {
                    $existingId = (int) $existingByLeadId[$leadId]->id;
                    CierreDiario::query()->whereKey($existingId)->update($payload);
                    $updated++;
                    continue;
                }

                $model = CierreDiario::query()->create($payload);
                $created++;
                if ($leadId !== null) {
                    $existingByLeadId[$leadId] = $model;
                }
            }

            return [
                'created' => $created,
                'updated' => $updated,
                'deleted' => $deleted,
                'total' => count($records),
            ];
        });

        return response()->json([
            'message' => "Cierre importado correctamente: {$stats['created']} nuevos, {$stats['updated']} actualizados para {$fechaImportacion}.",
            'meta' => [
                'imported' => $stats['total'],
                'created' => $stats['created'],
                'updated' => $stats['updated'],
                'deleted' => $stats['deleted'],
                'append' => $append,
                'fecha_importacion' => $fechaImportacion,
                'fileName' => $file->getClientOriginalName(),
            ],
        ], 201);
    }

    public function destroyByFecha(Request $request, string $fecha): JsonResponse
    {
        $this->ensureAuthorized($request);

        try {
            $date = Carbon::parse($fecha)->toDateString();
        } catch (\Throwable) {
            return response()->json(['message' => 'Fecha inválida.'], 422);
        }

        $deleted = CierreDiario::query()
            ->whereDate('fecha_importacion', $date)
            ->delete();

        return response()->json([
            'message' => "Se eliminaron {$deleted} registros del cierre del {$date}.",
        ]);
    }

    private function ensureAuthorized(Request $request): void
    {
        $user = $request->user();
        $role = strtolower(trim((string) ($user?->role ?? '')));
        $permissions = $user?->permissions ?? null;
        $hasPermission = is_array($permissions) && in_array('asesoria-cierres', $permissions, true);
        $allowedByRole = in_array($role, ['admin', 'admin2', 'encargado'], true);

        if ($allowedByRole || $hasPermission) {
            return;
        }

        abort(response()->json([
            'message' => 'No tenés permisos para acceder a los cierres diarios.',
        ], 403));
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

        $candidates = $this->resolveFieldColumnCandidates($columnMap);

        $records = [];
        foreach (array_slice($rows, $headerRowIndex + 1) as $row) {
            $leadIdRaw = $this->firstNonEmptyCellValue($row, $candidates['id'] ?? []);
            $leadId = is_numeric($leadIdRaw) ? (int) $leadIdRaw : null;

            $fechaLead = $this->parseDateFromCell(
                $this->firstNonEmptyCellValue($row, $candidates['fecha'] ?? [])
            );

            $mesRaw = $this->firstNonEmptyCellValue($row, $candidates['mes'] ?? []);
            $semanaRaw = $this->firstNonEmptyCellValue($row, $candidates['semana'] ?? []);
            $diaRaw = $this->firstNonEmptyCellValue($row, $candidates['dia'] ?? []);

            $record = [
                'fecha_lead' => $fechaLead,
                'lead_id' => $leadId,
                'contacto' => $this->firstNonEmptyCellValue($row, $candidates['contacto'] ?? []),
                'estatus_lead' => $this->firstNonEmptyCellValue($row, $candidates['estatus_lead'] ?? []),
                'etiquetas_lead' => $this->firstNonEmptyCellValue($row, $candidates['etiquetas_lead'] ?? []),
                'sucursal' => $this->firstNonEmptyCellValue($row, $candidates['sucursal'] ?? []),
                'vehiculo' => $this->firstNonEmptyCellValue($row, $candidates['vehiculo'] ?? []),
                'empresa' => $this->firstNonEmptyCellValue($row, $candidates['empresa'] ?? []),
                'embudo' => $this->firstNonEmptyCellValue($row, $candidates['embudo'] ?? []),
                'nombre_distribuidor' => $this->firstNonEmptyCellValue($row, $candidates['nombre_distribuidor'] ?? []),
                'asesor_comercial' => $this->firstNonEmptyCellValue($row, $candidates['asesor_comercial'] ?? []),
                'mes' => is_numeric($mesRaw) ? (int) $mesRaw : ($fechaLead?->month),
                'semana' => $this->normalizeSemanaValue($semanaRaw, $fechaLead),
                'dia' => is_numeric($diaRaw) ? (int) $diaRaw : ($fechaLead?->day),
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

        // Accept the row as header if it has at least 4 non-empty cells
        // or contains any recognizable Kommo column name
        $nonEmpty = count($normalizedHeaders);
        if ($nonEmpty < 4) {
            return null;
        }

        $kommoColumns = ['estatus del lead', 'extraer contacto', 'embudo', 'asesor comercial',
            'nombre distribuidor', 'etiquetas del lead', 'sucursal', 'vehiculo'];
        $hasKommoColumn = false;
        foreach ($kommoColumns as $col) {
            if (array_key_exists($col, $normalizedHeaders)) {
                $hasKommoColumn = true;
                break;
            }
        }

        // Accept if it has a known Kommo column OR has many non-empty cells (>=6) and looks like a header
        if ($hasKommoColumn || $nonEmpty >= 6) {
            return $normalizedHeaders;
        }

        return null;
    }

    private function normalizeHeader(string $value): string
    {
        return Str::of($value)
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9]+/', ' ')
            ->trim()
            ->toString();
    }

    private function resolveFieldColumnCandidates(array $columnMap): array
    {
        $candidates = [
            'id' => ['id', 'id del lead', 'lead id'],
            'fecha' => ['fecha', 'fecha lead', 'fecha del lead', 'fecha de creacion', 'fecha de altas'],
            'contacto' => [
                'extraer contacto',
                'telefono celular contacto',
                'telefono oficina contacto',
                'telefono oficina directo contacto',
                'otro telefono contacto',
                'telefono de casa contacto',
                'contacto principal',
            ],
            'estatus_lead' => ['estatus del lead', 'estatus'],
            'etiquetas_lead' => ['etiquetas del lead', 'etiquetas'],
            'sucursal' => ['sucursal'],
            'vehiculo' => ['vehiculo'],
            'empresa' => ['empresa', 'compania', 'compania del lead'],
            'embudo' => ['embudo', 'embudo de ventas'],
            'nombre_distribuidor' => ['nombre distribuidor', 'distribuidor'],
            'asesor_comercial' => ['asesor comercial', 'responsable', 'modificado por', 'autor'],
            'mes' => ['mes'],
            'semana' => ['semana'],
            'dia' => ['dia'],
        ];

        $resolved = [];
        foreach ($candidates as $field => $aliases) {
            $indexes = [];
            foreach ($aliases as $alias) {
                $normalized = $this->normalizeHeader($alias);
                if ($normalized === '') {
                    continue;
                }
                if (array_key_exists($normalized, $columnMap)) {
                    $indexes[] = (int) $columnMap[$normalized];
                }
            }

            $resolved[$field] = array_values(array_unique($indexes));
        }

        return $resolved;
    }

    private function firstNonEmptyCellValue(array $row, array $indexes): ?string
    {
        foreach ($indexes as $index) {
            $value = $this->cellValueOptional($row, is_int($index) ? $index : null);
            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    private function parseDateFromCell(?string $value): ?Carbon
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $value = trim($value);

        // Excel serial number (e.g. "46113" for Feb 26, 2026)
        if (is_numeric($value) && ! str_contains($value, '-') && ! str_contains($value, '/')) {
            $serial = (float) $value;
            if ($serial > 1 && $serial < 150000) {
                try {
                    return Carbon::create(1899, 12, 30)->addDays((int) $serial);
                } catch (\Throwable) {}
            }
        }

        // Try common date string formats (Kommo exports can vary by locale and file type)
        $formats = [
            'n/j/Y', 'n/j/y',
            'd/m/Y', 'd/m/y', 'd/m/Y H:i', 'd/m/Y H:i:s',
            'd.m.Y', 'd.m.y', 'd.m.Y H:i', 'd.m.Y H:i:s',
            'Y-m-d', 'Y-m-d H:i', 'Y-m-d H:i:s',
            'd-m-Y', 'd-m-Y H:i', 'd-m-Y H:i:s',
        ];
        foreach ($formats as $format) {
            try {
                return Carbon::createFromFormat($format, $value)->startOfDay();
            } catch (\Throwable) {}
        }

        try {
            return Carbon::parse($value)->startOfDay();
        } catch (\Throwable) {}

        return null;
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

    private function sanitizeString(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);
        if (str_starts_with($trimmed, "'")) {
            $withoutApostrophe = ltrim(substr($trimmed, 1));
            if ($withoutApostrophe !== '' && preg_match('/^[+0-9]/', $withoutApostrophe) === 1) {
                $trimmed = $withoutApostrophe;
            }
        }

        return $trimmed === '' ? null : $trimmed;
    }

    private function normalizeSemanaValue(?string $rawValue, ?Carbon $fechaLead): ?int
    {
        if (is_numeric($rawValue)) {
            $value = (int) $rawValue;
            if ($value >= 1 && $value <= 4) {
                return $value;
            }
        }

        if ($fechaLead === null) {
            return null;
        }

        // Semana dentro del mes: 1..4 (22..fin de mes => 4)
        return min(4, (int) floor(($fechaLead->day - 1) / 7) + 1);
    }

    // ─── XLSX / CSV parsing (same approach as ActivoAsesorComercialController) ───

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
}

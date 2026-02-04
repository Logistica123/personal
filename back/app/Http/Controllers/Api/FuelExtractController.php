<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Distributor;
use App\Models\DistributorDomain;
use App\Models\FuelMovement;
use App\Models\FuelReport;
use App\Models\Persona;
use App\Models\PersonalNotification;
use App\Services\AuditLogger;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use ZipArchive;

class FuelExtractController extends Controller
{
    public function preview(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'max:5120'],
        ]);

        $file = $request->file('file');
        if (!$file) {
            return response()->json(['message' => 'Archivo no recibido.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $extension = strtolower((string) $file->getClientOriginalExtension());
        if ($extension === 'xls') {
            return response()->json(
                ['message' => 'El formato .xls no es compatible. Usa .xlsx o .csv.'],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        if (!in_array($extension, ['xlsx', 'csv'], true)) {
            return response()->json(['message' => 'Formato de archivo inválido.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $path = $file->getRealPath();
        if (!$path) {
            return response()->json(['message' => 'No se pudo leer el archivo.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $meta = [];
        $preferredSheet = $request->input('sheet');
        if ($extension === 'csv') {
            [$columns, $rows, $rowCount, $meta] = $this->parseCsvPreview($path, 20);
        } else {
            [$columns, $rows, $rowCount, $meta] = $this->parseXlsxPreview($path, 20, $preferredSheet);
        }

        $mapping = $this->mapPreviewRows($columns, $rows);
        $columns = $mapping['mapped'] ? $mapping['columns'] : $columns;
        $rows = $mapping['mapped'] ? $mapping['rows'] : $rows;
        $stats = null;

        if ($mapping['mapped']) {
            $validation = $this->validateMappedRows($columns, $rows);
            $columns = $validation['columns'];
            $rows = $validation['rows'];
            $stats = $validation['stats'];
        }

        return response()->json([
            'columns' => $columns,
            'rows' => $rows,
            'rowCount' => $rowCount,
            'previewCount' => count($rows),
            'mapped' => $mapping['mapped'],
            'unmappedColumns' => $mapping['unmappedColumns'],
            'stats' => $stats,
            'debug' => $request->boolean('debug') ? $meta : null,
        ]);
    }

    public function process(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'max:5120'],
        ]);

        $file = $request->file('file');
        if (!$file) {
            return response()->json(['message' => 'Archivo no recibido.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $extension = strtolower((string) $file->getClientOriginalExtension());
        if ($extension === 'xls') {
            return response()->json(
                ['message' => 'El formato .xls no es compatible. Usa .xlsx o .csv.'],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        if (!in_array($extension, ['xlsx', 'csv'], true)) {
            return response()->json(['message' => 'Formato de archivo inválido.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $path = $file->getRealPath();
        if (!$path) {
            return response()->json(['message' => 'No se pudo leer el archivo.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $preferredSheet = $request->input('sheet');
        if ($extension === 'csv') {
            [$columns, $rows, $rowCount] = $this->parseCsvPreview($path, 1000000);
        } else {
            [$columns, $rows, $rowCount] = $this->parseXlsxPreview($path, 1000000, $preferredSheet);
        }

        $mapping = $this->mapPreviewRows($columns, $rows);
        if (!$mapping['mapped']) {
            return response()->json(
                ['message' => 'No se pudieron mapear columnas al formato general.'],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $validation = $this->validateMappedRows($mapping['columns'], $mapping['rows']);
        $columns = $validation['columns'];
        $rows = $validation['rows'];
        $stats = $validation['stats'];

        $columnIndexes = [];
        foreach ($columns as $index => $name) {
            $columnIndexes[$name] = $index;
        }

        $importedBy = $request->user()?->id;
        $provider = $request->input('provider');
        $format = $request->input('format');
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');
        $originalName = $file->getClientOriginalName();
        $autoAssign = $request->boolean('auto_assign_conductor', true);

        $inserted = 0;
        $ignoredDuplicates = 0;
        $observed = 0;
        $lateCharges = 0;
        $consumptionByDomain = [];

        foreach ($rows as $rowIndex => $row) {
            $statusIndex = $columnIndexes['Estado'] ?? null;
            $status = $statusIndex !== null ? (string) ($row[$statusIndex] ?? '') : 'OBSERVED';
            $observationsIndex = $columnIndexes['Observaciones'] ?? null;
            $observations = $observationsIndex !== null ? (string) ($row[$observationsIndex] ?? '') : '';

            $domainRaw = $this->getRowValue($row, $columnIndexes, 'Dominio');
            $domainNorm = $this->normalizeDomain($domainRaw);
            $dateRaw = $this->getRowValue($row, $columnIndexes, 'Fecha');
            $station = $this->getRowValue($row, $columnIndexes, 'Estación');
            $product = $this->getRowValue($row, $columnIndexes, 'Producto');
            $conductor = $this->getRowValue($row, $columnIndexes, 'Conductor');
            $litersRaw = $this->getRowValue($row, $columnIndexes, 'Litros');
            $amountRaw = $this->getRowValue($row, $columnIndexes, 'Importe');
            $priceRaw = $this->getRowValue($row, $columnIndexes, 'Precio/Litro');

            $occurredAt = $this->parseDate($dateRaw);
            $liters = $this->parseNumber($litersRaw);
            $amount = $this->parseNumber($amountRaw);
            $price = $this->parseNumber($priceRaw);
            if ($liters !== null && $amount !== null) {
                $liters = $this->normalizeLiters($liters, $price, $amount);
            }

            $hash = strtolower($domainNorm . '|' . $dateRaw . '|' . $amountRaw . '|' . $litersRaw . '|' . $station);

            $movementStatus = $status === 'VALID' ? 'IMPORTED' : $status;
            if ($hash !== '||||' && FuelMovement::query()->where('duplicate_hash', $hash)->exists()) {
                $movementStatus = 'DUPLICATE';
                $observations = trim($observations . ' Duplicado.');
            }

            $distributorId = $domainNorm !== '' ? $this->resolveDistributorId($domainNorm, $conductor, $autoAssign) : null;
            $lateCharge = false;
            $lateReportId = null;
            if ($distributorId && $occurredAt) {
                $occurredDate = $occurredAt->toDateString();
                $lateReport = FuelReport::query()
                    ->where('distributor_id', $distributorId)
                    ->where('status', 'APPLIED')
                    ->whereNotNull('period_from')
                    ->whereNotNull('period_to')
                    ->whereRaw('? >= period_from AND ? <= period_to', [$occurredDate, $occurredDate])
                    ->orderByDesc('id')
                    ->first();

                if ($lateReport) {
                    $lateCharge = true;
                    $lateReportId = $lateReport->id;
                    $observations = trim($observations . ' Carga tardía.');
                }
            }
            if ($movementStatus === 'IMPORTED') {
                $movementStatus = $distributorId ? 'IMPUTED' : 'PENDING_MATCH';
            }
            if ($lateCharge) {
                $movementStatus = 'OBSERVED';
                $lateCharges += 1;
            }
            if ($movementStatus === 'DUPLICATE') {
                $ignoredDuplicates += 1;
                continue;
            } elseif ($movementStatus === 'OBSERVED') {
                $observed += 1;
            }

            FuelMovement::query()->create([
                'occurred_at' => $occurredAt,
                'station' => $station,
                'domain_raw' => $domainRaw,
                'domain_norm' => $domainNorm,
                'product' => $product,
                'conductor' => $conductor,
                'liters' => $liters,
                'amount' => $amount,
                'price_per_liter' => $price,
                'status' => $movementStatus,
                'observations' => $observations,
                'source_file' => $originalName,
                'source_row' => $rowIndex + 2,
                'duplicate_hash' => $hash,
                'provider' => is_string($provider) ? $provider : null,
                'format' => is_string($format) ? $format : null,
                'period_from' => is_string($dateFrom) ? $dateFrom : null,
                'period_to' => is_string($dateTo) ? $dateTo : null,
                'imported_by' => $importedBy,
                'distributor_id' => $distributorId,
                'discounted' => false,
                'late_charge' => $lateCharge,
                'late_report_id' => $lateReportId,
            ]);

            if ($domainNorm !== '' && $movementStatus !== 'DUPLICATE') {
                if (! isset($consumptionByDomain[$domainNorm])) {
                    $consumptionByDomain[$domainNorm] = [
                        'movements' => 0,
                        'liters' => 0,
                        'amount' => 0,
                    ];
                }
                $consumptionByDomain[$domainNorm]['movements'] += 1;
                $consumptionByDomain[$domainNorm]['liters'] += (float) ($liters ?? 0);
                $consumptionByDomain[$domainNorm]['amount'] += (float) ($amount ?? 0);
            }

            $inserted += 1;
        }

        $this->notifyPersonalConsumption($consumptionByDomain, $originalName, $provider);

        AuditLogger::log($request, 'fuel.extract.process', 'fuel_extract', null, [
            'file' => $originalName,
            'provider' => $provider,
            'format' => $format,
            'period_from' => $dateFrom,
            'period_to' => $dateTo,
            'auto_assign_conductor' => $autoAssign,
            'row_count' => $rowCount,
            'inserted' => $inserted,
            'observed' => $observed,
            'duplicates' => $ignoredDuplicates,
            'late_charges' => $lateCharges,
        ]);

        return response()->json([
            'message' => 'Extracto procesado.',
            'rowCount' => $rowCount,
            'inserted' => $inserted,
            'valid' => $stats['valid'] ?? 0,
            'observed' => $observed,
            'duplicates' => $ignoredDuplicates,
            'late' => $lateCharges,
        ]);
    }

    private function notifyPersonalConsumption(array $consumptionByDomain, ?string $sourceFile, ?string $provider): void
    {
        if (empty($consumptionByDomain)) {
            return;
        }

        $personas = Persona::query()
            ->select('id', 'patente')
            ->whereNotNull('patente')
            ->get();

        if ($personas->isEmpty()) {
            return;
        }

        $personaByDomain = [];
        foreach ($personas as $persona) {
            $normalized = $this->normalizeDomain((string) $persona->patente);
            if ($normalized !== '') {
                $personaByDomain[$normalized] = $persona;
            }
        }

        foreach ($consumptionByDomain as $domain => $stats) {
            $persona = $personaByDomain[$domain] ?? null;
            if (! $persona) {
                continue;
            }

            $nombrePersona = trim(collect([
                $persona->nombres ?? null,
                $persona->apellidos ?? null,
            ])->filter()->implode(' '));
            if ($nombrePersona === '') {
                $nombrePersona = $persona->email ?? $domain;
            }

            $message = sprintf(
                'Nuevo consumo de combustible de %s. Se cargaron %d movimientos. Total: $%s.',
                $nombrePersona,
                (int) ($stats['movements'] ?? 0),
                number_format((float) ($stats['amount'] ?? 0), 2, ',', '.')
            );

            $recentExists = PersonalNotification::query()
                ->where('persona_id', $persona->id)
                ->where('type', 'fuel_extract_loaded')
                ->where('message', $message)
                ->where('created_at', '>=', Carbon::now()->subHours(24))
                ->exists();
            if ($recentExists) {
                continue;
            }

            PersonalNotification::query()->create([
                'persona_id' => $persona->id,
                'type' => 'fuel_extract_loaded',
                'title' => 'Nuevo consumo de combustible',
                'message' => $message,
                'metadata' => [
                    'domain' => $domain,
                    'movements' => (int) ($stats['movements'] ?? 0),
                    'liters' => (float) ($stats['liters'] ?? 0),
                    'amount' => (float) ($stats['amount'] ?? 0),
                    'source_file' => $sourceFile,
                    'provider' => $provider,
                ],
            ]);
        }
    }

    private function parseCsvPreview(string $path, int $limit): array
    {
        $rows = [];
        $columns = [];
        $rowCount = 0;
        $rawRows = [];
        $handle = fopen($path, 'r');
        if (!$handle) {
            return [[], [], 0];
        }

        while (($data = fgetcsv($handle)) !== false) {
            $rawRows[] = $this->expandDelimitedRow($data);
        }

        fclose($handle);

        $headerIndex = $this->detectHeaderRow($rawRows);
        if ($headerIndex !== null) {
            $header = $rawRows[$headerIndex];
            $columns = array_map(
                static fn ($value) => trim((string) $value) ?: '',
                $header
            );
            $dataRows = array_slice($rawRows, $headerIndex + 1);
        } else {
            $dataRows = $rawRows;
        }

        foreach ($dataRows as $data) {
            $rowCount += 1;
            if (count($rows) < $limit) {
                $rows[] = $this->fillRow($columns, $data);
            }
        }

        if (empty($columns)) {
            $columns = $this->fallbackColumnsFromRows($rows);
        }

        $meta = [
            'headerIndex' => $headerIndex,
            'headerRow' => $headerIndex !== null ? $rawRows[$headerIndex] : null,
            'sampleRows' => array_slice($rawRows, 0, 5),
        ];

        return [$columns, $rows, $rowCount, $meta];
    }

    private function parseXlsxPreview(string $path, int $limit, ?string $preferredSheet = null): array
    {
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            return [[], [], 0, []];
        }

        $sharedStrings = $this->readSharedStrings($zip);
        $sheetEntries = $this->listWorksheetFiles($zip);
        if (empty($sheetEntries)) {
            $zip->close();
            return [[], [], 0, []];
        }

        $bestSheet = null;
        $bestScore = -1;
        $bestColumns = 0;
        $bestRows = 0;
        $profiles = [];

        foreach ($sheetEntries as $sheetEntry) {
            $sheetPath = $sheetEntry['path'];
            $sheetXml = $zip->getFromName($sheetPath);
            if (!$sheetXml) {
                continue;
            }

            [$sampleRows] = $this->extractSheetRows($sheetXml, $sharedStrings, 1200);
            if (empty($sampleRows)) {
                $profiles[] = [
                    'sheet' => $sheetPath,
                    'name' => $sheetEntry['name'],
                    'headerIndex' => null,
                    'headerScore' => 0,
                    'maxColumns' => 0,
                    'sample' => [],
                ];
                continue;
            }

            [$headerIndex, $headerScore] = $this->detectHeaderRowWithScore($sampleRows);
            $columnCount = $this->maxRowWidth($sampleRows);
            $profiles[] = [
                'sheet' => $sheetPath,
                'name' => $sheetEntry['name'],
                'headerIndex' => $headerIndex,
                'headerScore' => $headerScore,
                'maxColumns' => $columnCount,
                'sample' => array_slice($sampleRows, 0, 2),
            ];

            if (
                $headerScore > $bestScore ||
                ($headerScore === $bestScore && $columnCount > $bestColumns) ||
                ($headerScore === $bestScore && $columnCount === $bestColumns && count($sampleRows) > $bestRows)
            ) {
                $bestScore = $headerScore;
                $bestColumns = $columnCount;
                $bestRows = count($sampleRows);
                $bestSheet = $sheetPath;
            }
        }

        $targetSheet = $this->resolvePreferredSheet($preferredSheet, $sheetEntries) ?? ($bestSheet ?? $sheetEntries[0]['path']);
        $sheetXml = $zip->getFromName($targetSheet);
        $zip->close();

        if (!$sheetXml) {
            return [[], [], 0, []];
        }

        [$rawRows, $totalRows] = $this->extractSheetRows($sheetXml, $sharedStrings, max($limit + 20, 1200));

        $columns = [];
        $rows = [];
        $rowCount = $totalRows;

        $headerIndex = $this->detectHeaderRow($rawRows);
        if ($headerIndex !== null) {
            $columns = array_map(
                static fn ($value) => trim((string) $value) ?: '',
                $rawRows[$headerIndex]
            );
            $dataRows = array_slice($rawRows, $headerIndex + 1);
            $rowCount = max(0, $totalRows - ($headerIndex + 1));
        } else {
            $dataRows = $rawRows;
        }

        foreach ($dataRows as $data) {
            if (count($rows) < $limit) {
                $rows[] = $this->fillRow($columns, $data);
            }
        }

        if (empty($columns)) {
            $columns = $this->fallbackColumnsFromRows($rows);
        }

        $meta = [
            'sheet' => $targetSheet,
            'headerIndex' => $headerIndex,
            'headerRow' => $headerIndex !== null ? $rawRows[$headerIndex] : null,
            'sampleRows' => array_slice($rawRows, 0, 5),
            'maxScan' => count($rawRows),
            'sheets' => $profiles,
        ];

        return [$columns, $rows, $rowCount, $meta];
    }

    private function listWorksheetFiles(ZipArchive $zip): array
    {
        $fromWorkbook = $this->readWorkbookSheets($zip);
        if (!empty($fromWorkbook)) {
            return $fromWorkbook;
        }

        $files = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (is_string($name) && preg_match('/^xl\\/worksheets\\/[^\\/]+\\.xml$/', $name)) {
                $files[] = [
                    'name' => basename($name, '.xml'),
                    'path' => $name,
                ];
            }
        }
        usort($files, fn ($a, $b) => strcmp($a['path'], $b['path']));
        return $files;
    }

    private function extractSheetRows(string $sheetXml, array $sharedStrings, int $limitRows): array
    {
        $sheet = simplexml_load_string($sheetXml);
        if (!$sheet || !isset($sheet->sheetData)) {
            return [[], 0];
        }

        $rows = [];
        $rowCount = 0;
        foreach ($sheet->sheetData->row as $row) {
            $rowCount += 1;
            if (count($rows) >= $limitRows) {
                continue;
            }
            $cells = [];
            $nextIndex = 0;
            foreach ($row->c as $cell) {
                $cellRef = (string) $cell['r'];
                if ($cellRef !== '') {
                    $colIndex = $this->columnIndexFromCellRef($cellRef);
                    $nextIndex = max($nextIndex, $colIndex + 1);
                } else {
                    $colIndex = $nextIndex;
                    $nextIndex += 1;
                }
                $cells[$colIndex] = $this->readCellValue($cell, $sharedStrings);
            }
            $rows[] = $this->normalizeRowByIndex($cells);
        }

        return [$rows, $rowCount];
    }

    private function maxRowWidth(array $rows): int
    {
        $max = 0;
        foreach ($rows as $row) {
            $max = max($max, count($row));
        }
        return $max;
    }

    private function readSharedStrings(ZipArchive $zip): array
    {
        $sharedStrings = [];
        $sharedXml = $zip->getFromName('xl/sharedStrings.xml');
        if (!$sharedXml) {
            return $sharedStrings;
        }

        $shared = simplexml_load_string($sharedXml);
        if (!$shared) {
            return $sharedStrings;
        }

        foreach ($shared->si as $item) {
            if (isset($item->t)) {
                $sharedStrings[] = (string) $item->t;
            } elseif (isset($item->r)) {
                $text = '';
                foreach ($item->r as $run) {
                    $text .= (string) $run->t;
                }
                $sharedStrings[] = $text;
            }
        }

        return $sharedStrings;
    }

    private function readCellValue(\SimpleXMLElement $cell, array $sharedStrings): string
    {
        $type = (string) $cell['t'];
        if ($type === 'inlineStr' && isset($cell->is)) {
            return (string) $cell->is->t;
        }

        $value = (string) $cell->v;

        if ($type === 's') {
            $index = (int) $value;
            return $sharedStrings[$index] ?? '';
        }

        return $value;
    }

    private function columnIndexFromCellRef(string $ref): int
    {
        $letters = preg_replace('/[^A-Z]/', '', strtoupper($ref));
        $index = 0;
        for ($i = 0, $len = strlen($letters); $i < $len; $i++) {
            $index = $index * 26 + (ord($letters[$i]) - 64);
        }
        return max(0, $index - 1);
    }

    private function fillRow(array $columns, array $data): array
    {
        if (array_values($data) !== $data) {
            ksort($data);
            $data = array_values($data);
        }

        $row = [];
        $count = max(count($columns), count($data));
        for ($i = 0; $i < $count; $i++) {
            $row[] = $data[$i] ?? '';
        }
        return $row;
    }

    private function normalizeRowByIndex(array $cells): array
    {
        if (empty($cells)) {
            return [];
        }

        ksort($cells);
        $maxIndex = max(array_keys($cells));
        $row = array_fill(0, $maxIndex + 1, '');
        foreach ($cells as $index => $value) {
            $row[$index] = $value;
        }
        return $this->expandDelimitedRow($row);
    }

    private function expandDelimitedRow(array $row): array
    {
        if (count($row) !== 1) {
            return $row;
        }

        $cell = (string) ($row[0] ?? '');
        if ($cell === '') {
            return $row;
        }

        if (strpos($cell, "\t") !== false) {
            return array_map('trim', explode("\t", $cell));
        }

        if (strpos($cell, ';') !== false && strpos($cell, ',') === false) {
            return array_map('trim', explode(';', $cell));
        }

        $parts = preg_split('/\s{2,}/', $cell);
        if (is_array($parts) && count($parts) >= 4) {
            return array_map('trim', $parts);
        }

        return $row;
    }

    private function fallbackColumnsFromRows(array $rows): array
    {
        $max = 0;
        foreach ($rows as $row) {
            $max = max($max, count($row));
        }

        $columns = [];
        for ($i = 0; $i < $max; $i++) {
            $columns[] = 'Columna ' . ($i + 1);
        }
        return $columns;
    }

    private function mapPreviewRows(array $columns, array $rows): array
    {
        $standardColumns = ['Fecha', 'Estación', 'Dominio', 'Producto', 'Conductor', 'Litros', 'Importe', 'Precio/Litro'];
        $indexMap = [];
        $unmapped = [];

        foreach ($columns as $index => $header) {
            $mapped = $this->mapHeaderToStandard((string) $header);
            if ($mapped) {
                if (! array_key_exists($mapped, $indexMap)) {
                    $indexMap[$mapped] = $index;
                }
            } elseif (trim((string) $header) !== '') {
                $unmapped[] = (string) $header;
            }
        }

        if (count($indexMap) === 0) {
            return [
                'mapped' => false,
                'columns' => $columns,
                'rows' => $rows,
                'unmappedColumns' => $unmapped,
            ];
        }

        $mappedRows = [];
        foreach ($rows as $row) {
            $mappedRow = [];
            foreach ($standardColumns as $standard) {
                $sourceIndex = $indexMap[$standard] ?? null;
                $mappedRow[] = $sourceIndex !== null && array_key_exists($sourceIndex, $row)
                    ? (string) $row[$sourceIndex]
                    : '';
            }
            $mappedRows[] = $mappedRow;
        }

        return [
            'mapped' => true,
            'columns' => $standardColumns,
            'rows' => $mappedRows,
            'unmappedColumns' => $unmapped,
        ];
    }

    private function validateMappedRows(array $columns, array $rows): array
    {
        $columnIndexes = [];
        foreach ($columns as $index => $name) {
            $columnIndexes[$name] = $index;
        }

        $domainIndex = $columnIndexes['Dominio'] ?? null;
        $dateIndex = $columnIndexes['Fecha'] ?? null;
        $stationIndex = $columnIndexes['Estación'] ?? null;
        $litersIndex = $columnIndexes['Litros'] ?? null;
        $amountIndex = $columnIndexes['Importe'] ?? null;
        $priceIndex = $columnIndexes['Precio/Litro'] ?? null;

        $seen = [];
        $stats = [
            'previewTotal' => count($rows),
            'valid' => 0,
            'observed' => 0,
            'duplicates' => 0,
        ];

        $enhancedColumns = array_merge($columns, ['Dominio_norm', 'Estado', 'Observaciones']);
        $enhancedRows = [];

        foreach ($rows as $row) {
            $errors = [];
            $domainRaw = $domainIndex !== null ? (string) ($row[$domainIndex] ?? '') : '';
            $domainNorm = $this->normalizeDomain($domainRaw);
            if ($domainNorm === '') {
                $errors[] = 'Dominio vacío';
            }

            $dateRaw = $dateIndex !== null ? (string) ($row[$dateIndex] ?? '') : '';
            $dateValid = $this->isValidDate($dateRaw);
            if (!$dateValid) {
                $errors[] = 'Fecha inválida';
            }

            $litersRaw = $litersIndex !== null ? (string) ($row[$litersIndex] ?? '') : '';
            $priceRaw = $priceIndex !== null ? (string) ($row[$priceIndex] ?? '') : '';
            $liters = $this->parseNumber($litersRaw);
            if ($liters === null || $liters <= 0) {
                $errors[] = 'Litros inválidos';
            }

            $amountRaw = $amountIndex !== null ? (string) ($row[$amountIndex] ?? '') : '';
            $amount = $this->parseNumber($amountRaw);
            if ($amount === null || $amount < 0) {
                $errors[] = 'Importe inválido';
            }
            $price = $this->parseNumber($priceRaw);
            if ($liters !== null && $amount !== null) {
                $normalizedLiters = $this->normalizeLiters($liters, $price, $amount);
                if ($normalizedLiters !== $liters && $litersIndex !== null) {
                    $row[$litersIndex] = number_format($normalizedLiters, 2, '.', '');
                    $liters = $normalizedLiters;
                }
            }

            $stationRaw = $stationIndex !== null ? (string) ($row[$stationIndex] ?? '') : '';
            $hash = strtolower($domainNorm . '|' . $dateRaw . '|' . $amountRaw . '|' . $litersRaw . '|' . $stationRaw);
            $isDuplicate = $hash !== '||||' && array_key_exists($hash, $seen);

            $status = 'VALID';
            if (!empty($errors)) {
                $status = 'OBSERVED';
                $stats['observed'] += 1;
            } elseif ($isDuplicate) {
                $status = 'DUPLICATE';
                $stats['duplicates'] += 1;
            } else {
                $stats['valid'] += 1;
            }

            $observations = implode('; ', $errors);
            $enhancedRows[] = array_merge($row, [$domainNorm, $status, $observations]);
            $seen[$hash] = true;
        }

        return [
            'columns' => $enhancedColumns,
            'rows' => $enhancedRows,
            'stats' => $stats,
        ];
    }

    private function mapHeaderToStandard(string $header): ?string
    {
        $normalized = $this->normalizeHeader($header);
        if ($normalized === '') {
            return null;
        }

        $compact = str_replace(' ', '', $normalized);
        if (
            strpos($compact, 'preciolitro') !== false ||
            (strpos($normalized, 'precio') !== false && strpos($normalized, 'litro') !== false) ||
            (strpos($normalized, 'precio') !== false && strpos($normalized, 'pvp') !== false)
        ) {
            return 'Precio/Litro';
        }
        if (
            strpos($normalized, 'imp') !== false &&
            strpos($normalized, 'tot') !== false &&
            (strpos($normalized, 'pvp') !== false || strpos($normalized, 'establecimiento') !== false)
        ) {
            return 'Importe';
        }
        if (strpos($normalized, 'fecha') !== false) {
            return 'Fecha';
        }
        if (strpos($normalized, 'estacion') !== false || strpos($normalized, 'establecimiento') !== false) {
            return 'Estación';
        }
        if (
            strpos($normalized, 'dominio') !== false ||
            strpos($normalized, 'patente') !== false ||
            strpos($normalized, 'placa') !== false ||
            $normalized === 'identificacion tarjeta'
        ) {
            return 'Dominio';
        }
        if (strpos($normalized, 'conductor') !== false || strpos($normalized, 'chofer') !== false) {
            return 'Conductor';
        }
        if (strpos($normalized, 'producto') !== false || strpos($normalized, 'combustible') !== false) {
            return 'Producto';
        }
        if (
            strpos($normalized, 'litro') !== false ||
            strpos($normalized, 'cantidad') !== false ||
            strpos($normalized, 'volumen') !== false ||
            strpos($normalized, 'unidades') !== false
        ) {
            return 'Litros';
        }
        if (
            strpos($normalized, 'importe') !== false ||
            strpos($normalized, 'monto') !== false ||
            strpos($normalized, 'total') !== false ||
            strpos($normalized, 'tot') !== false ||
            strpos($normalized, 'valor') !== false
        ) {
            return 'Importe';
        }

        return null;
    }

    private function normalizeDomain(string $value): string
    {
        $normalized = strtoupper(trim($value));
        $normalized = preg_replace('/[\s\.\-]+/', '', $normalized);
        return $normalized ?? '';
    }

    private function isValidDate(string $value): bool
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return false;
        }

        if (strtotime($trimmed) !== false) {
            return true;
        }

        $formats = [
            'd/m/Y',
            'd/m/Y H:i',
            'd/m/Y H:i:s',
            'd-m-Y',
            'd-m-Y H:i',
            'd-m-Y H:i:s',
            'Y-m-d',
            'Y-m-d H:i',
            'Y-m-d H:i:s',
        ];
        foreach ($formats as $format) {
            $date = \DateTime::createFromFormat($format, $trimmed);
            if ($date && $date->format($format) === $trimmed) {
                return true;
            }
        }

        return false;
    }

    private function parseNumber(string $value): ?float
    {
        $clean = trim($value);
        if ($clean === '') {
            return null;
        }

        $clean = str_replace(' ', '', $clean);
        $hasComma = strpos($clean, ',') !== false;
        $hasDot = strpos($clean, '.') !== false;

        if ($hasComma && $hasDot) {
            $clean = str_replace('.', '', $clean);
            $clean = str_replace(',', '.', $clean);
        } elseif ($hasComma) {
            $clean = str_replace(',', '.', $clean);
        }

        if (!is_numeric($clean)) {
            return null;
        }

        return (float) $clean;
    }

    private function parseDate(string $value): ?Carbon
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        if (is_numeric($trimmed)) {
            $serial = (float) $trimmed;
            $base = Carbon::create(1899, 12, 30, 0, 0, 0, 'UTC');
            return $base->copy()->addDays((int) $serial);
        }

        $formats = [
            'd/m/Y',
            'd/m/Y H:i',
            'd/m/Y H:i:s',
            'd-m-Y',
            'd-m-Y H:i',
            'd-m-Y H:i:s',
            'Y-m-d',
            'Y-m-d H:i',
            'Y-m-d H:i:s',
        ];
        foreach ($formats as $format) {
            $date = \DateTime::createFromFormat($format, $trimmed);
            if ($date && $date->format($format) === $trimmed) {
                return Carbon::instance($date);
            }
        }

        try {
            return Carbon::parse($trimmed);
        } catch (\Throwable $exception) {
            return null;
        }
    }

    private function getRowValue(array $row, array $indexes, string $column): string
    {
        $index = $indexes[$column] ?? null;
        if ($index === null) {
            return '';
        }
        return (string) ($row[$index] ?? '');
    }

    private function normalizeLiters(float $liters, ?float $price, ?float $amount): float
    {
        if ($price === null || $amount === null || $price <= 0 || $amount <= 0 || $liters <= 0) {
            return $liters;
        }

        $expected = $liters * $price;
        if ($expected > ($amount * 10) && $liters >= 100) {
            return $liters / 100;
        }

        return $liters;
    }

    private function resolveDistributorId(string $domainNorm, ?string $conductor, bool $autoAssign): ?int
    {
        $existing = DistributorDomain::query()
            ->where('domain_norm', $domainNorm)
            ->value('distributor_id');

        if ($existing) {
            return $existing;
        }

        if (! $autoAssign) {
            return null;
        }

        $conductorName = $this->normalizeDistributorName($conductor ?? '');
        if ($conductorName === '') {
            return null;
        }

        $distributorId = $this->findOrCreateDistributor($conductorName);
        if (! $distributorId) {
            return null;
        }

        DistributorDomain::query()->updateOrCreate(
            ['domain_norm' => $domainNorm],
            [
                'distributor_id' => $distributorId,
                'domain_raw' => $domainNorm,
            ]
        );

        return $distributorId;
    }

    private function normalizeDistributorName(string $name): string
    {
        $value = trim($name);
        $value = preg_replace('/\s+/', ' ', $value);
        return $value ?? '';
    }

    private function findOrCreateDistributor(string $name): ?int
    {
        if ($name === '') {
            return null;
        }

        $normalized = strtoupper($name);
        $existing = Distributor::query()
            ->whereRaw('UPPER(name) = ?', [$normalized])
            ->first();

        if ($existing) {
            return $existing->id;
        }

        $created = Distributor::query()->create([
            'name' => $name,
            'active' => true,
        ]);

        return $created->id;
    }

    private function normalizeHeader(string $header): string
    {
        $value = trim($header);
        $value = strtr($value, [
            'Á' => 'A',
            'É' => 'E',
            'Í' => 'I',
            'Ó' => 'O',
            'Ú' => 'U',
            'Ü' => 'U',
            'Ñ' => 'N',
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' => 'u',
            'ü' => 'u',
            'ñ' => 'n',
        ]);
        $value = strtolower($value);
        $value = preg_replace('/[^a-z0-9]+/u', ' ', $value);
        return trim($value ?? '');
    }

    private function detectHeaderRow(array $rows): ?int
    {
        [$index, $score] = $this->detectHeaderRowWithScore($rows);
        return $score >= 2 ? $index : null;
    }

    private function detectHeaderRowWithScore(array $rows): array
    {
        if (empty($rows)) {
            return [null, 0];
        }

        $bestIndex = null;
        $bestScore = 0;
        $maxScan = count($rows);

        for ($i = 0; $i < $maxScan; $i++) {
            $row = $rows[$i] ?? [];
            $score = 0;
            foreach ($row as $cell) {
                if ($this->mapHeaderToStandard((string) $cell)) {
                    $score += 1;
                }
            }
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestIndex = $i;
            }
        }

        return [$bestIndex, $bestScore];
    }

    private function resolvePreferredSheet($preferred, array $sheetEntries): ?string
    {
        if (!is_string($preferred) || trim($preferred) === '') {
            return null;
        }

        $normalized = strtolower(trim($preferred));
        foreach ($sheetEntries as $sheetEntry) {
            if (strtolower($sheetEntry['path']) === $normalized) {
                return $sheetEntry['path'];
            }
            if (strtolower($sheetEntry['name']) === $normalized) {
                return $sheetEntry['path'];
            }
        }

        if (preg_match('/^sheet(\\d+)$/', $normalized, $matches)) {
            $target = 'xl/worksheets/sheet' . $matches[1] . '.xml';
            foreach ($sheetEntries as $sheetEntry) {
                if ($sheetEntry['path'] === $target) {
                    return $target;
                }
            }
            return null;
        }

        if (ctype_digit($normalized)) {
            $target = 'xl/worksheets/sheet' . $normalized . '.xml';
            foreach ($sheetEntries as $sheetEntry) {
                if ($sheetEntry['path'] === $target) {
                    return $target;
                }
            }
            return null;
        }

        return null;
    }

    private function readWorkbookSheets(ZipArchive $zip): array
    {
        $workbookXml = $zip->getFromName('xl/workbook.xml');
        $relsXml = $zip->getFromName('xl/_rels/workbook.xml.rels');
        if (!$workbookXml || !$relsXml) {
            return [];
        }

        $workbook = simplexml_load_string($workbookXml);
        $rels = simplexml_load_string($relsXml);
        if (!$workbook || !$rels) {
            return [];
        }

        $relsMap = [];
        foreach ($rels->Relationship as $rel) {
            $id = (string) $rel['Id'];
            $target = (string) $rel['Target'];
            if ($id && $target) {
                $relsMap[$id] = $target;
            }
        }

        $sheets = [];
        foreach ($workbook->sheets->sheet as $sheet) {
            $name = (string) $sheet['name'];
            $relId = (string) $sheet['id'];
            if ($relId === '') {
                $relId = (string) $sheet->attributes('r', true)->id;
            }
            $target = $relsMap[$relId] ?? null;
            if (!$target) {
                continue;
            }
            $path = 'xl/' . ltrim($target, '/');
            $sheets[] = [
                'name' => $name ?: basename($path, '.xml'),
                'path' => $path,
            ];
        }

        return $sheets;
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AttendanceController extends Controller
{
    private const STATUS_ALIASES = [
        'entrada' => 'entrada',
        'ingreso' => 'entrada',
        'in' => 'entrada',
        'e' => 'entrada',
        'salida' => 'salida',
        'egreso' => 'salida',
        'out' => 'salida',
        's' => 'salida',
    ];

    private const HEADER_ALIASES = [
        'user_code' => [
            'legajo',
            'codigo',
            'codigoempleado',
            'idempleado',
            'idusuario',
            'pin',
            'dni',
            'nroempleado',
            'numeroempleado',
        ],
        'user_name' => [
            'nombre',
            'apellidoynombre',
            'empleado',
            'usuario',
            'nombredelusuario',
            'personal',
        ],
        'date' => [
            'fecha',
            'dia',
        ],
        'time' => [
            'hora',
            'horario',
        ],
        'datetime' => [
            'fechahora',
            'fechayhora',
            'marcacion',
            'marcaje',
            'registro',
            'timestamp',
        ],
        'status' => [
            'estado',
            'tipo',
            'movimiento',
            'evento',
            'accion',
            'entradasalida',
            'tipomarcacion',
            'inout',
        ],
    ];

    private const DATETIME_FORMATS = [
        'd/m/Y H:i:s',
        'd/m/Y H:i',
        'd-m-Y H:i:s',
        'd-m-Y H:i',
        'Y-m-d H:i:s',
        'Y-m-d H:i',
        'd/m/y H:i:s',
        'd/m/y H:i',
        'm/d/Y H:i:s',
        'm/d/Y H:i',
    ];

    private const DATE_FORMATS = [
        'd/m/Y',
        'd-m-Y',
        'Y-m-d',
        'd/m/y',
        'm/d/Y',
    ];

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
            'userId' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $limit = $validated['limit'] ?? 200;

        $query = AttendanceRecord::query()
            ->with('user:id,name')
            ->orderByDesc('recorded_at');

        if (! empty($validated['userId'])) {
            $query->where('user_id', $validated['userId']);
        }

        $records = $query->limit($limit)->get();

        $timezone = $this->resolveAttendanceTimezone();

        $data = $records->map(function (AttendanceRecord $record) use ($timezone) {
            $recordedAt = $record->recorded_at;
            $localizedRecordedAt = $recordedAt?->copy()->timezone($timezone);

            return [
                'id' => $record->id,
                'status' => $record->status,
                'userId' => $record->user_id,
                'userName' => $record->user?->name ?? $record->user_name,
                'recordedAt' => $localizedRecordedAt?->toIso8601String(),
                'recordedAtLabel' => $localizedRecordedAt?->format('d/m/Y H:i:s'),
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $manualAttendanceAllowed = filter_var((string) env('ATTENDANCE_ALLOW_MANUAL', 'false'), FILTER_VALIDATE_BOOL);
        if (! $manualAttendanceAllowed) {
            return response()->json([
                'message' => 'La marcación manual está deshabilitada. Importá la asistencia desde Excel/C26.',
            ], 403);
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in(['entrada', 'salida'])],
            'timestamp' => ['nullable', 'date'],
            'userId' => ['nullable', 'integer', 'exists:users,id'],
            'userName' => ['nullable', 'string', 'max:255'],
        ]);

        $userId = $validated['userId'] ?? $request->user()?->id;
        $userName = $validated['userName'] ?? $request->user()?->name;

        if (! $userName && $userId) {
            $userName = User::query()->find($userId)?->name;
        }

        $record = AttendanceRecord::query()->create([
            'user_id' => $userId,
            'user_name' => $userName,
            'status' => $validated['status'],
            'recorded_at' => isset($validated['timestamp'])
                ? Carbon::parse($validated['timestamp'], $this->resolveAttendanceTimezone())
                : Carbon::now($this->resolveAttendanceTimezone()),
        ]);

        $localizedRecordedAt = $record->recorded_at?->copy()->timezone($this->resolveAttendanceTimezone());

        return response()->json([
            'message' => 'Registro de asistencia guardado correctamente.',
            'data' => [
                'id' => $record->id,
                'status' => $record->status,
                'userId' => $record->user_id,
                'userName' => $record->user?->name ?? $record->user_name,
                'recordedAt' => $localizedRecordedAt?->toIso8601String(),
                'recordedAtLabel' => $localizedRecordedAt?->format('d/m/Y H:i:s'),
            ],
        ], 201);
    }

    public function import(Request $request): JsonResponse
    {
        $validated = $request->validate(
            [
                'file' => ['required', 'file', 'max:15360'],
                'replaceExisting' => ['nullable', 'boolean'],
            ],
            [
                'file.required' => 'Seleccioná un archivo para importar.',
                'file.file' => 'El archivo seleccionado no es válido.',
                'file.max' => 'El archivo supera el tamaño máximo permitido (15 MB).',
            ]
        );

        $file = $validated['file'];
        $rawContents = $file->get();
        if (! is_string($rawContents) || trim($rawContents) === '') {
            return response()->json([
                'message' => 'El archivo está vacío o no se pudo leer.',
            ], 422);
        }

        $isLegacyXls = $this->looksLikeLegacyXls($rawContents);

        if ($this->looksLikeLegacyXls($rawContents)) {
            [$parsedRows, $parseErrors] = $this->parseLegacyXlsRows($rawContents);
        } else {
            $contents = $this->readImportContents($rawContents);
            [$parsedRows, $parseErrors] = $this->parseImportRows($contents);
        }
        if (empty($parsedRows)) {
            if (empty($parseErrors)) {
                $parseErrors[] = 'No se detectaron columnas con fecha y hora válidas en el archivo (se revisaron todas las hojas).';
            }

            $previewSource = $isLegacyXls
                ? implode("\n", $this->extractBinaryTextLines($rawContents))
                : ($contents ?? '');
            $previewLines = $this->buildImportPreviewLines($previewSource, 3);
            foreach ($previewLines as $line) {
                $parseErrors[] = sprintf('Vista previa: %s', $line);
            }

            return response()->json([
                'message' => 'No se encontraron marcaciones válidas para importar.',
                'data' => [
                    'processed' => 0,
                    'imported' => 0,
                    'skipped' => 0,
                    'inferredStatus' => 0,
                    'errors' => array_slice($parseErrors, 0, 25),
                ],
            ], 422);
        }

        $replaceExisting = (bool) ($validated['replaceExisting'] ?? false);
        $deletedCount = 0;
        if ($replaceExisting) {
            $this->ensureAdmin($request);
            $deletedCount = AttendanceRecord::query()->count();
            AttendanceRecord::query()->delete();
        }

        usort($parsedRows, fn (array $a, array $b) => $a['recorded_at']->getTimestamp() <=> $b['recorded_at']->getTimestamp());

        $users = User::query()->select(['id', 'name'])->get();
        $usersById = [];
        $usersByName = [];
        $usersByNameLoose = [];
        foreach ($users as $user) {
            $usersById[(int) $user->id] = $user->name;
            $normalizedName = $this->normalizePersonName($user->name);
            if ($normalizedName !== '' && ! isset($usersByName[$normalizedName])) {
                $usersByName[$normalizedName] = (int) $user->id;
            }
            $normalizedLoose = $this->normalizePersonNameLoose($user->name);
            if ($normalizedLoose !== '' && ! isset($usersByNameLoose[$normalizedLoose])) {
                $usersByNameLoose[$normalizedLoose] = (int) $user->id;
            }
        }

        $processed = 0;
        $imported = 0;
        $skipped = 0;
        $inferredStatus = 0;
        $errors = $parseErrors;
        $nextStatusByIdentity = [];
        $lastStatusByIdentity = [];

        foreach ($parsedRows as $row) {
            $processed++;

            [$resolvedUserId, $resolvedUserName] = $this->resolveUser(
                $row['user_name'] ?? null,
                $row['user_code'] ?? null,
                $usersById,
                $usersByName,
                $usersByNameLoose
            );

            if (! $resolvedUserName) {
                $errors[] = sprintf('Línea %d: no se pudo identificar el usuario.', $row['line']);
                $skipped++;
                continue;
            }

            $identity = $this->buildIdentityKey($resolvedUserId, $resolvedUserName, $row['user_code'] ?? null);
            $status = $row['status'];

            if (! $status) {
                if (! array_key_exists($identity, $nextStatusByIdentity)) {
                    $lastStatusByIdentity[$identity] = $this->findLastStatus(
                        $resolvedUserId,
                        $resolvedUserName,
                        $row['recorded_at']
                    );
                    $nextStatusByIdentity[$identity] = $lastStatusByIdentity[$identity] === 'entrada' ? 'salida' : 'entrada';
                }
                $status = $nextStatusByIdentity[$identity];
                $nextStatusByIdentity[$identity] = $status === 'entrada' ? 'salida' : 'entrada';
                $inferredStatus++;
            } else {
                $nextStatusByIdentity[$identity] = $status === 'entrada' ? 'salida' : 'entrada';
            }

            $normalizedUserName = $this->normalizePersonName($resolvedUserName);
            $alreadyExists = AttendanceRecord::query()
                ->where('status', $status)
                ->where('recorded_at', $row['recorded_at'])
                ->where(function ($builder) use ($resolvedUserId, $normalizedUserName, $row) {
                    $hasCondition = false;
                    if ($resolvedUserId !== null) {
                        $builder->where('user_id', $resolvedUserId);
                        $hasCondition = true;
                    }
                    if ($normalizedUserName !== '') {
                        if ($hasCondition) {
                            $builder->orWhereRaw('LOWER(COALESCE(user_name, "")) = ?', [$normalizedUserName]);
                        } else {
                            $builder->whereRaw('LOWER(COALESCE(user_name, "")) = ?', [$normalizedUserName]);
                        }
                        $hasCondition = true;
                    }
                    if (! $hasCondition && ! empty($row['user_code']) && ctype_digit((string) $row['user_code'])) {
                        $builder->where('user_id', (int) $row['user_code']);
                    }
                })
                ->exists();

            if ($alreadyExists) {
                $skipped++;
                continue;
            }

            AttendanceRecord::query()->create([
                'user_id' => $resolvedUserId,
                'user_name' => $resolvedUserName,
                'status' => $status,
                'recorded_at' => $row['recorded_at'],
            ]);

            $imported++;
        }

        return response()->json([
            'message' => 'Importación de marcaciones completada.',
            'data' => [
                'processed' => $processed,
                'imported' => $imported,
                'skipped' => $skipped,
                'inferredStatus' => $inferredStatus,
                'replaceExisting' => $replaceExisting,
                'deletedCount' => $deletedCount,
                'errors' => array_slice($errors, 0, 25),
            ],
        ]);
    }

    public function clear(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $deletedCount = AttendanceRecord::query()->count();
        AttendanceRecord::query()->delete();

        return response()->json([
            'message' => 'Registro de asistencia eliminado correctamente.',
            'data' => [
                'deletedCount' => $deletedCount,
            ],
        ]);
    }

    private function parseImportRows(string $contents): array
    {
        $lines = preg_split('/\r\n|\n|\r/', $contents) ?: [];
        $lines = array_values(array_filter(
            array_map(fn ($line) => rtrim((string) $line), $lines),
            fn ($line) => trim($line) !== ''
        ));

        if (empty($lines)) {
            return [[], ['El archivo no contiene filas con datos.']];
        }

        $delimiter = $this->detectDelimiter($lines[0]);
        if (preg_match('/^\s*sep\s*=\s*([,;|\t])\s*$/i', $lines[0], $matches)) {
            $delimiter = $matches[1];
            array_shift($lines);
        }

        if (empty($lines)) {
            return [[], ['El archivo no contiene filas luego del encabezado sep=.']];
        }

        $firstCells = $this->parseCsvLine($lines[0], $delimiter);
        $hasHeader = $this->looksLikeHeader($firstCells);
        $headerMap = $hasHeader ? $this->buildHeaderMap($firstCells) : [];
        $startIndex = $hasHeader ? 1 : 0;
        $rows = [];
        $errors = [];

        for ($i = $startIndex; $i < count($lines); $i++) {
            $lineNumber = $i + 1;
            $cells = $this->parseCsvLine($lines[$i], $delimiter);
            $cells = array_values(array_map(fn ($value) => trim((string) $value), $cells));
            if (count(array_filter($cells, fn ($value) => $value !== '')) === 0) {
                continue;
            }

            [$row, $error] = $this->extractImportRow($cells, $headerMap, $lineNumber);
            if ($row !== null) {
                $rows[] = $row;
                continue;
            }
            if ($error) {
                $errors[] = $error;
            }
        }

        return [$rows, $errors];
    }

    private function looksLikeLegacyXls(string $rawContents): bool
    {
        return str_starts_with($rawContents, "\xD0\xCF\x11\xE0");
    }

    private function parseLegacyXlsRows(string $rawContents): array
    {
        $lines = $this->extractBinaryTextLines($rawContents);
        if (empty($lines)) {
            return [[], ['No se pudieron extraer líneas legibles del archivo XLS.']];
        }

        $rows = [];
        $errors = [];
        $currentUserName = null;
        $currentDate = null;
        $timezone = $this->resolveAttendanceTimezone();
        $lineNumber = 0;

        for ($i = 0; $i < count($lines); $i++) {
            $lineNumber++;
            $line = $lines[$i];
            $nextLine = $lines[$i + 1] ?? null;

            if (preg_match('/^\d{4}\/\d{2}\/\d{2}\s*~/', $line)) {
                $currentDate = null;
                continue;
            }

            if ($this->isLikelyLegacyUserName($line) && $nextLine !== null && preg_match('/^post\d*$/i', $nextLine)) {
                $currentUserName = $line;
                continue;
            }

            if (preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $line)) {
                $currentDate = $line;
                continue;
            }

            if (! $currentUserName || ! $currentDate) {
                continue;
            }

            if (preg_match_all('/([0-2]?\d):([0-5]\d)(?::([0-5]\d))?/', $line, $timeMatches, PREG_SET_ORDER)) {
                foreach ($timeMatches as $match) {
                    $hour = (int) $match[1];
                    $minute = (int) $match[2];
                    $second = (isset($match[3]) && $match[3] !== '') ? (int) $match[3] : 0;

                    if ($hour < 0 || $hour > 23 || $minute < 0 || $minute > 59 || $second < 0 || $second > 59) {
                        continue;
                    }

                    try {
                        $recordedAt = Carbon::createFromFormat(
                            'Y/m/d H:i:s',
                            sprintf('%s %02d:%02d:%02d', $currentDate, $hour, $minute, $second),
                            $timezone
                        );
                    } catch (\Throwable $e) {
                        $errors[] = sprintf('Línea %d: hora inválida en XLS legacy (%s).', $lineNumber, $line);
                        continue;
                    }

                    if ($recordedAt->year < 2000 || $recordedAt->year > 2100) {
                        continue;
                    }

                    $rows[] = [
                        'line' => $lineNumber,
                        'user_code' => null,
                        'user_name' => $currentUserName,
                        'status' => null,
                        'recorded_at' => $recordedAt,
                    ];
                }
            }
        }

        if (empty($rows)) {
            $errors[] = 'No se detectó bloque válido "nombre + fecha + hora" en XLS legacy.';
        }

        return [$rows, $errors];
    }

    private function extractBinaryTextLines(string $rawContents): array
    {
        $matches = [];
        preg_match_all('/[A-Za-z0-9\/:~().,_+\-\s]{3,}/', $rawContents, $matches);
        $rawLines = $matches[0] ?? [];

        $lines = [];
        foreach ($rawLines as $segment) {
            $candidate = trim(preg_replace('/\s+/', ' ', (string) $segment) ?? '');
            if ($candidate === '') {
                continue;
            }

            if (strlen($candidate) > 180) {
                continue;
            }

            if (preg_match('/^[\d\s\.,\-\/:]+$/', $candidate) && ! preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $candidate) && ! preg_match('/^\d{1,2}:\d{2}/', $candidate)) {
                continue;
            }

            $lines[] = $candidate;
        }

        return $lines;
    }

    private function isLikelyLegacyUserName(string $value): bool
    {
        $candidate = trim(Str::of($value)->ascii()->lower()->value());
        if ($candidate === '') {
            return false;
        }

        if (strlen($candidate) < 3 || strlen($candidate) > 40) {
            return false;
        }

        if (preg_match('/^\d+$/', $candidate)) {
            return false;
        }

        if (preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $candidate) || preg_match('/^\d{1,2}:\d{2}/', $candidate)) {
            return false;
        }

        $blockedWords = [
            'resumen',
            'anormal',
            'turno',
            'tabla',
            'periodo',
            'impreso',
            'estado',
            'post',
            'logistica',
            'asistencia',
            'depart',
            'duracion',
            'requer',
            'retardo',
            'salida',
            'normal',
            'especial',
            'ausencia',
            'pago',
            'allowance',
            'cods',
            'favor de llenar',
            'reporte',
            'rep.',
        ];

        foreach ($blockedWords as $blockedWord) {
            if (str_contains($candidate, $blockedWord)) {
                return false;
            }
        }

        return (bool) preg_match('/[a-z]/', $candidate);
    }

    private function resolveAttendanceTimezone(): string
    {
        $fallback = 'America/Argentina/Buenos_Aires';

        $fromEnv = env('ATTENDANCE_TIMEZONE');
        if (is_string($fromEnv) && trim($fromEnv) !== '') {
            return trim($fromEnv);
        }

        if (! function_exists('config')) {
            return $fallback;
        }

        try {
            $configured = config('app.timezone');
            if (is_string($configured) && trim($configured) !== '') {
                $normalized = strtolower(trim($configured));
                if ($normalized !== 'utc') {
                    return trim($configured);
                }
            }
        } catch (\Throwable $e) {
            // ignore and fallback
        }

        return $fallback;
    }

    private function buildImportPreviewLines(string $contents, int $limit = 3): array
    {
        $lines = preg_split('/\r\n|\n|\r/', $contents) ?: [];
        $lines = array_values(array_filter(
            array_map(fn ($line) => trim((string) $line), $lines),
            fn ($line) => $line !== ''
        ));

        $preview = [];
        foreach (array_slice($lines, 0, max(1, $limit)) as $line) {
            $preview[] = mb_strimwidth($line, 0, 140, '...');
        }

        return $preview;
    }

    private function readImportContents(string $rawContents): string
    {
        $xlsxContents = $this->extractTextFromXlsxRaw($rawContents);
        if (is_string($xlsxContents) && trim($xlsxContents) !== '') {
            return $xlsxContents;
        }

        return $this->decodeImportContents($rawContents);
    }

    private function extractTextFromXlsxRaw(string $rawContents): ?string
    {
        if (! str_starts_with($rawContents, "PK\x03\x04")) {
            return null;
        }

        $tmpPath = tempnam(sys_get_temp_dir(), 'att_xlsx_');
        if (! is_string($tmpPath) || $tmpPath === '') {
            return null;
        }

        try {
            if (@file_put_contents($tmpPath, $rawContents) === false) {
                return null;
            }

            $zip = new \ZipArchive();
            if ($zip->open($tmpPath) !== true) {
                return null;
            }

            $contentTypes = $zip->getFromName('[Content_Types].xml');
            if (! is_string($contentTypes) || ! str_contains($contentTypes, 'spreadsheetml')) {
                $zip->close();
                return null;
            }

            $sharedStrings = $this->extractSharedStringsFromXlsx($zip);
            $dateStyles = $this->extractDateStylesFromXlsx($zip);
            $sheetXmlMap = $this->extractWorksheetXmlMap($zip);
            $zip->close();

            if (empty($sheetXmlMap)) {
                return null;
            }

            $bestRows = [];
            $bestScore = -1;
            $bestFallbackSize = -1;

            foreach ($sheetXmlMap as $sheetXml) {
                $rows = $this->extractRowsFromWorksheetXml($sheetXml, $sharedStrings, $dateStyles);
                if (empty($rows)) {
                    continue;
                }

                $sheetScore = $this->scoreWorksheetRows($rows);
                $fallbackSize = count($rows);

                if ($sheetScore > $bestScore || ($sheetScore === $bestScore && $fallbackSize > $bestFallbackSize)) {
                    $bestScore = $sheetScore;
                    $bestFallbackSize = $fallbackSize;
                    $bestRows = $rows;
                }
            }

            $rows = $bestRows;
            if (empty($rows)) {
                return null;
            }

            return $this->rowsToDelimitedText($rows, ';');
        } catch (\Throwable $e) {
            return null;
        } finally {
            @unlink($tmpPath);
        }
    }

    private function extractSharedStringsFromXlsx(\ZipArchive $zip): array
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
            $parts = $node->xpath('.//x:t') ?: [];
            $text = '';
            foreach ($parts as $part) {
                $text .= (string) $part;
            }
            $values[] = trim($text);
        }

        return $values;
    }

    private function extractDateStylesFromXlsx(\ZipArchive $zip): array
    {
        $xml = $zip->getFromName('xl/styles.xml');
        if (! is_string($xml) || trim($xml) === '') {
            return [];
        }

        $dom = @simplexml_load_string($xml);
        if (! $dom) {
            return [];
        }

        $dom->registerXPathNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
        $customNumFmtNodes = $dom->xpath('//x:numFmts/x:numFmt') ?: [];
        $customNumFormats = [];
        foreach ($customNumFmtNodes as $node) {
            $id = (int) ($node['numFmtId'] ?? -1);
            $code = (string) ($node['formatCode'] ?? '');
            if ($id >= 0) {
                $customNumFormats[$id] = strtolower($code);
            }
        }

        $dateNumFmtIds = [14, 15, 16, 17, 22];

        $styleMap = [];
        $xfNodes = $dom->xpath('//x:cellXfs/x:xf') ?: [];
        foreach ($xfNodes as $index => $xf) {
            $numFmtId = (int) ($xf['numFmtId'] ?? -1);
            $formatCode = $customNumFormats[$numFmtId] ?? '';
            $hasDateToken = in_array($numFmtId, $dateNumFmtIds, true)
                || ($formatCode !== '' && preg_match('/[yd]/i', $formatCode));
            $hasTimeToken = in_array($numFmtId, [18, 19, 20, 21, 22, 45, 46, 47], true)
                || ($formatCode !== '' && preg_match('/[hs]/i', $formatCode));

            if ($hasDateToken || $hasTimeToken) {
                if ($hasDateToken && $hasTimeToken) {
                    $styleMap[(int) $index] = 'datetime';
                } elseif ($hasDateToken) {
                    $styleMap[(int) $index] = 'date';
                } else {
                    $styleMap[(int) $index] = 'time';
                }
            }
        }

        return $styleMap;
    }

    private function extractWorksheetXmlMap(\ZipArchive $zip): array
    {
        $sheetPaths = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (! is_string($name)) {
                continue;
            }
            if (preg_match('#^xl/worksheets/sheet\d+\.xml$#i', $name)) {
                $sheetPaths[] = $name;
            }
        }

        if (empty($sheetPaths)) {
            return [];
        }

        sort($sheetPaths, SORT_NATURAL);
        $map = [];
        foreach ($sheetPaths as $sheetPath) {
            $xml = $zip->getFromName($sheetPath);
            if (is_string($xml) && trim($xml) !== '') {
                $map[$sheetPath] = $xml;
            }
        }

        return $map;
    }

    private function scoreWorksheetRows(array $rows): int
    {
        $score = 0;

        foreach ($rows as $row) {
            $hasDate = false;
            $hasTime = false;
            foreach ($row as $cell) {
                $value = trim((string) $cell);
                if ($value === '') {
                    continue;
                }
                if (! $hasDate && $this->hasDateComponent($value)) {
                    $hasDate = true;
                }
                if (! $hasTime && $this->hasTimeComponent($value)) {
                    $hasTime = true;
                }
            }

            if ($hasDate && $hasTime) {
                $score += 3;
            } elseif ($hasDate || $hasTime) {
                $score += 1;
            }
        }

        return $score;
    }

    private function extractRowsFromWorksheetXml(string $sheetXml, array $sharedStrings, array $dateStyles): array
    {
        $dom = @simplexml_load_string($sheetXml);
        if (! $dom) {
            return [];
        }

        $dom->registerXPathNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
        $rowNodes = $dom->xpath('//x:sheetData/x:row') ?: [];
        $rows = [];

        foreach ($rowNodes as $rowNode) {
            $cells = $rowNode->xpath('./x:c') ?: [];
            $row = [];

            foreach ($cells as $cellNode) {
                $ref = (string) ($cellNode['r'] ?? '');
                $letters = preg_replace('/\d+/', '', $ref) ?? '';
                $columnIndex = $letters !== '' ? $this->columnLettersToIndex($letters) : count($row);
                if ($columnIndex < 0) {
                    $columnIndex = count($row);
                }

                while (count($row) <= $columnIndex) {
                    $row[] = '';
                }

                $row[$columnIndex] = $this->extractWorksheetCellValue($cellNode, $sharedStrings, $dateStyles);
            }

            if (count(array_filter($row, fn ($value) => trim((string) $value) !== '')) > 0) {
                $rows[] = $row;
            }
        }

        return $rows;
    }

    private function extractWorksheetCellValue(\SimpleXMLElement $cellNode, array $sharedStrings, array $dateStyles): string
    {
        $type = (string) ($cellNode['t'] ?? '');
        $styleId = (int) ($cellNode['s'] ?? -1);

        if ($type === 's') {
            $index = (int) ($cellNode->v ?? -1);
            return isset($sharedStrings[$index]) ? trim((string) $sharedStrings[$index]) : '';
        }

        if ($type === 'inlineStr') {
            $parts = $cellNode->xpath('.//x:t');
            if (! is_array($parts)) {
                $parts = $cellNode->xpath('.//*[local-name()="t"]');
            }
            $text = '';
            foreach (($parts ?: []) as $part) {
                $text .= (string) $part;
            }
            return trim($text);
        }

        $rawValue = trim((string) ($cellNode->v ?? ''));
        if ($rawValue === '') {
            return '';
        }

        if (is_numeric($rawValue) && isset($dateStyles[$styleId])) {
            $serial = (float) $rawValue;
            $seconds = (int) round($serial * 86400);
            $date = Carbon::create(1899, 12, 30, 0, 0, 0, 'UTC')->addSeconds($seconds);
            $kind = $dateStyles[$styleId];
            if ($kind === 'time') {
                return $date->format('H:i:s');
            }
            if ($kind === 'date') {
                return $date->format('d/m/Y');
            }
            return $date->format('d/m/Y H:i:s');
        }

        return $rawValue;
    }

    private function rowsToDelimitedText(array $rows, string $delimiter): string
    {
        $lines = [];
        foreach ($rows as $row) {
            $cells = array_map(function ($value) use ($delimiter) {
                $text = trim((string) $value);
                $needsQuotes = str_contains($text, $delimiter) || str_contains($text, '"') || str_contains($text, "\n");
                if ($needsQuotes) {
                    $text = '"' . str_replace('"', '""', $text) . '"';
                }
                return $text;
            }, $row);
            $lines[] = implode($delimiter, $cells);
        }

        return implode("\n", $lines);
    }

    private function columnLettersToIndex(string $letters): int
    {
        $letters = strtoupper(trim($letters));
        if ($letters === '') {
            return -1;
        }

        $index = 0;
        $length = strlen($letters);
        for ($i = 0; $i < $length; $i++) {
            $char = ord($letters[$i]);
            if ($char < 65 || $char > 90) {
                return -1;
            }
            $index = $index * 26 + ($char - 64);
        }

        return $index - 1;
    }

    private function decodeImportContents(string $rawContents): string
    {
        if (str_starts_with($rawContents, "\xEF\xBB\xBF")) {
            $rawContents = substr($rawContents, 3);
        }

        if (str_starts_with($rawContents, "\xFF\xFE")) {
            $decoded = mb_convert_encoding(substr($rawContents, 2), 'UTF-8', 'UTF-16LE');
            return $this->sanitizeDecodedContents($decoded);
        }

        if (str_starts_with($rawContents, "\xFE\xFF")) {
            $decoded = mb_convert_encoding(substr($rawContents, 2), 'UTF-8', 'UTF-16BE');
            return $this->sanitizeDecodedContents($decoded);
        }

        $sourceEncoding = null;
        if (str_contains($rawContents, "\x00")) {
            $sourceEncoding = $this->detectUtf16Encoding($rawContents);
        }

        if (! $sourceEncoding) {
            $sourceEncoding = mb_detect_encoding(
                $rawContents,
                ['UTF-8', 'UTF-16LE', 'UTF-16BE', 'Windows-1252', 'ISO-8859-1'],
                true
            ) ?: null;
        }

        if ($sourceEncoding && strtoupper($sourceEncoding) !== 'UTF-8') {
            $decoded = mb_convert_encoding($rawContents, 'UTF-8', $sourceEncoding);
            return $this->sanitizeDecodedContents($decoded);
        }

        return $this->sanitizeDecodedContents($rawContents);
    }

    private function detectUtf16Encoding(string $contents): ?string
    {
        $sample = substr($contents, 0, min(4000, strlen($contents)));
        $pairs = intdiv(strlen($sample), 2);
        if ($pairs <= 0) {
            return null;
        }

        $evenNull = 0;
        $oddNull = 0;

        for ($i = 0; $i < $pairs * 2; $i += 2) {
            if ($sample[$i] === "\x00") {
                $evenNull++;
            }
            if ($sample[$i + 1] === "\x00") {
                $oddNull++;
            }
        }

        $evenRatio = $evenNull / $pairs;
        $oddRatio = $oddNull / $pairs;

        if ($oddRatio > 0.2 && $oddRatio > $evenRatio * 1.5) {
            return 'UTF-16LE';
        }

        if ($evenRatio > 0.2 && $evenRatio > $oddRatio * 1.5) {
            return 'UTF-16BE';
        }

        return null;
    }

    private function sanitizeDecodedContents(string $contents): string
    {
        $contents = str_replace("\0", '', $contents);
        $contents = preg_replace('/^\xEF\xBB\xBF/u', '', $contents) ?? $contents;
        return $contents;
    }

    private function extractImportRow(array $cells, array $headerMap, int $lineNumber): array
    {
        $userCode = $this->extractCell('user_code', $cells, $headerMap);
        $userName = $this->extractCell('user_name', $cells, $headerMap);
        $rawStatus = $this->extractCell('status', $cells, $headerMap);
        $dateCell = $this->extractCell('date', $cells, $headerMap);
        $timeCell = $this->extractCell('time', $cells, $headerMap);
        $dateTimeCell = $this->extractCell('datetime', $cells, $headerMap);

        $status = $this->normalizeStatus($rawStatus);
        if (! $status) {
            foreach ($cells as $cell) {
                $status = $this->normalizeStatus($cell);
                if ($status) {
                    break;
                }
            }
        }

        $recordedAt = $this->parseTimestamp($dateTimeCell, $dateCell, $timeCell);
        if (! $recordedAt) {
            $recordedAt = $this->findTimestampFromCells($cells);
        }

        if (! $userName) {
            $userName = $this->guessUserName($cells);
        }
        if (! $userCode) {
            $userCode = $this->guessUserCode($cells);
        }

        if (! $recordedAt) {
            if ($this->shouldIgnoreNonDataRow($cells, $status, $userCode, $userName)) {
                return [null, null];
            }
            return [null, sprintf('Línea %d: no se encontró fecha/hora válida.', $lineNumber)];
        }

        if (! $userName && ! $userCode) {
            return [null, sprintf('Línea %d: no se encontró usuario/legajo válido.', $lineNumber)];
        }

        return [[
            'line' => $lineNumber,
            'user_code' => $userCode ? trim($userCode) : null,
            'user_name' => $userName ? trim($userName) : null,
            'status' => $status,
            'recorded_at' => $recordedAt,
        ], null];
    }

    private function shouldIgnoreNonDataRow(
        array $cells,
        ?string $status,
        ?string $userCode,
        ?string $userName
    ): bool {
        if (! $this->cellsContainDateComponent($cells)) {
            return true;
        }

        $filledCells = array_values(array_filter(
            array_map(fn ($value) => trim((string) $value), $cells),
            fn ($value) => $value !== ''
        ));

        if (count($filledCells) === 0) {
            return true;
        }

        if (count($filledCells) <= 2) {
            $joined = Str::of(implode(' ', $filledCells))->ascii()->lower()->value();
            if (preg_match('/\b(reporte|report|export|empresa|dispositivo|terminal|c26|pro\s*soft|desde|hasta|registros|total)\b/', $joined)) {
                return true;
            }
            if (! preg_match('/\d/', $joined)) {
                return true;
            }
        }

        return false;
    }

    private function parseCsvLine(string $line, string $delimiter): array
    {
        return str_getcsv($line, $delimiter, '"', '\\');
    }

    private function detectDelimiter(string $line): string
    {
        $candidates = [
            ';',
            ',',
            "\t",
            '|',
        ];

        $scores = [];
        foreach ($candidates as $candidate) {
            $scores[$candidate] = substr_count($line, $candidate);
        }
        arsort($scores);

        $delimiter = array_key_first($scores);
        return ($scores[$delimiter] ?? 0) > 0 ? $delimiter : ';';
    }

    private function looksLikeHeader(array $cells): bool
    {
        $hits = 0;
        foreach ($cells as $cell) {
            $normalized = $this->normalizeHeader((string) $cell);
            if ($normalized === '') {
                continue;
            }
            foreach (self::HEADER_ALIASES as $aliases) {
                if (in_array($normalized, $aliases, true)) {
                    $hits++;
                    break;
                }
            }
        }

        return $hits > 0;
    }

    private function buildHeaderMap(array $cells): array
    {
        $map = [];
        foreach ($cells as $index => $cell) {
            $normalized = $this->normalizeHeader((string) $cell);
            if ($normalized === '') {
                continue;
            }

            foreach (self::HEADER_ALIASES as $field => $aliases) {
                if (in_array($normalized, $aliases, true) && ! array_key_exists($field, $map)) {
                    $map[$field] = $index;
                }
            }
        }

        return $map;
    }

    private function normalizeHeader(string $value): string
    {
        $ascii = Str::of($value)->ascii()->lower()->trim()->value();
        return preg_replace('/[^a-z0-9]/', '', $ascii) ?? '';
    }

    private function extractCell(string $field, array $cells, array $headerMap): ?string
    {
        if (! array_key_exists($field, $headerMap)) {
            return null;
        }
        $index = $headerMap[$field];
        if (! array_key_exists($index, $cells)) {
            return null;
        }
        $value = trim((string) $cells[$index]);
        return $value === '' ? null : $value;
    }

    private function normalizeStatus(?string $rawStatus): ?string
    {
        if ($rawStatus === null) {
            return null;
        }
        $normalized = Str::of($rawStatus)->ascii()->lower()->trim()->value();
        $normalized = preg_replace('/[^a-z0-9]/', '', $normalized) ?? '';
        if ($normalized === '') {
            return null;
        }
        return self::STATUS_ALIASES[$normalized] ?? null;
    }

    private function parseTimestamp(?string $dateTimeCell, ?string $dateCell, ?string $timeCell): ?Carbon
    {
        if ($dateTimeCell) {
            $parsed = $this->parseDateTimeValue($dateTimeCell);
            if ($parsed) {
                return $parsed;
            }

            $parsedSerial = $this->parseExcelSerialDateTime($dateTimeCell);
            if ($parsedSerial) {
                return $parsedSerial;
            }
        }

        if ($dateCell) {
            $parsedDate = $this->parseDateValue($dateCell) ?? $this->parseExcelSerialDate($dateCell);

            if ($timeCell) {
                $parsed = $this->parseDateTimeValue(sprintf('%s %s', $dateCell, $timeCell));
                if ($parsed) {
                    return $parsed;
                }

                $parsedTime = $this->parseTimeValue($timeCell) ?? $this->parseExcelSerialTime($timeCell);
                if ($parsedDate && $parsedTime) {
                    return $parsedDate
                        ->copy()
                        ->setTime(
                            $parsedTime['hour'],
                            $parsedTime['minute'],
                            $parsedTime['second']
                        );
                }
            }

            if ($parsedDate) {
                $parsedDateTime = $this->parseExcelSerialDateTime($dateCell);
                if ($parsedDateTime) {
                    return $parsedDateTime;
                }
            }
        }

        return null;
    }

    private function findTimestampFromCells(array $cells): ?Carbon
    {
        foreach ($cells as $cell) {
            $parsed = $this->parseDateTimeValue((string) $cell);
            if ($parsed) {
                return $parsed;
            }

            $parsedSerial = $this->parseExcelSerialDateTime((string) $cell);
            if ($parsedSerial) {
                return $parsedSerial;
            }
        }

        for ($i = 0; $i < count($cells) - 1; $i++) {
            $combined = sprintf('%s %s', trim((string) $cells[$i]), trim((string) $cells[$i + 1]));
            $parsed = $this->parseDateTimeValue($combined);
            if ($parsed) {
                return $parsed;
            }
        }

        $dateCandidates = [];
        $timeCandidates = [];

        foreach ($cells as $cell) {
            $value = trim((string) $cell);
            if ($value === '') {
                continue;
            }

            $parsedDate = $this->parseDateValue($value) ?? $this->parseExcelSerialDate($value);
            if ($parsedDate) {
                $dateCandidates[] = $parsedDate;
            }

            $parsedTime = $this->parseTimeValue($value) ?? $this->parseExcelSerialTime($value);
            if ($parsedTime) {
                $timeCandidates[] = $parsedTime;
            }
        }

        if (! empty($dateCandidates) && ! empty($timeCandidates)) {
            $date = $dateCandidates[0];
            $time = $timeCandidates[0];
            return $date->copy()->setTime($time['hour'], $time['minute'], $time['second']);
        }

        return null;
    }

    private function parseDateTimeValue(string $value): ?Carbon
    {
        $candidate = trim($value);
        if ($candidate === '') {
            return null;
        }
        $timezone = $this->resolveAttendanceTimezone();
        $candidate = str_replace('T', ' ', $candidate);
        $candidate = preg_replace('/\s+/', ' ', $candidate) ?? $candidate;

        if (is_numeric($candidate)) {
            return $this->parseExcelSerialDateTime($candidate);
        }

        if (! $this->hasDateComponent($candidate) || ! $this->hasTimeComponent($candidate)) {
            return null;
        }

        foreach (self::DATETIME_FORMATS as $format) {
            try {
                $parsed = Carbon::createFromFormat($format, $candidate, $timezone);
                if ($parsed->year < 2000 || $parsed->year > 2100) {
                    continue;
                }
                return $parsed;
            } catch (\Throwable $e) {
                // continue
            }
        }

        try {
            $parsed = Carbon::parse($candidate, $timezone);
            if ($parsed->year < 2000 || $parsed->year > 2100) {
                return null;
            }
            return $parsed;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function parseDateValue(string $value): ?Carbon
    {
        $candidate = trim($value);
        if ($candidate === '') {
            return null;
        }
        $timezone = $this->resolveAttendanceTimezone();

        foreach (self::DATE_FORMATS as $format) {
            try {
                return Carbon::createFromFormat($format, $candidate, $timezone);
            } catch (\Throwable $e) {
                // continue
            }
        }

        return null;
    }

    private function parseTimeValue(string $value): ?array
    {
        $candidate = trim($value);
        if ($candidate === '' || ! preg_match('/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?$/', $candidate, $matches)) {
            return null;
        }

        $hour = (int) $matches[1];
        $minute = (int) $matches[2];
        $second = isset($matches[3]) ? (int) $matches[3] : 0;

        if ($hour < 0 || $hour > 23 || $minute < 0 || $minute > 59 || $second < 0 || $second > 59) {
            return null;
        }

        return [
            'hour' => $hour,
            'minute' => $minute,
            'second' => $second,
        ];
    }

    private function parseExcelSerialDateTime(string $value): ?Carbon
    {
        $candidate = trim($value);
        if ($candidate === '' || ! is_numeric($candidate)) {
            return null;
        }

        $serial = (float) $candidate;
        if ($serial < 20000 || $serial > 90000) {
            return null;
        }

        $fraction = $serial - floor($serial);
        if ($fraction <= 0) {
            return null;
        }

        $seconds = (int) round($serial * 86400);
        $date = Carbon::create(1899, 12, 30, 0, 0, 0, $this->resolveAttendanceTimezone())->addSeconds($seconds);
        if ($date->year < 2000 || $date->year > 2100) {
            return null;
        }

        return $date;
    }

    private function parseExcelSerialDate(string $value): ?Carbon
    {
        $candidate = trim($value);
        if ($candidate === '' || ! is_numeric($candidate)) {
            return null;
        }

        $serial = (float) $candidate;
        if ($serial < 20000 || $serial > 90000) {
            return null;
        }

        $days = (int) floor($serial);
        $date = Carbon::create(1899, 12, 30, 0, 0, 0, $this->resolveAttendanceTimezone())->addDays($days);
        if ($date->year < 2000 || $date->year > 2100) {
            return null;
        }

        return $date->startOfDay();
    }

    private function parseExcelSerialTime(string $value): ?array
    {
        $candidate = trim($value);
        if ($candidate === '' || ! is_numeric($candidate)) {
            return null;
        }

        $serial = (float) $candidate;
        if ($serial <= 0 || $serial >= 1) {
            return null;
        }

        $seconds = (int) round($serial * 86400);
        $seconds = $seconds % 86400;

        return [
            'hour' => intdiv($seconds, 3600),
            'minute' => intdiv($seconds % 3600, 60),
            'second' => $seconds % 60,
        ];
    }

    private function guessUserName(array $cells): ?string
    {
        foreach ($cells as $cell) {
            $candidate = trim((string) $cell);
            if ($candidate === '') {
                continue;
            }
            if ($this->normalizeStatus($candidate)) {
                continue;
            }
            if ($this->parseDateTimeValue($candidate) || $this->parseDateValue($candidate)) {
                continue;
            }
            if (preg_match('/^\d+$/', $candidate)) {
                continue;
            }
            if (preg_match('/[A-Za-zÁÉÍÓÚáéíóúÑñ]/', $candidate)) {
                return preg_replace('/\s+/', ' ', $candidate) ?? $candidate;
            }
        }

        return null;
    }

    private function guessUserCode(array $cells): ?string
    {
        foreach ($cells as $cell) {
            $candidate = trim((string) $cell);
            if ($candidate === '') {
                continue;
            }
            if ($this->parseDateTimeValue($candidate) || $this->parseDateValue($candidate)) {
                continue;
            }
            if ($this->normalizeStatus($candidate)) {
                continue;
            }
            if (preg_match('/^\d{1,10}$/', $candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    private function normalizePersonName(?string $name): string
    {
        if (! $name) {
            return '';
        }
        $normalized = Str::of($name)->ascii()->lower()->trim()->value();
        $normalized = preg_replace('/\s+/', ' ', $normalized) ?? $normalized;
        return $normalized;
    }

    private function resolveUser(
        ?string $name,
        ?string $code,
        array $usersById,
        array $usersByName,
        array $usersByNameLoose
    ): array
    {
        $userId = null;
        $userName = $this->sanitizeUserName($name);

        if ($code && ctype_digit($code)) {
            $candidateId = (int) $code;
            if (array_key_exists($candidateId, $usersById)) {
                $userId = $candidateId;
            }
        }

        if ($userId === null && $userName) {
            $normalizedName = $this->normalizePersonName($userName);
            if ($normalizedName !== '' && array_key_exists($normalizedName, $usersByName)) {
                $userId = (int) $usersByName[$normalizedName];
            }
        }

        if ($userId === null && $userName) {
            $normalizedLoose = $this->normalizePersonNameLoose($userName);
            if ($normalizedLoose !== '' && array_key_exists($normalizedLoose, $usersByNameLoose)) {
                $userId = (int) $usersByNameLoose[$normalizedLoose];
            } elseif ($normalizedLoose !== '') {
                $candidates = [];
                foreach ($usersByNameLoose as $knownName => $knownId) {
                    if ($knownName !== '' && (str_contains($normalizedLoose, $knownName) || str_contains($knownName, $normalizedLoose))) {
                        $candidates[$knownId] = true;
                    }
                }
                if (count($candidates) === 1) {
                    $userId = (int) array_key_first($candidates);
                }
            }
        }

        if ($userId !== null) {
            $userName = $usersById[$userId] ?? $userName;
        }

        if ((! $userName || $userName === '') && $code) {
            $userName = sprintf('Legajo %s', $code);
        }

        return [$userId, $userName];
    }

    private function buildIdentityKey(?int $userId, string $userName, ?string $userCode): string
    {
        if ($userId !== null) {
            return sprintf('id:%d', $userId);
        }
        if ($userName !== '') {
            return sprintf('name:%s', $this->normalizePersonName($userName));
        }
        return sprintf('code:%s', $userCode ?? '');
    }

    private function findLastStatus(?int $userId, string $userName, Carbon $beforeDate): ?string
    {
        $normalizedName = $this->normalizePersonName($userName);

        return AttendanceRecord::query()
            ->where('recorded_at', '<=', $beforeDate)
            ->where(function ($builder) use ($userId, $normalizedName) {
                if ($userId !== null) {
                    $builder->where('user_id', $userId);
                } else {
                    $builder->whereRaw('LOWER(COALESCE(user_name, "")) = ?', [$normalizedName]);
                }
            })
            ->orderByDesc('recorded_at')
            ->value('status');
    }

    private function sanitizeUserName(?string $name): ?string
    {
        if ($name === null) {
            return null;
        }

        $clean = trim($name);
        if ($clean === '') {
            return null;
        }

        $clean = preg_replace('/\x{FFFD}/u', ' ', $clean) ?? $clean;
        $clean = preg_replace('/[^\p{L}\p{N}\s\.\'-]/u', ' ', $clean) ?? $clean;
        $clean = preg_replace('/\s+/', ' ', $clean) ?? $clean;
        $clean = trim($clean);

        return $clean !== '' ? $clean : null;
    }

    private function normalizePersonNameLoose(?string $name): string
    {
        if (! $name) {
            return '';
        }

        $normalized = Str::of($name)->ascii()->lower()->trim()->value();
        $normalized = preg_replace('/[^a-z0-9]+/', ' ', $normalized) ?? $normalized;
        $normalized = preg_replace('/\s+/', ' ', $normalized) ?? $normalized;
        return trim($normalized);
    }

    private function hasDateComponent(string $value): bool
    {
        $candidate = trim($value);
        if ($candidate === '') {
            return false;
        }

        if (is_numeric($candidate)) {
            $serial = (float) $candidate;
            return $serial >= 20000 && $serial <= 90000;
        }

        if (preg_match('/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/u', $candidate)) {
            return true;
        }

        if (preg_match('/\b\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}\b/u', $candidate)) {
            return true;
        }

        if (preg_match('/\b\d{8}\b/u', $candidate)) {
            return true;
        }

        return false;
    }

    private function hasTimeComponent(string $value): bool
    {
        $candidate = trim($value);
        if ($candidate === '') {
            return false;
        }

        if (is_numeric($candidate)) {
            $serial = (float) $candidate;
            return $serial > 0 && $serial < 1;
        }

        return (bool) preg_match('/\b\d{1,2}[:.]\d{2}([:.]\d{2})?\b/u', $candidate);
    }

    private function cellsContainDateComponent(array $cells): bool
    {
        foreach ($cells as $cell) {
            if ($this->hasDateComponent((string) $cell)) {
                return true;
            }
        }

        for ($i = 0; $i < count($cells) - 1; $i++) {
            $combined = trim((string) $cells[$i]) . ' ' . trim((string) $cells[$i + 1]);
            if ($this->hasDateComponent($combined)) {
                return true;
            }
        }

        return false;
    }

    private function ensureAdmin(Request $request): void
    {
        $role = strtolower((string) ($request->user()?->role ?? ''));
        if (str_contains($role, 'admin')) {
            return;
        }

        throw new AuthorizationException('Solo administradores pueden limpiar registros de asistencia.');
    }
}

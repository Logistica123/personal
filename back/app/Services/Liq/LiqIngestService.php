<?php

namespace App\Services\Liq;

use App\Models\LiqArchivoEntrada;
use App\Models\LiqCliente;
use App\Models\LiqDimensionValor;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqLineaTarifa;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqMapeoConcepto;
use App\Models\LiqMapeoSucursal;
use App\Models\LiqOperacion;
use App\Models\LiqTarifaPatente;
use App\Models\Persona;
use App\Services\FacturaAi\PdfTextExtractor;
use App\Support\Personal\PersonaPatenteHelper;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;
use RuntimeException;

class LiqIngestService
{
    private const DEFAULT_PDF_SKIP_PATTERNS = [
        'TOTAL',
        'SUBTOTAL',
        'PAGINA ',
        'PÁGINA ',
    ];

    private const SUPPORTED_MATCHING_STRATEGIES = [
        'patente',
        'cuil',
        'legajo',
        'nombre_exacto',
        'nombre_fuzzy',
    ];

    public function __construct(
        private readonly PdfTextExtractor $pdfTextExtractor,
    ) {}

    /**
     * Process an uploaded file and create LiqOperacion records.
     */
    public function procesarArchivo(LiqArchivoEntrada $archivo, LiqLiquidacionCliente $liquidacion): array
    {
        $disk = $archivo->disk ?: 'local';
        $ruta = $archivo->ruta_storage;
        if (! $ruta || ! Storage::disk($disk)->exists($ruta)) {
            throw new RuntimeException("Archivo no encontrado: {$ruta}");
        }

        $path = Storage::disk($disk)->path($ruta);
        $cliente = $liquidacion->cliente;
        $config = is_array($cliente?->configuracion_excel) ? $cliente->configuracion_excel : [];

        $esquema = LiqEsquemaTarifario::where('cliente_id', $liquidacion->cliente_id)
            ->where('activo', true)
            ->latest()
            ->first();
        if (! $esquema) {
            throw new RuntimeException('No hay un esquema tarifario activo para este cliente');
        }

        $records = $this->isPdfPath($path)
            ? $this->extractPdfRecords($path, $cliente, $config)
            : $this->extractSpreadsheetRecords($path, $config, $esquema);

        return $this->procesarRegistros($archivo, $liquidacion, $esquema, $config, $records);
    }

    /**
     * @return array<int, array{campos_originales: array<string, mixed>, field_values: array<string, mixed>, row_number: int|null}>
     */
    private function extractSpreadsheetRecords(string $path, array $config, LiqEsquemaTarifario $esquema): array
    {
        if (! class_exists(IOFactory::class)) {
            throw new RuntimeException(
                "No se encontró PhpSpreadsheet (IOFactory). Ejecutá `composer install` en `back/` " .
                "o instalá `phpoffice/phpspreadsheet`."
            );
        }
        if (! class_exists(\ZipArchive::class)) {
            throw new RuntimeException(
                "Falta la extensión PHP `zip` (ZipArchive) para leer archivos .xlsx. " .
                "Instalá/activá `php-zip` y reiniciá PHP."
            );
        }

        $spreadsheet = IOFactory::load($path);
        $sheetName = $config['hoja'] ?? 'Detalle';

        try {
            $sheet = $spreadsheet->getSheetByName($sheetName) ?? $spreadsheet->getActiveSheet();
        } catch (\Throwable $e) {
            throw new RuntimeException("Hoja '{$sheetName}' no encontrada en el archivo");
        }

        $rows = $sheet->toArray(null, true, true, false);
        if (empty($rows)) {
            throw new RuntimeException('El archivo está vacío');
        }

        $headerRow = max(0, (int) ($config['fila_datos'] ?? 1) - 1);
        $dataStartRow = $headerRow + 1;
        $headers = array_map(fn ($h) => trim((string) ($h ?? '')), $rows[$headerRow] ?? []);
        $columnMap = is_array($config['mapeo_columnas'] ?? null)
            ? $config['mapeo_columnas']
            : $this->autoDetectColumns($headers);

        $required = ['patente', 'valor'];
        if (in_array('concepto', $esquema->dimensiones ?? [], true) || isset($columnMap['concepto'])) {
            $required[] = 'concepto';
        }
        foreach ($required as $col) {
            if (! isset($columnMap[$col])) {
                throw new RuntimeException(
                    "Columna requerida no encontrada: {$col}. Headers disponibles: " . implode(', ', $headers)
                );
            }
        }

        $records = [];
        foreach (array_slice($rows, $dataStartRow) as $offset => $row) {
            $camposOriginales = [];
            foreach ($headers as $idx => $header) {
                if ($header !== '') {
                    $camposOriginales[$header] = $row[$idx] ?? null;
                }
            }

            $fieldValues = [];
            foreach ($columnMap as $field => $idx) {
                if (! is_string($field) || ! is_numeric($idx)) {
                    continue;
                }
                $fieldValues[$this->normalizarClaveCampo($field)] = $row[(int) $idx] ?? null;
            }
            foreach ($camposOriginales as $header => $value) {
                $normalizedHeader = $this->normalizarClaveCampo($header);
                if ($normalizedHeader !== '' && ! array_key_exists($normalizedHeader, $fieldValues)) {
                    $fieldValues[$normalizedHeader] = $value;
                }
            }

            $records[] = [
                'campos_originales' => $camposOriginales,
                'field_values' => $fieldValues,
                'row_number' => $dataStartRow + $offset + 1,
            ];
        }

        return $records;
    }

    /**
     * @return array<int, array{campos_originales: array<string, mixed>, field_values: array<string, mixed>, row_number: int|null}>
     */
    private function extractPdfRecords(string $path, LiqCliente $cliente, array $config): array
    {
        $text = $this->pdfTextExtractor->extract($path);
        $patterns = $this->resolvePdfOperationPatterns($cliente, $config);
        $skipPatterns = $this->resolvePdfSkipPatterns($config);
        $maxLineSpan = max(1, min(3, (int) ($config['pdf_max_line_span'] ?? 1)));
        $defaultConcepto = trim((string) ($config['pdf_concepto_default'] ?? ''));
        $lines = preg_split('/\R/u', $text) ?: [];

        $records = [];
        $totalLines = count($lines);
        for ($lineIndex = 0; $lineIndex < $totalLines; $lineIndex++) {
            $matched = false;

            for ($span = min($maxLineSpan, $totalLines - $lineIndex); $span >= 1; $span--) {
                $chunkLines = array_map(
                    static fn ($line) => trim((string) $line),
                    array_slice($lines, $lineIndex, $span)
                );
                $chunk = trim(implode(' ', array_filter($chunkLines, static fn ($line) => $line !== '')));
                if ($chunk === '' || $this->shouldSkipPdfChunk($chunk, $skipPatterns)) {
                    continue;
                }

                foreach ($patterns as $pattern) {
                    if (preg_match($pattern, $chunk, $matches) !== 1) {
                        continue;
                    }

                    $fieldValues = [];
                    foreach ($matches as $key => $value) {
                        if (! is_string($key)) {
                            continue;
                        }
                        $normalizedKey = $this->normalizarClaveCampo($key);
                        if ($normalizedKey === '') {
                            continue;
                        }
                        $fieldValues[$normalizedKey] = is_string($value) ? trim($value) : $value;
                    }

                    if (! isset($fieldValues['concepto']) && $defaultConcepto !== '') {
                        $fieldValues['concepto'] = $defaultConcepto;
                    }

                    if (! isset($fieldValues['patente']) && isset($fieldValues['dominio'])) {
                        $fieldValues['patente'] = $fieldValues['dominio'];
                    }

                    $camposOriginales = $fieldValues;
                    $camposOriginales['linea_fuente'] = $chunk;
                    $camposOriginales['linea_numero'] = $lineIndex + 1;

                    $records[] = [
                        'campos_originales' => $camposOriginales,
                        'field_values' => $fieldValues,
                        'row_number' => $lineIndex + 1,
                    ];

                    $lineIndex += $span - 1;
                    $matched = true;
                    break 2;
                }
            }
        }

        if ($records === []) {
            throw new RuntimeException(
                'No se detectaron operaciones en el PDF. Configurá `pdf_operacion_regex` o `pdf_operacion_regexes` ' .
                'en el cliente usando grupos con nombre como `patente`, `concepto`, `valor`, `cuil`, `legajo` o `nombre`.'
            );
        }

        return $records;
    }

    /**
     * @param array<int, array{campos_originales: array<string, mixed>, field_values: array<string, mixed>, row_number: int|null}> $records
     */
    private function procesarRegistros(
        LiqArchivoEntrada $archivo,
        LiqLiquidacionCliente $liquidacion,
        LiqEsquemaTarifario $esquema,
        array $config,
        array $records
    ): array {
        $mapeosConcepto = LiqMapeoConcepto::where('cliente_id', $liquidacion->cliente_id)
            ->where('activo', true)
            ->get()
            ->groupBy(fn ($m) => $this->normalizarTexto((string) $m->valor_excel))
            ->map(function ($items) {
                return $items->keyBy('dimension_destino');
            });

        $catalogoDimensiones = [];
        $dimensionValores = LiqDimensionValor::where('esquema_id', $esquema->id)
            ->where('activo', true)
            ->get(['nombre_dimension', 'valor']);
        foreach ($dimensionValores as $dv) {
            $dim = (string) $dv->nombre_dimension;
            $norm = $this->normalizarTexto((string) $dv->valor);
            $catalogoDimensiones[$dim][$norm] = (string) $dv->valor;
        }
        $canon = function (string $dim, string $raw) use ($catalogoDimensiones): string {
            $norm = $this->normalizarTexto($raw);
            return $catalogoDimensiones[$dim][$norm] ?? $raw;
        };

        $sucursalTarifa = $archivo->sucursal;
        if (! $sucursalTarifa) {
            $sucursalTarifa = $this->resolverSucursalDesdeNombre($archivo->nombre_original, $liquidacion->cliente_id);
            if ($sucursalTarifa) {
                $archivo->update(['sucursal' => $sucursalTarifa]);
            }
        }
        if ($sucursalTarifa && in_array('sucursal', $esquema->dimensiones ?? [], true)) {
            $sucursalTarifa = $canon('sucursal', (string) $sucursalTarifa);
            $archivo->update(['sucursal' => $sucursalTarifa]);
        }

        $matchingStrategies = $this->resolveMatchingStrategies($liquidacion->cliente);
        $distribuidoresLookup = $this->buildDistribuidoresLookup();

        $conceptosValorVariable = $config['conceptos_valor_variable'] ?? [];
        $conceptosValorVariableNorm = [];
        if (is_array($conceptosValorVariable)) {
            foreach ($conceptosValorVariable as $conceptoValorVariable) {
                if (is_string($conceptoValorVariable) && trim($conceptoValorVariable) !== '') {
                    $conceptosValorVariableNorm[] = $this->normalizarTexto($conceptoValorVariable);
                }
            }
        }
        $conceptosValorVariableNorm[] = $this->normalizarTexto('Valor Viaje');
        $conceptosValorVariableNorm = array_values(array_unique(array_filter($conceptosValorVariableNorm)));
        $isValorVariable = function (string $conceptoKey, array $dimensionesValores) use ($conceptosValorVariableNorm): bool {
            if (in_array($conceptoKey, $conceptosValorVariableNorm, true)) {
                return true;
            }
            $conceptoTarifa = $dimensionesValores['concepto'] ?? null;
            if (is_string($conceptoTarifa) && $conceptoTarifa !== '') {
                return in_array($this->normalizarTexto($conceptoTarifa), $conceptosValorVariableNorm, true);
            }
            return false;
        };

        $operacionesCreadas = 0;
        $idsVistos = [];

        foreach ($records as $record) {
            $fieldValues = $record['field_values'];
            $rawPatente = $this->firstFieldValue($fieldValues, ['patente', 'dominio']);
            $rawConcepto = $this->firstFieldValue($fieldValues, ['concepto']);
            $rawValor = $this->firstFieldValue($fieldValues, ['valor', 'importe', 'monto', 'precio']);
            $rawCategoriaVehiculo = $this->firstFieldValue($fieldValues, ['categoria_vehiculo', 'tipo_vehiculo', 'vehiculo']);

            if ($this->isRecordEmpty($rawPatente, $rawConcepto, $rawValor)) {
                continue;
            }

            $rawPatenteTxt = strtoupper(trim((string) ($rawPatente ?? '')));
            $rawConceptoTxt = strtoupper(trim((string) ($rawConcepto ?? '')));
            if ($rawPatenteTxt === 'TOTAL' || $rawConceptoTxt === 'TOTAL') {
                continue;
            }

            $dominio = $this->normalizarPatente((string) ($rawPatente ?? ''));
            $concepto = trim((string) ($rawConcepto ?? ''));
            $conceptoKey = $this->normalizarTexto($concepto);
            $valor = $this->parseDecimal($rawValor ?? 0);
            $categoriaVehiculoKey = $this->normalizarTexto(trim((string) ($rawCategoriaVehiculo ?? '')));
            $camposOriginales = $record['campos_originales'];

            $idViaje = $this->firstFieldValue($fieldValues, ['id_viaje', 'viaje_id', 'idviaje']);
            $idViajeNorm = trim((string) ($idViaje ?? ''));
            $estado = 'pendiente';
            if ($idViajeNorm !== '' && isset($idsVistos[$idViajeNorm])) {
                $estado = 'duplicado';
            } elseif ($idViajeNorm !== '') {
                $idsVistos[$idViajeNorm] = true;
            }

            $distribuidorId = null;
            $observaciones = null;
            if ($estado !== 'duplicado') {
                $matchDistribuidor = $this->resolverDistribuidor($fieldValues, $distribuidoresLookup, $matchingStrategies);
                if ($matchDistribuidor['persona'] instanceof Persona) {
                    $distribuidorId = $matchDistribuidor['persona']->id;
                    $estado = 'pendiente';
                    if ($matchDistribuidor['strategy'] !== 'patente') {
                        $observaciones = $this->appendObservacion(
                            $observaciones,
                            'Distribuidor identificado por ' . $matchDistribuidor['strategy'] . '.'
                        );
                    }
                } else {
                    $estado = 'sin_distribuidor';
                    if ($matchDistribuidor['reason'] !== null) {
                        $observaciones = $this->appendObservacion($observaciones, $matchDistribuidor['reason']);
                    }
                }
            }

            $lineaTarifaId = null;
            $valorTarifaOriginal = null;
            $valorTarifaDistribuidor = null;
            $porcentajeAgencia = null;
            $diferencia = null;
            $dimensionesValores = [];
            $dimensionFallida = null;

            if ($estado === 'pendiente') {
                foreach ($esquema->dimensiones ?? [] as $dim) {
                    $dimKey = $this->normalizarClaveCampo($dim);

                    if ($dim === 'sucursal') {
                        if (! $sucursalTarifa) {
                            $dimensionFallida = 'sucursal';
                            break;
                        }
                        $dimensionesValores[$dim] = $canon($dim, (string) $sucursalTarifa);
                        continue;
                    }

                    if ($sucursalTarifa && str_contains(Str::lower((string) $dim), 'sucursal')) {
                        $dimensionesValores[$dim] = $canon($dim, (string) $sucursalTarifa);
                        continue;
                    }

                    $mapeosParaConcepto = $mapeosConcepto->get($conceptoKey);
                    if ($mapeosParaConcepto && $mapeosParaConcepto->has($dim)) {
                        $dimensionesValores[$dim] = $canon($dim, (string) $mapeosParaConcepto->get($dim)->valor_tarifa);
                        continue;
                    }

                    if ($dim === 'concepto' || str_contains(Str::lower((string) $dim), 'concepto')) {
                        $dimensionesValores[$dim] = $canon($dim, $concepto);
                        continue;
                    }

                    $rawDim = $this->firstFieldValue($fieldValues, [$dimKey, $dim]);
                    if ($rawDim !== null && trim((string) $rawDim) !== '') {
                        $dimensionesValores[$dim] = (string) $rawDim;
                        continue;
                    }

                    $dimensionFallida = $dim;
                    break;
                }

                if ($dimensionFallida) {
                    $estado = 'sin_tarifa';
                } else {
                    $linea = null;

                    if ($dominio !== '') {
                        $tpLinea = $this->buscarLineaTarifaPorPatenteYDimensiones(
                            $esquema->id,
                            $dominio,
                            $dimensionesValores,
                            $liquidacion->periodo_desde->toDateString()
                        );
                        if ($tpLinea) {
                            $linea = $tpLinea;
                            $dimensionesValores = (array) ($tpLinea->dimensiones_valores ?? $dimensionesValores);
                            $observaciones = $this->appendObservacion($observaciones, 'Tarifa aplicada por patente (override).');
                        }
                    }

                    if (! $linea) {
                        $linea = $this->buscarLineaTarifaPorDimensiones(
                            $esquema->id,
                            $dimensionesValores,
                            $liquidacion->periodo_desde->toDateString()
                        );
                    }

                    if (
                        ! $linea
                        && $isValorVariable($conceptoKey, $dimensionesValores)
                        && array_key_exists('concepto', $dimensionesValores)
                    ) {
                        $candidatos = str_contains($categoriaVehiculoKey, 'chasis')
                            ? ['Chasis']
                            : ['Ut. Corto AM'];

                        foreach ($candidatos as $candidato) {
                            $tryDims = $dimensionesValores;
                            $tryDims['concepto'] = $canon('concepto', $candidato);
                            $tryLinea = $this->buscarLineaTarifaPorDimensiones(
                                $esquema->id,
                                $tryDims,
                                $liquidacion->periodo_desde->toDateString()
                            );
                            if ($tryLinea) {
                                $dimensionesValores = $tryDims;
                                $linea = $tryLinea;
                                $observaciones = $this->appendObservacion(
                                    $observaciones,
                                    "Concepto '{$concepto}' mapeado automáticamente a '{$candidato}' para poder aplicar % agencia."
                                );
                                break;
                            }
                        }
                    }

                    if ($linea) {
                        $lineaTarifaId = $linea->id;
                        $porcentajeAgencia = (float) $linea->porcentaje_agencia;

                        if ($isValorVariable($conceptoKey, $dimensionesValores)) {
                            $valorTarifaOriginal = round($valor, 2);
                            $valorTarifaDistribuidor = round($valor * (1 - $porcentajeAgencia / 100), 2);
                            $diferencia = 0.0;
                            $estado = 'ok';
                            $observaciones = $this->appendObservacion(
                                $observaciones,
                                'Tarifa variable: precio original tomado del Excel/PDF.'
                            );
                        } else {
                            $valorTarifaOriginal = (float) $linea->precio_original;
                            $valorTarifaDistribuidor = (float) $linea->precio_distribuidor;
                            $diferencia = round($valor - $valorTarifaOriginal, 2);

                            $tolerancia = (float) ($config['tolerancia_porcentaje'] ?? 2.0);
                            $pctDiff = $valorTarifaOriginal > 0 ? abs($diferencia / $valorTarifaOriginal) * 100 : 0;
                            $estado = $pctDiff <= $tolerancia ? 'ok' : 'diferencia';
                        }
                    } else {
                        $pendiente = $this->buscarLineaTarifaPendientePorDimensiones(
                            $esquema->id,
                            $dimensionesValores,
                            $liquidacion->periodo_desde->toDateString()
                        );
                        $estado = 'sin_tarifa';
                        if ($pendiente) {
                            $dimensionFallida = 'pendiente_aprobacion';
                            $observaciones = $this->appendObservacion(
                                $observaciones,
                                'Existe tarifa pendiente de aprobación para dimensiones: ' .
                                json_encode($dimensionesValores, JSON_UNESCAPED_UNICODE)
                            );
                        } elseif ($isValorVariable($conceptoKey, $dimensionesValores)) {
                            $dimensionFallida = 'valor_viaje_sin_match';
                            $observaciones = $this->appendObservacion(
                                $observaciones,
                                'Concepto con valor variable: falta una línea de tarifa aprobada que matchee ' .
                                '(sucursal+concepto) para aplicar % agencia. Dimensiones: ' .
                                json_encode($dimensionesValores, JSON_UNESCAPED_UNICODE)
                            );
                        } else {
                            $dimensionFallida = 'no_match';
                            $observaciones = $this->appendObservacion(
                                $observaciones,
                                'No match para dimensiones: ' . json_encode($dimensionesValores, JSON_UNESCAPED_UNICODE)
                            );
                        }
                    }
                }
            }

            LiqOperacion::create([
                'liquidacion_cliente_id' => $liquidacion->id,
                'archivo_entrada_id' => $archivo->id,
                'campos_originales' => $camposOriginales,
                'dominio' => $dominio !== '' ? $dominio : null,
                'concepto' => $concepto !== '' ? $concepto : null,
                'sucursal_tarifa' => $sucursalTarifa,
                'dimensiones_valores' => $dimensionesValores !== [] ? $dimensionesValores : null,
                'dimension_fallida' => $dimensionFallida,
                'valor_cliente' => $valor,
                'linea_tarifa_id' => $lineaTarifaId,
                'valor_tarifa_original' => $valorTarifaOriginal,
                'valor_tarifa_distribuidor' => $valorTarifaDistribuidor,
                'porcentaje_agencia' => $porcentajeAgencia,
                'diferencia_cliente' => $diferencia,
                'estado' => $estado,
                'distribuidor_id' => $distribuidorId,
                'observaciones' => $observaciones,
            ]);

            $operacionesCreadas++;
        }

        $archivo->update([
            'cant_registros' => $operacionesCreadas,
        ]);

        $this->recalcularTotales($liquidacion);

        return [
            'archivo_id' => $archivo->id,
            'total_filas' => $operacionesCreadas,
            'estados' => LiqOperacion::where('liquidacion_cliente_id', $liquidacion->id)
                ->selectRaw('estado, COUNT(*) as total')
                ->groupBy('estado')
                ->pluck('total', 'estado'),
        ];
    }

    private function autoDetectColumns(array $headers): array
    {
        $map = [];
        $patterns = [
            'patente' => ['dominio', 'patente', 'placa', 'matricula'],
            'concepto' => ['concepto', 'concepto_viaje', 'tipo_servicio', 'categoria'],
            'valor' => ['valor', 'importe', 'monto', 'precio'],
            'categoria_vehiculo' => ['categoriavehiculo', 'categoria_vehiculo', 'tipo_vehiculo', 'vehiculo', 'vehículo'],
            'id_viaje' => ['idviaje', 'id_viaje', 'viaje_id', 'id viaje'],
            'fecha' => ['fechaviaje', 'fecha_viaje', 'fecha'],
            'cuil' => ['cuil', 'cuit', 'cuil_cuit'],
            'legajo' => ['legajo', 'nlegajo', 'n_legajo', 'numero_legajo'],
            'nombre' => ['nombre', 'transportista', 'distribuidor', 'chofer', 'proveedor'],
        ];
        foreach ($headers as $idx => $header) {
            $normalized = strtolower(trim(preg_replace('/\s+/', '', (string) $header)));
            foreach ($patterns as $field => $aliases) {
                if (! isset($map[$field]) && in_array($normalized, $aliases, true)) {
                    $map[$field] = $idx;
                }
            }
        }
        return $map;
    }

    private function resolverSucursalDesdeNombre(string $nombreArchivo, int $clienteId): ?string
    {
        $nombreBase = strtoupper(pathinfo($nombreArchivo, PATHINFO_FILENAME));
        $mapeos = LiqMapeoSucursal::where('cliente_id', $clienteId)
            ->where('activo', true)
            ->get();
        foreach ($mapeos as $mapeo) {
            if (str_contains($nombreBase, strtoupper($mapeo->patron_archivo))) {
                return $mapeo->sucursal_tarifa;
            }
        }
        return null;
    }

    private function buscarLineaTarifaPorDimensiones(int $esquemaId, array $dimensionesValores, string $fecha): ?LiqLineaTarifa
    {
        $q = LiqLineaTarifa::where('esquema_id', $esquemaId)
            ->where('activo', true)
            ->whereNotNull('aprobado_por')
            ->where('vigencia_desde', '<=', $fecha)
            ->where(function ($q) use ($fecha) {
                $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $fecha);
            });

        foreach ($dimensionesValores as $dim => $valor) {
            $q->where("dimensiones_valores->{$dim}", $valor);
        }

        return $q->first();
    }

    private function buscarLineaTarifaPorPatenteYDimensiones(int $esquemaId, string $patenteNorm, array $dimensionesValores, string $fecha): ?LiqLineaTarifa
    {
        $q = LiqTarifaPatente::where('esquema_id', $esquemaId)
            ->where('activo', true)
            ->where('patente_norm', $patenteNorm)
            ->where('vigencia_desde', '<=', $fecha)
            ->where(function ($q) use ($fecha) {
                $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $fecha);
            })
            ->whereHas('lineaTarifa', function ($q) use ($fecha, $esquemaId) {
                $q->where('esquema_id', $esquemaId)
                    ->where('activo', true)
                    ->whereNotNull('aprobado_por')
                    ->where('vigencia_desde', '<=', $fecha)
                    ->where(function ($q) use ($fecha) {
                        $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $fecha);
                    });
            })
            ->with(['lineaTarifa']);

        foreach ($dimensionesValores as $dim => $valor) {
            $q->where("dimensiones_valores->{$dim}", $valor);
        }

        $tp = $q->first();
        if (! $tp) {
            return null;
        }

        $linea = $tp->lineaTarifa;
        return $linea instanceof LiqLineaTarifa ? $linea : null;
    }

    private function buscarLineaTarifaPendientePorDimensiones(int $esquemaId, array $dimensionesValores, string $fecha): ?LiqLineaTarifa
    {
        $q = LiqLineaTarifa::where('esquema_id', $esquemaId)
            ->where('activo', true)
            ->whereNull('aprobado_por')
            ->where('vigencia_desde', '<=', $fecha)
            ->where(function ($q) use ($fecha) {
                $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $fecha);
            });

        foreach ($dimensionesValores as $dim => $valor) {
            $q->where("dimensiones_valores->{$dim}", $valor);
        }

        return $q->first();
    }

    private function recalcularTotales(LiqLiquidacionCliente $liquidacion): void
    {
        $totals = LiqOperacion::where('liquidacion_cliente_id', $liquidacion->id)
            ->selectRaw('COUNT(*) as total_ops, SUM(valor_cliente) as total_cliente, SUM(valor_tarifa_original) as total_correcto, SUM(diferencia_cliente) as total_diff')
            ->first();

        $liquidacion->update([
            'total_operaciones' => $totals->total_ops ?? 0,
            'total_importe_cliente' => $totals->total_cliente ?? 0,
            'total_importe_correcto' => $totals->total_correcto ?? 0,
            'total_diferencia' => $totals->total_diff ?? 0,
            'estado' => LiqLiquidacionCliente::ESTADO_EN_PROCESO,
        ]);
    }

    private function resolvePdfOperationPatterns(LiqCliente $cliente, array $config): array
    {
        $rawPatterns = [];
        if (is_string($config['pdf_operacion_regex'] ?? null) && trim((string) $config['pdf_operacion_regex']) !== '') {
            $rawPatterns[] = (string) $config['pdf_operacion_regex'];
        }
        if (is_array($config['pdf_operacion_regexes'] ?? null)) {
            foreach ($config['pdf_operacion_regexes'] as $pattern) {
                if (is_string($pattern) && trim($pattern) !== '') {
                    $rawPatterns[] = $pattern;
                }
            }
        }

        if ($rawPatterns === []) {
            throw new RuntimeException(
                "El cliente '{$cliente->nombre_corto}' no tiene configurado `pdf_operacion_regex` para procesar PDFs."
            );
        }

        $flags = trim((string) ($config['pdf_regex_flags'] ?? 'iu'));
        $patterns = [];
        foreach ($rawPatterns as $pattern) {
            $patterns[] = $this->ensurePregPattern($pattern, $flags);
        }

        return array_values(array_unique($patterns));
    }

    private function resolvePdfSkipPatterns(array $config): array
    {
        $patterns = self::DEFAULT_PDF_SKIP_PATTERNS;
        $raw = $config['pdf_skip_line_patterns'] ?? null;
        if (is_string($raw) && trim($raw) !== '') {
            $patterns[] = trim($raw);
        } elseif (is_array($raw)) {
            foreach ($raw as $item) {
                if (is_string($item) && trim($item) !== '') {
                    $patterns[] = trim($item);
                }
            }
        }

        return array_values(array_unique($patterns));
    }

    private function shouldSkipPdfChunk(string $chunk, array $patterns): bool
    {
        $upperChunk = Str::upper($chunk);
        foreach ($patterns as $pattern) {
            $trimmed = trim((string) $pattern);
            if ($trimmed === '') {
                continue;
            }
            if ($this->looksLikePregPattern($trimmed)) {
                if (@preg_match($trimmed, $chunk) === 1) {
                    return true;
                }
                continue;
            }
            if (str_contains($upperChunk, Str::upper($trimmed))) {
                return true;
            }
        }
        return false;
    }

    private function ensurePregPattern(string $pattern, string $flags): string
    {
        $trimmed = trim($pattern);
        if ($this->looksLikePregPattern($trimmed)) {
            return $trimmed;
        }

        return '~' . str_replace('~', '\~', $trimmed) . '~' . $flags;
    }

    private function looksLikePregPattern(string $value): bool
    {
        if ($value === '' || mb_strlen($value) < 3) {
            return false;
        }

        $delimiter = $value[0];
        if (! in_array($delimiter, ['/', '#', '~'], true)) {
            return false;
        }

        $lastPos = strrpos($value, $delimiter);
        return $lastPos !== false && $lastPos > 0;
    }

    private function resolveMatchingStrategies(LiqCliente $cliente): array
    {
        $config = is_array($cliente->configuracion_excel) ? $cliente->configuracion_excel : [];
        $raw = $config['matching_distribuidor'] ?? $config['matching_fallbacks'] ?? null;

        $strategies = [];
        if (is_string($raw) && trim($raw) !== '') {
            $strategies = [trim($raw)];
        } elseif (is_array($raw)) {
            foreach ($raw as $strategy) {
                if (is_string($strategy) && trim($strategy) !== '') {
                    $strategies[] = trim($strategy);
                }
            }
        }

        $strategies = array_values(array_unique(array_map(
            fn ($strategy) => Str::lower(trim((string) $strategy)),
            $strategies
        )));
        $strategies = array_values(array_filter(
            $strategies,
            fn ($strategy) => in_array($strategy, self::SUPPORTED_MATCHING_STRATEGIES, true)
        ));

        if ($strategies !== []) {
            return $strategies;
        }

        $clienteKeys = [
            Str::upper((string) ($cliente->codigo_corto ?? '')),
            Str::upper((string) ($cliente->nombre_corto ?? '')),
            Str::upper((string) ($cliente->razon_social ?? '')),
        ];
        $clienteKey = implode(' ', array_filter($clienteKeys));

        if (str_contains($clienteKey, 'URB')) {
            return ['patente', 'legajo', 'cuil', 'nombre_fuzzy'];
        }
        if (str_contains($clienteKey, 'OCASA')) {
            return ['patente', 'cuil', 'nombre_fuzzy'];
        }
        if (str_contains($clienteKey, 'OCA')) {
            return ['patente', 'cuil', 'nombre_fuzzy'];
        }

        return ['patente'];
    }

    private function buildDistribuidoresLookup(): array
    {
        $lookup = [
            'by_patente' => [],
            'by_cuil' => [],
            'by_legajo' => [],
            'by_nombre' => [],
            'nombre_candidatos' => [],
        ];

        $personas = Persona::with('patentesAdicionales:id,persona_id,patente,patente_norm,activo')
            ->get(['id', 'patente', 'cuil', 'legajo', 'nombres', 'apellidos']);
        foreach ($personas as $persona) {
            foreach (PersonaPatenteHelper::normalizedDomainsForPersona($persona) as $patente) {
                if ($patente === '') {
                    continue;
                }
                $lookup['by_patente'][$patente][] = $persona;
            }

            $cuil = $this->normalizarDocumento((string) ($persona->cuil ?? ''));
            if ($cuil !== '') {
                $lookup['by_cuil'][$cuil][] = $persona;
            }

            $legajo = $this->normalizarLegajo((string) ($persona->legajo ?? ''));
            if ($legajo !== '') {
                $lookup['by_legajo'][$legajo][] = $persona;
                $digitsLegajo = preg_replace('/\D+/', '', $legajo) ?? '';
                if ($digitsLegajo !== '' && $digitsLegajo !== $legajo) {
                    $lookup['by_legajo'][$digitsLegajo][] = $persona;
                }
            }

            $nombreCompleto = trim(
                preg_replace('/\s+/', ' ', trim((string) ($persona->apellidos ?? '')) . ' ' . trim((string) ($persona->nombres ?? '')))
                ?? ''
            );
            $nombreInvertido = trim(
                preg_replace('/\s+/', ' ', trim((string) ($persona->nombres ?? '')) . ' ' . trim((string) ($persona->apellidos ?? '')))
                ?? ''
            );

            foreach ([$nombreCompleto, $nombreInvertido] as $nombre) {
                $norm = $this->normalizarTexto($nombre);
                if ($norm === '') {
                    continue;
                }
                $lookup['by_nombre'][$norm][] = $persona;
                $lookup['nombre_candidatos'][] = [
                    'persona' => $persona,
                    'nombre_norm' => $norm,
                ];
            }
        }

        return $lookup;
    }

    private function resolverDistribuidor(array $fieldValues, array $lookup, array $strategies): array
    {
        foreach ($strategies as $strategy) {
            if ($strategy === 'patente') {
                $patente = $this->normalizarPatente((string) ($this->firstFieldValue($fieldValues, ['patente', 'dominio']) ?? ''));
                if ($patente === '') {
                    continue;
                }
                $persona = $this->pickUniquePersona($lookup['by_patente'][$patente] ?? []);
                if ($persona) {
                    return ['persona' => $persona, 'strategy' => 'patente', 'reason' => null];
                }
                if (($lookup['by_patente'][$patente] ?? []) !== []) {
                    return ['persona' => null, 'strategy' => null, 'reason' => 'Patente duplicada en maestro de distribuidores.'];
                }
                continue;
            }

            if ($strategy === 'cuil') {
                $cuil = $this->normalizarDocumento((string) ($this->firstFieldValue($fieldValues, ['cuil', 'cuit']) ?? ''));
                if ($cuil === '') {
                    continue;
                }
                $persona = $this->pickUniquePersona($lookup['by_cuil'][$cuil] ?? []);
                if ($persona) {
                    return ['persona' => $persona, 'strategy' => 'cuil', 'reason' => null];
                }
                if (($lookup['by_cuil'][$cuil] ?? []) !== []) {
                    return ['persona' => null, 'strategy' => null, 'reason' => 'CUIL/CUIT duplicado en maestro de distribuidores.'];
                }
                continue;
            }

            if ($strategy === 'legajo') {
                $legajo = $this->normalizarLegajo((string) ($this->firstFieldValue(
                    $fieldValues,
                    ['legajo', 'n_legajo', 'nro_legajo', 'numero_legajo']
                ) ?? ''));
                if ($legajo === '') {
                    continue;
                }
                $persona = $this->pickUniquePersona($lookup['by_legajo'][$legajo] ?? []);
                if ($persona) {
                    return ['persona' => $persona, 'strategy' => 'legajo', 'reason' => null];
                }
                if (($lookup['by_legajo'][$legajo] ?? []) !== []) {
                    return ['persona' => null, 'strategy' => null, 'reason' => 'Legajo duplicado en maestro de distribuidores.'];
                }
                continue;
            }

            if ($strategy === 'nombre_exacto') {
                $nombre = $this->normalizarTexto((string) ($this->firstFieldValue(
                    $fieldValues,
                    ['nombre', 'transportista', 'distribuidor', 'chofer', 'proveedor']
                ) ?? ''));
                if ($nombre === '') {
                    continue;
                }
                $persona = $this->pickUniquePersona($lookup['by_nombre'][$nombre] ?? []);
                if ($persona) {
                    return ['persona' => $persona, 'strategy' => 'nombre_exacto', 'reason' => null];
                }
                if (($lookup['by_nombre'][$nombre] ?? []) !== []) {
                    return ['persona' => null, 'strategy' => null, 'reason' => 'Nombre exacto ambiguo en maestro de distribuidores.'];
                }
                continue;
            }

            if ($strategy === 'nombre_fuzzy') {
                $nombre = $this->normalizarTexto((string) ($this->firstFieldValue(
                    $fieldValues,
                    ['nombre', 'transportista', 'distribuidor', 'chofer', 'proveedor']
                ) ?? ''));
                if ($nombre === '') {
                    continue;
                }
                $persona = $this->buscarPersonaPorNombreFuzzy($nombre, $lookup['nombre_candidatos']);
                if ($persona) {
                    return ['persona' => $persona, 'strategy' => 'nombre_fuzzy', 'reason' => null];
                }
            }
        }

        return ['persona' => null, 'strategy' => null, 'reason' => 'No se encontró distribuidor con las estrategias configuradas.'];
    }

    private function pickUniquePersona(array $candidates): ?Persona
    {
        $unique = [];
        foreach ($candidates as $candidate) {
            if (! $candidate instanceof Persona) {
                continue;
            }
            $unique[$candidate->id] = $candidate;
        }

        return count($unique) === 1 ? array_values($unique)[0] : null;
    }

    private function buscarPersonaPorNombreFuzzy(string $targetName, array $candidates): ?Persona
    {
        $bestPersona = null;
        $bestScore = 0.0;
        $secondBestScore = 0.0;

        foreach ($candidates as $candidate) {
            $candidateName = $candidate['nombre_norm'] ?? '';
            $persona = $candidate['persona'] ?? null;
            if (! is_string($candidateName) || ! $persona instanceof Persona || $candidateName === '') {
                continue;
            }

            similar_text($targetName, $candidateName, $similarity);
            if (str_contains($candidateName, $targetName) || str_contains($targetName, $candidateName)) {
                $similarity = max($similarity, 96.0);
            }

            if ($similarity > $bestScore) {
                $secondBestScore = $bestScore;
                $bestScore = $similarity;
                $bestPersona = $persona;
            } elseif ($similarity > $secondBestScore) {
                $secondBestScore = $similarity;
            }
        }

        if ($bestPersona instanceof Persona && $bestScore >= 88.0 && ($bestScore - $secondBestScore) >= 3.0) {
            return $bestPersona;
        }

        return null;
    }

    private function appendObservacion(?string $base, string $fragment): string
    {
        $fragment = trim($fragment);
        if ($fragment === '') {
            return trim((string) $base);
        }
        if (! is_string($base) || trim($base) === '') {
            return $fragment;
        }

        return trim($base) . ' ' . $fragment;
    }

    private function isPdfPath(string $path): bool
    {
        return Str::lower(pathinfo($path, PATHINFO_EXTENSION)) === 'pdf';
    }

    private function isRecordEmpty(mixed $rawPatente, mixed $rawConcepto, mixed $rawValor): bool
    {
        return $this->isBlankValue($rawPatente) && $this->isBlankValue($rawConcepto) && $this->isBlankValue($rawValor);
    }

    private function isBlankValue(mixed $value): bool
    {
        if ($value === null) {
            return true;
        }
        if (is_string($value)) {
            return trim($value) === '';
        }
        return false;
    }

    private function firstFieldValue(array $fieldValues, array $keys): mixed
    {
        foreach ($keys as $key) {
            $normalized = $this->normalizarClaveCampo((string) $key);
            if ($normalized !== '' && array_key_exists($normalized, $fieldValues)) {
                return $fieldValues[$normalized];
            }
        }
        return null;
    }

    private function normalizarPatente(string $value): string
    {
        return strtoupper(preg_replace('/[\s\-]/', '', trim($value)) ?? '');
    }

    private function normalizarDocumento(string $value): string
    {
        return preg_replace('/\D+/', '', trim($value)) ?? '';
    }

    private function normalizarLegajo(string $value): string
    {
        $value = Str::upper(trim($value));
        if ($value === '') {
            return '';
        }

        $value = preg_replace('/[^A-Z0-9]+/', '', $value) ?? $value;
        return trim($value);
    }

    private function normalizarClaveCampo(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        $value = Str::ascii(Str::lower($value));
        $value = preg_replace('/[^a-z0-9]+/', '_', $value) ?? $value;
        return trim($value, '_');
    }

    private function parseDecimal(mixed $raw): float
    {
        if (is_int($raw) || is_float($raw)) {
            return (float) $raw;
        }

        $value = trim((string) $raw);
        if ($value === '') {
            return 0.0;
        }

        $isNegative = false;
        if (str_contains($value, '-') || (str_contains($value, '(') && str_contains($value, ')'))) {
            $isNegative = true;
        }

        $value = preg_replace('/[^\d\.,]/u', '', $value) ?? $value;
        $value = trim($value);
        if ($value === '') {
            return 0.0;
        }

        if (preg_match('/[.,]\d{1,2}$/', $value) === 1) {
            $decimalSep = substr($value, -3, 1);
            if ($decimalSep !== '.' && $decimalSep !== ',') {
                $lastDot = strrpos($value, '.');
                $lastComma = strrpos($value, ',');
                $decimalSep = ($lastDot !== false && $lastComma !== false)
                    ? ($lastDot > $lastComma ? '.' : ',')
                    : ($lastDot !== false ? '.' : ',');
            }

            $lastSepPos = strrpos($value, $decimalSep);
            if ($lastSepPos !== false) {
                $intPart = substr($value, 0, $lastSepPos);
                $decPart = substr($value, $lastSepPos + 1);

                $intDigits = preg_replace('/\D/u', '', $intPart) ?? $intPart;
                $decDigits = preg_replace('/\D/u', '', $decPart) ?? $decPart;

                $normalized = ($intDigits === '' ? '0' : $intDigits) . '.' . ($decDigits === '' ? '0' : $decDigits);
                $num = (float) $normalized;
                return $isNegative ? -$num : $num;
            }
        }

        if (str_contains($value, '.') || str_contains($value, ',')) {
            $digits = preg_replace('/\D/u', '', $value) ?? $value;
            if ($digits === '') {
                return 0.0;
            }
            $num = (float) $digits;
            return $isNegative ? -$num : $num;
        }

        $num = (float) $value;
        return $isNegative ? -$num : $num;
    }

    private function normalizarTexto(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        $value = Str::upper($value);
        $value = preg_replace('/[^\pL\pN]+/u', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
        return trim($value);
    }
}

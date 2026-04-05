<?php

namespace App\Services\Liq;

use App\Models\LiqArchivoEntrada;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqOperacion;
use App\Models\LiqMapeoConcepto;
use App\Models\LiqMapeoSucursal;
use App\Models\LiqLineaTarifa;
use App\Models\LiqDimensionValor;
use App\Models\Persona;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;

class LiqIngestService
{
    /**
     * Process an uploaded Excel file and create LiqOperacion records.
     */
    public function procesarArchivo(LiqArchivoEntrada $archivo, LiqLiquidacionCliente $liquidacion): array
    {
        if (!class_exists(IOFactory::class)) {
            throw new \RuntimeException(
                "No se encontró PhpSpreadsheet (IOFactory). Ejecutá `composer install` en `back/` " .
                "o instalá `phpoffice/phpspreadsheet`."
            );
        }
        if (!class_exists(\ZipArchive::class)) {
            throw new \RuntimeException(
                "Falta la extensión PHP `zip` (ZipArchive) para leer archivos .xlsx. " .
                "Instalá/activá `php-zip` y reiniciá PHP."
            );
        }

        $disk = $archivo->disk ?: 'local';
        $ruta = $archivo->ruta_storage;
        if (!$ruta || !Storage::disk($disk)->exists($ruta)) {
            throw new \RuntimeException("Archivo no encontrado: {$ruta}");
        }
        $path = Storage::disk($disk)->path($ruta);

        $cliente = $liquidacion->cliente;
        $config = $cliente->configuracion_excel ?? [];

        $esquema = LiqEsquemaTarifario::where('cliente_id', $liquidacion->cliente_id)
            ->where('activo', true)
            ->latest()
            ->first();
        if (!$esquema) {
            throw new \RuntimeException('No hay un esquema tarifario activo para este cliente');
        }

        // Load spreadsheet
        $spreadsheet = IOFactory::load($path);
        $sheetName = $config['hoja'] ?? 'Detalle';

        try {
            $sheet = $spreadsheet->getSheetByName($sheetName) ?? $spreadsheet->getActiveSheet();
        } catch (\Throwable $e) {
            throw new \RuntimeException("Hoja '{$sheetName}' no encontrada en el archivo");
        }

        $rows = $sheet->toArray(null, true, true, false);

        if (empty($rows)) {
            throw new \RuntimeException("El archivo está vacío");
        }

        // Get headers from first row
        $headerRow = (int) ($config['fila_datos'] ?? 1) - 1; // 0-indexed
        $dataStartRow = $headerRow + 1;
        $headers = array_map(fn($h) => trim((string)($h ?? '')), $rows[$headerRow] ?? []);

        // Column mapping from config or auto-detect
        $columnMap = $config['mapeo_columnas'] ?? $this->autoDetectColumns($headers);

        // Validate required columns
        $required = ['patente', 'valor'];
        if (in_array('concepto', $esquema->dimensiones ?? []) || isset($columnMap['concepto'])) {
            $required[] = 'concepto';
        }
        foreach ($required as $col) {
            if (!isset($columnMap[$col])) {
                throw new \RuntimeException("Columna requerida no encontrada: {$col}. Headers disponibles: " . implode(', ', $headers));
            }
        }

        // Load mapeos for this client
        $mapeosConcepto = LiqMapeoConcepto::where('cliente_id', $liquidacion->cliente_id)
            ->where('activo', true)
            ->get()
            ->groupBy(fn($m) => $this->normalizarTexto((string) $m->valor_excel))
            ->map(function ($items) {
                return $items->keyBy('dimension_destino');
            });

        // Catálogo de valores por dimensión (para canonizar y evitar diferencias de formato)
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

        // Determine sucursal tarifa for this file
        $sucursalTarifa = $archivo->sucursal;
        if (!$sucursalTarifa) {
            $sucursalTarifa = $this->resolverSucursalDesdeNombre($archivo->nombre_original, $liquidacion->cliente_id);
            if ($sucursalTarifa) {
                $archivo->update(['sucursal' => $sucursalTarifa]);
            }
        }
        if ($sucursalTarifa && in_array('sucursal', $esquema->dimensiones ?? [], true)) {
            $canonical = $canon('sucursal', (string) $sucursalTarifa);
            $sucursalTarifa = $canonical;
            $archivo->update(['sucursal' => $canonical]);
        }

        // Load distributor lookup cache (patente -> persona_id)
        $distribuidores = Persona::whereNotNull('patente')
            ->get(['id', 'patente', 'estado_id'])
            ->keyBy(fn($p) => strtoupper(preg_replace('/[\s\-]/', '', $p->patente)));

        // Conceptos cuyo "precio original" se toma desde el Excel (valor variable por viaje).
        // Ej: Loginter Colecta suele venir con Concepto = "Valor Viaje" y el importe está en la columna Valor.
        $conceptosValorVariable = $config['conceptos_valor_variable'] ?? [];
        $conceptosValorVariableNorm = [];
        if (is_array($conceptosValorVariable)) {
            foreach ($conceptosValorVariable as $c) {
                if (is_string($c) && trim($c) !== '') {
                    $conceptosValorVariableNorm[] = $this->normalizarTexto($c);
                }
            }
        }
        // Default defensivo (si no está configurado) para el caso típico.
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
        $errores = [];
        $idsVistos = []; // for duplicate detection

        $dataRows = array_slice($rows, $dataStartRow);

        foreach ($dataRows as $rowIndex => $row) {
            // Skip empty rows
            $rawPatente = $row[$columnMap['patente']] ?? null;
            $rawConcepto = isset($columnMap['concepto']) ? ($row[$columnMap['concepto']] ?? null) : null;
            $rawValor = $row[$columnMap['valor']] ?? null;

            if (empty($rawPatente) && empty($rawConcepto) && empty($rawValor)) {
                continue;
            }
            // Skip TOTAL / subtotals rows commonly present in client spreadsheets
            $rawPatenteTxt = strtoupper(trim((string) ($rawPatente ?? '')));
            $rawConceptoTxt = strtoupper(trim((string) ($rawConcepto ?? '')));
            if ($rawPatenteTxt === 'TOTAL' || $rawConceptoTxt === 'TOTAL') {
                continue;
            }

            // Build campos_originales with all columns
            $camposOriginales = [];
            foreach ($headers as $idx => $header) {
                if ($header !== '') {
                    $camposOriginales[$header] = $row[$idx] ?? null;
                }
            }

            // Normalize patente
            $dominio = strtoupper(preg_replace('/[\s\-]/', '', (string)($rawPatente ?? '')));
            $concepto = trim((string)($rawConcepto ?? ''));
            $conceptoKey = $this->normalizarTexto($concepto);
            $valor = $this->parseDecimal($rawValor ?? 0);

            // Detect duplicate by idViaje if available
            $idViaje = isset($columnMap['id_viaje']) ? ($row[$columnMap['id_viaje']] ?? null) : null;
            $estado = 'pendiente';
            if ($idViaje && isset($idsVistos[$idViaje])) {
                $estado = 'duplicado';
            } elseif ($idViaje) {
                $idsVistos[$idViaje] = true;
            }

            // Resolve distributor
            $distribuidorId = null;
            if ($estado !== 'duplicado') {
                $persona = $distribuidores->get($dominio);
                if ($persona) {
                    $distribuidorId = $persona->id;
                    // Check if active (estado_id != baja). Simple check: estado_id is null or state needs lookup
                    // We'll mark observado if we can't confirm activo - for now assign and mark ok pending tariff
                    $estado = 'pendiente';
                } else {
                    $estado = 'sin_distribuidor';
                }
            }

            // Resolve tariff
            $lineaTarifaId = null;
            $valorTarifaOriginal = null;
            $valorTarifaDistribuidor = null;
            $porcentajeAgencia = null;
            $diferencia = null;
            $dimensionesValores = [];
            $dimensionFallida = null;
            $observaciones = null;

            if ($estado === 'pendiente') {
                $dimensionesRequeridas = $esquema->dimensiones ?? [];

                foreach ($dimensionesRequeridas as $dim) {
                    if ($dim === 'sucursal') {
                        if (!$sucursalTarifa) {
                            $dimensionFallida = 'sucursal';
                            break;
                        }
                        $dimensionesValores[$dim] = $canon($dim, (string) $sucursalTarifa);
                        continue;
                    }

                    // Heurística: si la dimensión contiene "sucursal", usar la sucursal del archivo
                    if ($sucursalTarifa && str_contains(Str::lower((string) $dim), 'sucursal')) {
                        $dimensionesValores[$dim] = $canon($dim, (string) $sucursalTarifa);
                        continue;
                    }

                    // 1) Intentar resolver por mapeo desde el Concepto (si existe)
                    $mapeosParaConcepto = $mapeosConcepto->get($conceptoKey);
                    if ($mapeosParaConcepto && $mapeosParaConcepto->has($dim)) {
                        $dimensionesValores[$dim] = $canon($dim, (string) $mapeosParaConcepto->get($dim)->valor_tarifa);
                        continue;
                    }

                    // 2) Fallback: si la dimensión es "concepto", usar el valor crudo del Excel
                    if ($dim === 'concepto') {
                        $dimensionesValores[$dim] = $canon($dim, $concepto);
                        continue;
                    }

                    // Heurística: si la dimensión contiene "concepto", usar el valor crudo del Excel
                    if (str_contains(Str::lower((string) $dim), 'concepto')) {
                        $dimensionesValores[$dim] = $canon($dim, $concepto);
                        continue;
                    }

                    // 3) Fallback: tomar de una columna mapeada con el mismo nombre de la dimensión
                    if (isset($columnMap[$dim])) {
                        $rawDim = $row[$columnMap[$dim]] ?? null;
                        $rawDim = is_string($rawDim) ? trim($rawDim) : $rawDim;
                        if ($rawDim === null || $rawDim === '') {
                            $dimensionFallida = $dim;
                            break;
                        }
                        $dimensionesValores[$dim] = (string) $rawDim;
                        continue;
                    }

                    $dimensionFallida = $dim;
                    break;
                }

                if ($dimensionFallida) {
                    $estado = 'sin_tarifa';
                } else {
                    $linea = $this->buscarLineaTarifaPorDimensiones(
                        $esquema->id,
                        $dimensionesValores,
                        $liquidacion->periodo_desde->toDateString()
                    );

                    if ($linea) {
                        $lineaTarifaId = $linea->id;
                        $porcentajeAgencia = (float) $linea->porcentaje_agencia;

                        // Caso especial: el precio original se toma del Excel (valor variable).
                        if ($isValorVariable($conceptoKey, $dimensionesValores)) {
                            $valorTarifaOriginal = round($valor, 2);
                            $valorTarifaDistribuidor = round($valor * (1 - $porcentajeAgencia / 100), 2);
                            $diferencia = 0.0;
                            $estado = 'ok';
                            $observaciones = $observaciones ?: 'Tarifa variable: precio original tomado del Excel.';
                        } else {
                            $valorTarifaOriginal = (float) $linea->precio_original;
                            $valorTarifaDistribuidor = (float) $linea->precio_distribuidor;
                            $diferencia = round($valor - $valorTarifaOriginal, 2);

                            $tolerancia = (float) ($config['tolerancia_porcentaje'] ?? 2.0);
                            $pctDiff = $valorTarifaOriginal > 0 ? abs($diferencia / $valorTarifaOriginal) * 100 : 0;
                            $estado = $pctDiff <= $tolerancia ? 'ok' : 'diferencia';
                        }
                    } else {
                        // Si existe una línea que matchea las dimensiones pero está pendiente de aprobación,
                        // lo informamos explícitamente para evitar confusión (el cruce solo usa líneas aprobadas).
                        $pendiente = $this->buscarLineaTarifaPendientePorDimensiones(
                            $esquema->id,
                            $dimensionesValores,
                            $liquidacion->periodo_desde->toDateString()
                        );
                        $estado = 'sin_tarifa';
                        if ($pendiente) {
                            $dimensionFallida = 'pendiente_aprobacion';
                            $observaciones = 'Existe tarifa pendiente de aprobación para dimensiones: ' . json_encode($dimensionesValores, JSON_UNESCAPED_UNICODE);
                        } else {
                            $dimensionFallida = 'no_match';
                            $observaciones = 'No match para dimensiones: ' . json_encode($dimensionesValores, JSON_UNESCAPED_UNICODE);
                        }
                    }
                }
            }

            LiqOperacion::create([
                'liquidacion_cliente_id' => $liquidacion->id,
                'archivo_entrada_id' => $archivo->id,
                'campos_originales' => $camposOriginales,
                'dominio' => $dominio ?: null,
                'concepto' => $concepto ?: null,
                'sucursal_tarifa' => $sucursalTarifa,
                'dimensiones_valores' => !empty($dimensionesValores) ? $dimensionesValores : null,
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

        // Update archivo stats
        $archivo->update([
            'cant_registros' => $operacionesCreadas,
        ]);

        // Update liquidacion totals
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
            'id_viaje' => ['idviaje', 'id_viaje', 'viaje_id', 'id viaje'],
            'fecha' => ['fechaviaje', 'fecha_viaje', 'fecha'],
        ];
        foreach ($headers as $idx => $header) {
            $normalized = strtolower(trim(preg_replace('/\s+/', '', $header)));
            foreach ($patterns as $field => $aliases) {
                if (!isset($map[$field]) && in_array($normalized, $aliases)) {
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

    private function canonicalizarDimensionValor(int $esquemaId, string $nombreDimension, string $raw): string
    {
        $rawNorm = $this->normalizarTexto($raw);
        $valores = LiqDimensionValor::where('esquema_id', $esquemaId)
            ->where('nombre_dimension', $nombreDimension)
            ->where('activo', true)
            ->get(['valor']);

        foreach ($valores as $v) {
            if ($this->normalizarTexto((string) $v->valor) === $rawNorm) {
                return (string) $v->valor;
            }
        }
        // Fallback: normalizar (upper + colapsar espacios) para maximizar chance de match.
        return $rawNorm;
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

    private function parseDecimal(mixed $raw): float
    {
        if (is_int($raw) || is_float($raw)) {
            return (float) $raw;
        }

        $original = (string) $raw;
        $value = trim($original);
        if ($value === '') {
            return 0.0;
        }

        $isNegative = false;
        // Soportar negativos con "-" o "(123,45)"
        if (str_contains($value, '-')) {
            $isNegative = true;
        }
        if (str_contains($value, '(') && str_contains($value, ')')) {
            $isNegative = true;
        }

        // Remove currency symbols and non-numeric separators except dot/comma/minus
        $value = preg_replace('/[^\d\.,]/u', '', $value) ?? $value;
        $value = trim($value);
        if ($value === '') {
            return 0.0;
        }

        $hasDot = str_contains($value, '.');
        $hasComma = str_contains($value, ',');

        // Detectar decimales por patrón "...[.,]dd" (1-2 dígitos)
        if (preg_match('/[.,]\d{1,2}$/', $value) === 1) {
            $decimalSep = substr($value, -3, 1);
            if ($decimalSep !== '.' && $decimalSep !== ',') {
                // fallback: buscar el último separador real
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

                if ($intDigits === '') {
                    $intDigits = '0';
                }
                if ($decDigits === '') {
                    $decDigits = '0';
                }

                $normalized = $intDigits . '.' . $decDigits;
                $num = (float) $normalized;
                return $isNegative ? -$num : $num;
            }
        }

        // Sin decimales explícitos: remover separadores de miles (.,)
        if ($hasDot || $hasComma) {
            // Casos tipo "211.082" o "211,082" (miles) sin decimales
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
        // Normalizar: uppercase + quitar separadores/puntuación a espacios + colapsar espacios.
        $value = Str::upper($value);
        $value = preg_replace('/[^\pL\pN]+/u', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
        return trim($value);
    }
}

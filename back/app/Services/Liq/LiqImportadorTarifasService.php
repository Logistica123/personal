<?php

namespace App\Services\Liq;

use App\Models\LiqCliente;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqLineaTarifa;
use App\Models\LiqMaterialMapeo;
use App\Models\LiqMotivoExitoso;
use App\Models\LiqTarifasImportLog;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;
use RuntimeException;

/**
 * SPEC "Importador de Tarifas OCASA" v1.0 (2026-04-21).
 *
 * Reemplaza el flujo del antiguo LiqExcelV5ImportService con un importador de 3 etapas
 * (preview → apply) que acepta BASE + OVERRIDES + motivos YCC + mapeo de materiales
 * en un solo xlsx, con validación por fila, clasificación nuevo/actualizar y auditoría.
 *
 * El preview se cachea con un token UUID por 1 hora para que el usuario pueda revisar
 * el resumen sin persistir. El confirmar aplica todo en una transacción atómica.
 *
 * Uso típico:
 *   $svc = app(LiqImportadorTarifasService::class);
 *   $result = $svc->preview($path, $esquemaId, ['vigencia_desde'=>'2026-02-01', 'motivo'=>'...']);
 *   // usuario revisa $result['resumen']
 *   $out = $svc->aplicar($result['preview_token']);
 */
class LiqImportadorTarifasService
{
    public const MODELOS_VALIDOS = ['Jornada', 'Jornada_KM', 'Productividad'];

    /** Alias de columnas: el admin puede usar el nombre del spec o el del DB. */
    private const ALIAS_TARIFAS = [
        'ruta_codigo'        => 'ruta',
        'capacidad_vehiculo_kg' => 'capacidad_vehiculo',
        'factor_km'          => 'factor_km_distrib',
        'patente_match'      => 'patente',
    ];

    /**
     * Genera un preview del archivo sin persistir. Devuelve token para confirmar luego.
     *
     * @param  array  $ctx  ['vigencia_desde' => 'YYYY-MM-DD', 'vigencia_hasta' => 'YYYY-MM-DD'|null, 'motivo' => string, 'archivo_nombre' => string]
     * @return array{preview_token:string, resumen:array, errores:array, warnings:array, expira_en:string}
     */
    public function preview(string $pathXlsx, int $esquemaId, array $ctx = []): array
    {
        if (!is_readable($pathXlsx)) {
            throw new RuntimeException("No se puede leer el archivo: {$pathXlsx}");
        }

        $esquema = LiqEsquemaTarifario::findOrFail($esquemaId);

        $spreadsheet = IOFactory::load($pathXlsx);
        $sheetNamesLower = array_map('strtolower', $spreadsheet->getSheetNames());

        $tarifas     = [];
        $motivos     = [];
        $materiales  = [];
        $errores     = [];
        $warnings    = [];

        // Hoja Tarifas (obligatoria)
        $hojaTarifa = $this->detectarHoja($spreadsheet, $sheetNamesLower, ['tarifas', 'tarifa', 'v5']);
        if ($hojaTarifa === null) {
            $errores[] = ['fila' => 0, 'hoja' => 'Tarifas', 'mensaje' => "Hoja 'Tarifas' no encontrada. Hojas detectadas: " . implode(', ', $spreadsheet->getSheetNames())];
        } else {
            [$tarifas, $errTar, $warnTar] = $this->procesarHojaTarifas($hojaTarifa, $esquema->id);
            $errores  = array_merge($errores, $errTar);
            $warnings = array_merge($warnings, $warnTar);
        }

        // Hoja Motivos (opcional)
        $hojaMotivos = $this->detectarHoja($spreadsheet, $sheetNamesLower, ['motivos', 'motivo']);
        if ($hojaMotivos !== null) {
            [$motivos, $errMot] = $this->procesarHojaMotivos($hojaMotivos);
            $errores = array_merge($errores, $errMot);
        }

        // Hoja Materiales (opcional)
        $hojaMateriales = $this->detectarHoja($spreadsheet, $sheetNamesLower, ['materiales', 'material']);
        if ($hojaMateriales !== null) {
            [$materiales, $errMat] = $this->procesarHojaMateriales($hojaMateriales);
            $errores = array_merge($errores, $errMat);
        }

        // Resumen contable (nuevos/actualizar)
        $resumen = [
            'tarifas_base_nuevas'     => 0,
            'tarifas_base_actualizar' => 0,
            'overrides_nuevos'        => 0,
            'overrides_actualizar'    => 0,
            'motivos_nuevos'          => 0,
            'motivos_actualizar'      => 0,
            'materiales_nuevos'       => 0,
            'materiales_actualizar'   => 0,
        ];

        foreach ($tarifas as &$f) {
            if (!empty($f['_errores'])) continue;
            $existe = $this->buscarTarifaExistente($esquema->id, $f);
            $f['_accion'] = $existe ? 'actualizar' : 'crear';
            $f['_existe_id'] = $existe?->id;
            if ($f['es_tarifa_base']) {
                $existe ? $resumen['tarifas_base_actualizar']++ : $resumen['tarifas_base_nuevas']++;
            } else {
                $existe ? $resumen['overrides_actualizar']++ : $resumen['overrides_nuevos']++;
            }
        }
        unset($f);

        foreach ($motivos as &$m) {
            if (!empty($m['_errores'])) continue;
            $cliente = $this->resolverCliente($m['cliente_codigo']);
            if (!$cliente) {
                $m['_errores'][] = "cliente '{$m['cliente_codigo']}' no existe";
                continue;
            }
            $m['_cliente_id'] = $cliente->id;
            $existe = LiqMotivoExitoso::where('cliente_id', $cliente->id)->where('codigo', $m['codigo'])->first();
            $m['_accion'] = $existe ? 'actualizar' : 'crear';
            $m['_existe_id'] = $existe?->id;
            $existe ? $resumen['motivos_actualizar']++ : $resumen['motivos_nuevos']++;
        }
        unset($m);

        foreach ($materiales as &$mat) {
            if (!empty($mat['_errores'])) continue;
            $cliente = $this->resolverCliente($mat['cliente_codigo']);
            if (!$cliente) {
                $mat['_errores'][] = "cliente '{$mat['cliente_codigo']}' no existe";
                continue;
            }
            $mat['_cliente_id'] = $cliente->id;
            $existe = LiqMaterialMapeo::where('cliente_id', $cliente->id)->where('codigo_ycc', $mat['codigo_ycc'])->first();
            $mat['_accion'] = $existe ? 'actualizar' : 'crear';
            $mat['_existe_id'] = $existe?->id;
            $existe ? $resumen['materiales_actualizar']++ : $resumen['materiales_nuevos']++;
        }
        unset($mat);

        // Acumular errores por fila en lista plana
        foreach ([$tarifas, $motivos, $materiales] as $filas) {
            foreach ($filas as $f) {
                foreach ($f['_errores'] ?? [] as $msg) {
                    $errores[] = [
                        'fila'    => $f['_fila_num'] ?? 0,
                        'hoja'    => $f['_hoja'] ?? '',
                        'mensaje' => $msg,
                        'id'      => $f['_id_fila'] ?? null,
                    ];
                }
            }
        }

        $token = (string) Str::uuid();
        $payload = [
            'esquema_id'            => $esquema->id,
            'cliente_id'            => $esquema->cliente_id,
            'archivo_nombre'        => $ctx['archivo_nombre'] ?? basename($pathXlsx),
            'form_vigencia_desde'   => $ctx['vigencia_desde'] ?? now()->startOfMonth()->toDateString(),
            'form_vigencia_hasta'   => $ctx['vigencia_hasta'] ?? null,
            'form_motivo'           => $ctx['motivo'] ?? null,
            'tarifas'               => $tarifas,
            'motivos'               => $motivos,
            'materiales'            => $materiales,
            'resumen'               => $resumen,
            'errores'               => $errores,
            'warnings'              => $warnings,
            'filas_totales'         => count($tarifas) + count($motivos) + count($materiales),
            'filas_error'           => count($errores),
            'tipo_import'           => $this->detectarTipoImport($tarifas, $motivos, $materiales),
        ];

        Cache::put("tarifa_import:$token", $payload, now()->addHour());

        return [
            'preview_token' => $token,
            'resumen'       => $resumen,
            'errores'       => $errores,
            'warnings'      => $warnings,
            'expira_en'     => now()->addHour()->toIso8601String(),
        ];
    }

    /**
     * Confirma el preview: persiste todo en una transacción atómica.
     *
     * @return array{aplicadas:int, por_tipo:array, log_id:int}
     */
    public function aplicar(string $previewToken, bool $aplicarSoloValidas = false): array
    {
        $data = Cache::get("tarifa_import:$previewToken");
        if (!$data) {
            throw new RuntimeException('Preview expirado o no encontrado. Repetir upload.');
        }

        if (!$aplicarSoloValidas && !empty($data['errores'])) {
            throw new RuntimeException('El preview tiene errores. Corregí el xlsx o marcá "Aplicar solo filas sin error".');
        }

        $result = DB::transaction(function () use ($data) {
            return $this->persistir($data);
        });

        Cache::forget("tarifa_import:$previewToken");
        return $result;
    }

    // -------------------------------------------------------------------------
    // Procesamiento por hoja
    // -------------------------------------------------------------------------

    /**
     * @return array{0:array, 1:array, 2:array}  [filasParsed, errores, warnings]
     */
    private function procesarHojaTarifas($sheet, int $esquemaId): array
    {
        $rows = $sheet->toArray(null, true, true, false);
        if (empty($rows)) return [[], [], []];

        $headerIdx = $this->detectarFilaHeaders($rows, ['ruta', 'capacidad_vehiculo']);
        if ($headerIdx === null) {
            return [[], [['fila' => 0, 'hoja' => 'Tarifas', 'mensaje' => 'No se pudo detectar la fila de headers (se esperan "ruta" y "capacidad_vehiculo")']], []];
        }

        $headers = array_map(fn($c) => $this->normHeader((string) $c), $rows[$headerIdx]);
        $colMap  = $this->buildColMap($headers, self::ALIAS_TARIFAS);

        foreach (['ruta', 'capacidad_vehiculo', 'modelo_tarifa', 'precio_original',
                  'porcentaje_agencia', 'precio_distribuidor', 'es_tarifa_base'] as $obl) {
            if (!isset($colMap[$obl])) {
                return [[], [['fila' => $headerIdx + 1, 'hoja' => 'Tarifas', 'mensaje' => "Columna obligatoria '{$obl}' faltante. Headers detectados: " . implode(', ', $headers)]], []];
            }
        }

        $filas    = [];
        $errores  = [];
        $warnings = [];
        $clavesSeen = [];

        $dataRows = array_slice($rows, $headerIdx + 1, null, true);
        foreach ($dataRows as $idx => $row) {
            $filaNum = $idx + 1;

            $ruta = trim((string) ($row[$colMap['ruta']] ?? ''));
            if ($ruta === '') continue; // fila vacía ignorada sin warning

            $f = [
                '_fila_num' => $filaNum,
                '_hoja'     => 'Tarifas',
                '_id_fila'  => strtoupper($ruta),
                '_errores'  => [],
                '_warnings' => [],
                'ruta'                => strtoupper($ruta),
                'capacidad_vehiculo'  => $this->parseInt($row[$colMap['capacidad_vehiculo']] ?? null),
                'modelo_tarifa'       => $this->normModelo((string) ($row[$colMap['modelo_tarifa']] ?? '')),
                'precio_original'     => $this->parseDecimal($row[$colMap['precio_original']] ?? null),
                'porcentaje_agencia'  => $this->parseDecimal($row[$colMap['porcentaje_agencia']] ?? null),
                'precio_distribuidor' => $this->parseDecimal($row[$colMap['precio_distribuidor']] ?? null),
                'es_tarifa_base'      => $this->parseBoolStrict($row[$colMap['es_tarifa_base']] ?? null, $f_err),
                'distribuidor_nombre' => $this->optStr($row, $colMap, 'distribuidor_nombre'),
                'patente_match'       => $this->optStr($row, $colMap, 'patente_match', upper: true),
                'factor_km'           => $this->parseDecimal($this->optVal($row, $colMap, 'factor_km')),
                'factor_prod_distrib' => $this->parseDecimal($this->optVal($row, $colMap, 'factor_prod_distrib')),
                'factor_cant_distrib' => $this->parseDecimal($this->optVal($row, $colMap, 'factor_cant_distrib')),
                'km_tarifa_la'        => $this->parseDecimal($this->optVal($row, $colMap, 'km_tarifa_la')),
                'costo_fijo_base'     => $this->optStr($row, $colMap, 'costo_fijo_base'),
                'vigencia_desde'      => $this->parseDate($this->optVal($row, $colMap, 'vigencia_desde')),
                'vigencia_hasta'      => $this->parseDate($this->optVal($row, $colMap, 'vigencia_hasta')),
                'motivo'              => $this->optStr($row, $colMap, 'motivo'),
                'n_ops_observadas'    => (int) ($this->optVal($row, $colMap, 'n_ops_observadas') ?? 0),
                'observaciones_v5'    => $this->optStr($row, $colMap, 'observaciones'),
            ];
            if (isset($f_err)) { $f['_errores'][] = $f_err; unset($f_err); }

            $this->validarFilaTarifa($f);

            // Duplicado interno
            if (empty($f['_errores'])) {
                $clave = sprintf(
                    '%s|%d|%s|%s|%d',
                    $f['ruta'],
                    $f['capacidad_vehiculo'],
                    $f['distribuidor_nombre'] ?? '',
                    $f['patente_match'] ?? '',
                    $f['es_tarifa_base'] ? 1 : 0
                );
                if (isset($clavesSeen[$clave])) {
                    $f['_errores'][] = "duplicada de fila {$clavesSeen[$clave]} (misma ruta+capacidad+distribuidor+patente+base)";
                } else {
                    $clavesSeen[$clave] = $filaNum;
                }
            }

            foreach ($f['_warnings'] as $w) {
                $warnings[] = ['fila' => $filaNum, 'hoja' => 'Tarifas', 'mensaje' => $w];
            }

            $filas[] = $f;
        }

        return [$filas, $errores, $warnings];
    }

    private function validarFilaTarifa(array &$f): void
    {
        // Tipos
        if (!is_int($f['capacidad_vehiculo']) || $f['capacidad_vehiculo'] <= 0) {
            $f['_errores'][] = "capacidad_vehiculo debe ser entero positivo";
        }
        foreach (['precio_original' => 'precio_original', 'precio_distribuidor' => 'precio_distribuidor'] as $k => $label) {
            if ($f[$k] === null || $f[$k] <= 0) {
                $f['_errores'][] = "{$label} debe ser número positivo";
            }
        }
        if ($f['porcentaje_agencia'] === null || $f['porcentaje_agencia'] < 0 || $f['porcentaje_agencia'] > 100) {
            $f['_errores'][] = "porcentaje_agencia debe estar entre 0 y 100";
        }

        // Modelo
        if (!in_array($f['modelo_tarifa'], self::MODELOS_VALIDOS, true)) {
            $f['_errores'][] = "modelo_tarifa inválido (usar Jornada/Jornada_KM/Productividad)";
        }

        // Override requiere distribuidor o patente
        if ($f['es_tarifa_base'] === false) {
            if (empty($f['distribuidor_nombre']) && empty($f['patente_match'])) {
                $f['_errores'][] = "override (es_tarifa_base=0) requiere distribuidor_nombre o patente_match";
            }
        }

        // factor_km en [0,1]
        if ($f['factor_km'] !== null && ($f['factor_km'] < 0 || $f['factor_km'] > 1)) {
            $f['_errores'][] = "factor_km debe estar entre 0 y 1";
        }

        // Coherencia matemática (warning, no bloquea)
        if (empty($f['_errores']) && $f['precio_original'] !== null && $f['porcentaje_agencia'] !== null && $f['precio_distribuidor'] !== null) {
            $esperado = $f['precio_original'] * (1 - $f['porcentaje_agencia'] / 100);
            $diff = abs($esperado - $f['precio_distribuidor']);
            if ($diff > 1) {
                $f['_warnings'][] = sprintf(
                    "precio_distribuidor (%s) no coincide con precio_original × (1 - %s%%) = %s. Diferencia: %s.",
                    number_format($f['precio_distribuidor'], 2),
                    $f['porcentaje_agencia'],
                    number_format($esperado, 2),
                    number_format($diff, 2)
                );
            }
        }
    }

    private function procesarHojaMotivos($sheet): array
    {
        $rows = $sheet->toArray(null, true, true, false);
        if (empty($rows)) return [[], []];

        $headerIdx = $this->detectarFilaHeaders($rows, ['cliente_codigo', 'codigo']);
        if ($headerIdx === null) {
            return [[], [['fila' => 0, 'hoja' => 'Motivos', 'mensaje' => 'No se pudo detectar headers (se esperan "cliente_codigo" y "codigo")']]];
        }
        $headers = array_map(fn($c) => $this->normHeader((string) $c), $rows[$headerIdx]);
        $colMap  = $this->buildColMap($headers, []);

        foreach (['cliente_codigo', 'codigo', 'es_exitoso'] as $obl) {
            if (!isset($colMap[$obl])) {
                return [[], [['fila' => $headerIdx + 1, 'hoja' => 'Motivos', 'mensaje' => "Columna obligatoria '{$obl}' faltante"]]];
            }
        }

        $filas = [];
        $clavesSeen = [];
        $dataRows = array_slice($rows, $headerIdx + 1, null, true);
        foreach ($dataRows as $idx => $row) {
            $filaNum = $idx + 1;
            $cliCod = trim((string) ($row[$colMap['cliente_codigo']] ?? ''));
            $codigo = trim((string) ($row[$colMap['codigo']] ?? ''));
            if ($cliCod === '' && $codigo === '') continue;

            $f = [
                '_fila_num'   => $filaNum,
                '_hoja'       => 'Motivos',
                '_id_fila'    => "{$cliCod}/{$codigo}",
                '_errores'    => [],
                'cliente_codigo' => strtoupper($cliCod),
                'codigo'      => strtoupper($codigo),
                'es_exitoso'  => $this->parseBoolStrict($row[$colMap['es_exitoso']] ?? null, $err),
                'descripcion' => $this->optStr($row, $colMap, 'descripcion'),
            ];
            if (isset($err)) { $f['_errores'][] = $err; unset($err); }

            if ($cliCod === '') $f['_errores'][] = "cliente_codigo obligatorio";
            if ($codigo === '') $f['_errores'][] = "codigo obligatorio";

            $clave = "{$f['cliente_codigo']}|{$f['codigo']}";
            if (isset($clavesSeen[$clave])) {
                $f['_errores'][] = "duplicada de fila {$clavesSeen[$clave]}";
            } else {
                $clavesSeen[$clave] = $filaNum;
            }

            $filas[] = $f;
        }

        return [$filas, []];
    }

    private function procesarHojaMateriales($sheet): array
    {
        $rows = $sheet->toArray(null, true, true, false);
        if (empty($rows)) return [[], []];

        $headerIdx = $this->detectarFilaHeaders($rows, ['cliente_codigo', 'codigo_ycc']);
        if ($headerIdx === null) {
            return [[], [['fila' => 0, 'hoja' => 'Materiales', 'mensaje' => 'No se pudo detectar headers (se esperan "cliente_codigo" y "codigo_ycc")']]];
        }
        $headers = array_map(fn($c) => $this->normHeader((string) $c), $rows[$headerIdx]);
        $colMap  = $this->buildColMap($headers, []);

        foreach (['cliente_codigo', 'codigo_ycc', 'material_tarifario'] as $obl) {
            if (!isset($colMap[$obl])) {
                return [[], [['fila' => $headerIdx + 1, 'hoja' => 'Materiales', 'mensaje' => "Columna obligatoria '{$obl}' faltante"]]];
            }
        }

        $filas = [];
        $clavesSeen = [];
        $dataRows = array_slice($rows, $headerIdx + 1, null, true);
        foreach ($dataRows as $idx => $row) {
            $filaNum = $idx + 1;
            $cliCod = trim((string) ($row[$colMap['cliente_codigo']] ?? ''));
            $ycc    = trim((string) ($row[$colMap['codigo_ycc']] ?? ''));
            $mat    = trim((string) ($row[$colMap['material_tarifario']] ?? ''));
            if ($cliCod === '' && $ycc === '' && $mat === '') continue;

            $f = [
                '_fila_num' => $filaNum,
                '_hoja'     => 'Materiales',
                '_id_fila'  => "{$cliCod}/{$ycc}",
                '_errores'  => [],
                'cliente_codigo'     => strtoupper($cliCod),
                'codigo_ycc'         => strtoupper($ycc),
                'material_tarifario' => $mat,
                'descripcion'        => $this->optStr($row, $colMap, 'descripcion'),
            ];
            if ($cliCod === '') $f['_errores'][] = "cliente_codigo obligatorio";
            if ($ycc === '')    $f['_errores'][] = "codigo_ycc obligatorio";
            if ($mat === '')    $f['_errores'][] = "material_tarifario obligatorio";

            $clave = "{$f['cliente_codigo']}|{$f['codigo_ycc']}";
            if (isset($clavesSeen[$clave])) {
                $f['_errores'][] = "duplicada de fila {$clavesSeen[$clave]}";
            } else {
                $clavesSeen[$clave] = $filaNum;
            }

            $filas[] = $f;
        }

        return [$filas, []];
    }

    // -------------------------------------------------------------------------
    // Persistencia
    // -------------------------------------------------------------------------

    private function persistir(array $data): array
    {
        $stats = [
            'aplicadas'           => 0,
            'tarifas_base'        => 0,
            'overrides'           => 0,
            'motivos'             => 0,
            'materiales'          => 0,
        ];

        // Tarifas
        foreach ($data['tarifas'] as $f) {
            if (!empty($f['_errores'])) continue;

            $matchKeys = [
                'esquema_id'            => $data['esquema_id'],
                'ruta_codigo'           => $f['ruta'],
                'capacidad_vehiculo_kg' => $f['capacidad_vehiculo'],
                'es_tarifa_base'        => $f['es_tarifa_base'],
            ];
            // Nota: para NULL en where, Laravel necesita whereNull. Usamos firstOrNew manual.
            $query = LiqLineaTarifa::query()->where($matchKeys);
            $query = $f['distribuidor_nombre']
                ? $query->where('distribuidor_nombre', $f['distribuidor_nombre'])
                : $query->whereNull('distribuidor_nombre');
            $query = $f['patente_match']
                ? $query->where('patente_match', $f['patente_match'])
                : $query->whereNull('patente_match');

            $linea = $query->first() ?? new LiqLineaTarifa($matchKeys + [
                'distribuidor_nombre' => $f['distribuidor_nombre'],
                'patente_match'       => $f['patente_match'],
            ]);

            // dimensiones_valores: populamos con identificadores v5 para que la validación de
            // aprobación (LiqTarifaController::aprobarLineaLocked) distinga correctamente entre
            // overrides de distribuidores distintos. Clave ordenada para consistencia.
            $dims = [
                'ruta'            => $f['ruta'],
                'capacidad'       => (string) $f['capacidad_vehiculo'],
                'es_tarifa_base'  => $f['es_tarifa_base'] ? '1' : '0',
            ];
            if ($f['distribuidor_nombre']) $dims['distribuidor'] = $f['distribuidor_nombre'];
            if ($f['patente_match'])       $dims['patente']      = $f['patente_match'];

            $linea->fill([
                'esquema_id'            => $data['esquema_id'],
                'ruta_codigo'           => $f['ruta'],
                'capacidad_vehiculo_kg' => $f['capacidad_vehiculo'],
                'es_tarifa_base'        => $f['es_tarifa_base'],
                'distribuidor_nombre'   => $f['distribuidor_nombre'],
                'patente_match'         => $f['patente_match'],
                'modelo_tarifa'         => $f['modelo_tarifa'],
                'precio_original'       => $f['precio_original'],
                'porcentaje_agencia'    => $f['porcentaje_agencia'],
                'precio_distribuidor'   => $f['precio_distribuidor'],
                'factor_km'             => $f['factor_km'],
                'factor_prod_distrib'   => $f['factor_prod_distrib'],
                'factor_cant_distrib'   => $f['factor_cant_distrib'],
                'km_tarifa_la'          => $f['km_tarifa_la'],
                // El motor v5 usa costo_fijo_base como decimal para Jornada × fracción.
                // Si el Excel trae texto (label tipo "Posadas 7500") o viene vacío, defaulteamos
                // a precio_distribuidor (el pago íntegro de la jornada). Sin esto, todos los
                // cálculos BASE dan 0 porque Jornada = costo_fijo_base × fracción.
                'costo_fijo_base'       => is_numeric($f['costo_fijo_base'] ?? null)
                    ? (float) $f['costo_fijo_base']
                    : (float) $f['precio_distribuidor'],
                'vigencia_desde'        => $f['vigencia_desde'] ?? $data['form_vigencia_desde'],
                'vigencia_hasta'        => $f['vigencia_hasta'] ?? $data['form_vigencia_hasta'],
                'motivo_carga'          => $f['motivo'] ?? $data['form_motivo'],
                'n_ops_observadas'      => $f['n_ops_observadas'] ?? 0,
                'observaciones_v5'      => $f['observaciones_v5'] ?? null,
                'activo'                => true,
                'dimensiones_valores'   => $dims,
            ]);
            if (!$linea->exists) {
                $linea->creado_por = auth()->id();
            }
            $linea->save();

            $f['es_tarifa_base'] ? $stats['tarifas_base']++ : $stats['overrides']++;
            $stats['aplicadas']++;
        }

        // Motivos
        foreach ($data['motivos'] as $m) {
            if (!empty($m['_errores']) || !isset($m['_cliente_id'])) continue;
            LiqMotivoExitoso::updateOrCreate(
                ['cliente_id' => $m['_cliente_id'], 'codigo' => $m['codigo']],
                ['es_exitoso' => $m['es_exitoso'], 'descripcion' => $m['descripcion']]
            );
            $stats['motivos']++;
            $stats['aplicadas']++;
        }

        // Materiales
        foreach ($data['materiales'] as $mat) {
            if (!empty($mat['_errores']) || !isset($mat['_cliente_id'])) continue;
            LiqMaterialMapeo::updateOrCreate(
                ['cliente_id' => $mat['_cliente_id'], 'codigo_ycc' => $mat['codigo_ycc']],
                ['material_tarifario' => $mat['material_tarifario'], 'descripcion' => $mat['descripcion']]
            );
            $stats['materiales']++;
            $stats['aplicadas']++;
        }

        // Auditoría
        $log = LiqTarifasImportLog::create([
            'usuario_id'     => auth()->id() ?? 0,
            'cliente_id'     => $data['cliente_id'],
            'esquema_id'     => $data['esquema_id'],
            'archivo_nombre' => $data['archivo_nombre'],
            'filas_totales'  => $data['filas_totales'],
            'filas_ok'       => $stats['aplicadas'],
            'filas_error'    => $data['filas_error'],
            'tipo_import'    => $data['tipo_import'],
            'resumen_json'   => array_merge($stats, ['resumen' => $data['resumen']]),
        ]);

        $stats['log_id'] = $log->id;
        return $stats;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function detectarHoja($spreadsheet, array $namesLower, array $keywords)
    {
        foreach ($spreadsheet->getSheetNames() as $realName) {
            $n = strtolower($realName);
            foreach ($keywords as $kw) {
                if ($n === $kw) return $spreadsheet->getSheetByName($realName);
            }
        }
        // Búsqueda parcial como fallback
        foreach ($spreadsheet->getSheetNames() as $realName) {
            $n = strtolower($realName);
            foreach ($keywords as $kw) {
                if (str_contains($n, $kw)) return $spreadsheet->getSheetByName($realName);
            }
        }
        return null;
    }

    private function detectarFilaHeaders(array $rows, array $requiredHeaders): ?int
    {
        foreach ($rows as $idx => $row) {
            $normalized = array_map(fn($c) => $this->normHeader((string) $c), $row);
            $matched = 0;
            foreach ($requiredHeaders as $req) {
                // Aceptar alias también
                $candidates = [$req];
                foreach (self::ALIAS_TARIFAS as $dbName => $alias) {
                    if ($dbName === $req) $candidates[] = $alias;
                    if ($alias === $req)  $candidates[] = $dbName;
                }
                if (!empty(array_intersect($normalized, $candidates))) $matched++;
            }
            if ($matched === count($requiredHeaders)) return $idx;
        }
        return null;
    }

    private function buildColMap(array $headers, array $aliases): array
    {
        $map = array_flip($headers);
        // Permitir acceso por alias (ambos nombres apuntan al mismo índice)
        foreach ($aliases as $dbName => $alias) {
            if (isset($map[$alias]) && !isset($map[$dbName])) $map[$dbName] = $map[$alias];
            if (isset($map[$dbName]) && !isset($map[$alias])) $map[$alias] = $map[$dbName];
        }
        return $map;
    }

    private function buscarTarifaExistente(int $esquemaId, array $f): ?LiqLineaTarifa
    {
        $q = LiqLineaTarifa::query()
            ->where('esquema_id', $esquemaId)
            ->where('ruta_codigo', $f['ruta'])
            ->where('capacidad_vehiculo_kg', $f['capacidad_vehiculo'])
            ->where('es_tarifa_base', $f['es_tarifa_base']);
        $q = $f['distribuidor_nombre']
            ? $q->where('distribuidor_nombre', $f['distribuidor_nombre'])
            : $q->whereNull('distribuidor_nombre');
        $q = $f['patente_match']
            ? $q->where('patente_match', $f['patente_match'])
            : $q->whereNull('patente_match');
        return $q->first();
    }

    private function resolverCliente(string $codigo): ?LiqCliente
    {
        $codigo = strtoupper(trim($codigo));
        return LiqCliente::where('codigo_corto', $codigo)
            ->orWhere('nombre_corto', $codigo)
            ->first();
    }

    private function detectarTipoImport(array $tarifas, array $motivos, array $materiales): string
    {
        $has = [
            'tarifas'    => !empty($tarifas),
            'motivos'    => !empty($motivos),
            'materiales' => !empty($materiales),
        ];
        $count = array_sum(array_map('intval', $has));
        if ($count > 1) return 'combinado';
        if ($has['tarifas'])    return 'tarifas';
        if ($has['motivos'])    return 'motivos';
        if ($has['materiales']) return 'materiales';
        return 'tarifas';
    }

    private function normHeader(string $s): string
    {
        $s = trim(strtolower($s));
        $s = str_replace(['á','é','í','ó','ú','ñ','%'], ['a','e','i','o','u','n','pct'], $s);
        $s = preg_replace('/[^a-z0-9_]/', '_', $s);
        $s = preg_replace('/_+/', '_', $s);
        return trim($s, '_');
    }

    private function normModelo(string $s): string
    {
        $s = trim($s);
        $lower = strtolower($s);
        foreach (self::MODELOS_VALIDOS as $m) {
            if (strtolower($m) === $lower) return $m;
        }
        return $s; // se detecta como inválido en validación
    }

    private function optVal(array $row, array $colMap, string $key)
    {
        if (!isset($colMap[$key])) return null;
        return $row[$colMap[$key]] ?? null;
    }

    private function optStr(array $row, array $colMap, string $key, bool $upper = false): ?string
    {
        $v = $this->optVal($row, $colMap, $key);
        if ($v === null) return null;
        $s = trim((string) $v);
        if ($s === '') return null;
        return $upper ? strtoupper($s) : $s;
    }

    private function parseInt($v): ?int
    {
        if ($v === null || $v === '') return null;
        if (is_numeric($v)) return (int) $v;
        $s = preg_replace('/[^\d\-]/', '', (string) $v);
        return $s === '' ? null : (int) $s;
    }

    private function parseDecimal($v): ?float
    {
        if ($v === null || $v === '') return null;
        if (is_numeric($v)) return (float) $v;
        $s = str_replace(['$', ' '], '', (string) $v);
        if (str_contains($s, ',') && str_contains($s, '.')) {
            // Detectar formato: el separador decimal es el que aparece más a la derecha
            if (strrpos($s, '.') > strrpos($s, ',')) {
                // US: 1,234.56 — miles con coma, decimal con punto
                $s = str_replace(',', '', $s);
            } else {
                // AR: 1.234,56 — miles con punto, decimal con coma
                $s = str_replace('.', '', $s);
                $s = str_replace(',', '.', $s);
            }
        } elseif (str_contains($s, ',')) {
            $s = str_replace(',', '.', $s);
        }
        return is_numeric($s) ? (float) $s : null;
    }

    private function parseDate($v): ?string
    {
        if ($v === null || $v === '') return null;
        // Serial de Excel
        if (is_numeric($v)) {
            try {
                $date = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($v);
                return $date->format('Y-m-d');
            } catch (\Throwable $e) {
                return null;
            }
        }
        $s = trim((string) $v);
        // Formato común: dd/mm/yyyy o yyyy-mm-dd
        foreach (['d/m/Y', 'Y-m-d', 'd-m-Y', 'd/m/y'] as $fmt) {
            $d = \DateTime::createFromFormat($fmt, $s);
            if ($d && $d->format($fmt) === $s) return $d->format('Y-m-d');
        }
        return null;
    }

    /**
     * Parsea boolean estricto. Acepta 0/1, true/false, "si"/"no", "sí"/"no".
     * Carga error en &$err si el valor es inválido.
     */
    private function parseBoolStrict($v, ?string &$err = null): ?bool
    {
        $err = null;
        if ($v === null || $v === '') {
            $err = "valor booleano obligatorio (0 o 1)";
            return null;
        }
        if (is_bool($v)) return $v;
        if (is_numeric($v)) {
            $i = (int) $v;
            if ($i === 0) return false;
            if ($i === 1) return true;
            $err = "valor booleano inválido: '{$v}' (debe ser 0 o 1)";
            return null;
        }
        $s = mb_strtolower(trim((string) $v), 'UTF-8');
        if (in_array($s, ['1', 'true', 'si', 'sí', 'yes', 'y'], true)) return true;
        if (in_array($s, ['0', 'false', 'no', 'n'], true)) return false;
        $err = "valor booleano inválido: '{$v}' (debe ser 0 o 1)";
        return null;
    }
}

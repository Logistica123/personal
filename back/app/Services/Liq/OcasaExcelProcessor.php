<?php

namespace App\Services\Liq;

use App\Models\LiqArchivoEntrada;
use App\Models\LiqCliente;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqLineaTarifa;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqMapeoSucursal;
use App\Models\LiqOperacion;
use App\Models\LiqOperacionDetalle;
use App\Models\LiqTarifaPatente;
use App\Models\Persona;
use App\Support\Personal\PersonaPatenteHelper;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;
use RuntimeException;

class OcasaExcelProcessor
{
    /**
     * Detectar si un archivo Excel es TMS o YCC1 por sus columnas.
     */
    public static function detectarTipoArchivo(string $path, array $config): string
    {
        $spreadsheet = IOFactory::load($path);
        $hojaConfig = $config['archivos']['tms']['hoja'] ?? $config['hoja'] ?? '8';
        $sheet = self::resolverHoja($spreadsheet, $hojaConfig);

        $rows = $sheet->toArray(null, true, true, false);
        if (empty($rows)) {
            throw new RuntimeException('El archivo está vacío');
        }

        $headers = array_map(fn ($h) => trim((string) ($h ?? '')), $rows[0] ?? []);
        $headersUpper = array_map('strtoupper', $headers);

        // TMS tiene 'Costo Fijo', YCC1 tiene 'Parada'
        if (in_array('COSTO FIJO', $headersUpper) || in_array('COSTO TRANSPORTE', $headersUpper)) {
            return 'TMS';
        }
        if (in_array('PARADA', $headersUpper) || in_array('BULTOS', $headersUpper)) {
            return 'YCC1';
        }

        throw new RuntimeException(
            'No se pudo detectar el tipo de archivo OCASA (TMS o YCC1). ' .
            'Headers encontrados: ' . implode(', ', $headers)
        );
    }

    /**
     * Procesar archivo TMS: crear liq_operaciones con componentes de costo.
     */
    public function procesarTms(
        LiqArchivoEntrada $archivo,
        LiqLiquidacionCliente $liquidacion,
        LiqEsquemaTarifario $esquema,
        array $config
    ): array {
        $disk = $archivo->disk ?: 'local';
        $path = Storage::disk($disk)->path($archivo->ruta_storage);
        $tmsConfig = $config['archivos']['tms'] ?? [];
        $hojaConfig = $tmsConfig['hoja'] ?? $config['hoja'] ?? '8';
        $columnas = $tmsConfig['columnas'] ?? [];

        $spreadsheet = IOFactory::load($path);
        $sheet = self::resolverHoja($spreadsheet, $hojaConfig);
        $rows = $sheet->toArray(null, true, true, false);

        if (empty($rows)) {
            throw new RuntimeException('El archivo TMS está vacío');
        }

        // Mapear headers (strip trailing spaces)
        $rawHeaders = $rows[0] ?? [];
        $headers = [];
        foreach ($rawHeaders as $idx => $h) {
            $headers[$idx] = trim((string) ($h ?? ''));
        }

        // Invertir mapeo de columnas: nombre_config => nombre_header => col_index
        $colMap = $this->mapearColumnas($headers, $columnas);

        // Resolver distribuidores (BUGFIX 20 D: filtrar por periodo)
        $distribuidoresLookup = $this->buildDistribuidoresLookup(
            $liquidacion->periodo_desde?->toDateString(),
            $liquidacion->periodo_hasta?->toDateString()
        );

        // Mapeos de sucursal
        $mapeosSucursal = LiqMapeoSucursal::where('cliente_id', $liquidacion->cliente_id)
            ->where('activo', true)
            ->pluck('sucursal_tarifa', 'patron_archivo')
            ->mapWithKeys(fn ($suc, $pat) => [strtoupper(trim($pat)) => $suc]);

        // Detección de duplicados
        $dupConfig = $liquidacion->cliente?->configuracion_duplicados;
        $dupHabilitado = is_array($dupConfig) && ($dupConfig['habilitado'] ?? false);

        $operacionesCreadas = 0;
        $idsVistos = [];
        $duplicados = [];
        $dataRows = array_slice($rows, 1); // Skip header

        foreach ($dataRows as $offset => $row) {
            $transporte = $this->getVal($row, $colMap, 'id_operacion');
            if ($transporte === null || trim((string) $transporte) === '') {
                continue;
            }

            // Parsear como entero — ignorar filas de totales/comparación
            $transporteStr = trim((string) $transporte);
            if (!is_numeric($transporteStr)) {
                continue;
            }

            $costoTransporte = $this->parseNum($this->getVal($row, $colMap, 'costo_transporte'));
            $costoFijo = $this->parseNum($this->getVal($row, $colMap, 'costo_fijo'));
            $costoKm = $this->parseNum($this->getVal($row, $colMap, 'costo_km'));
            $costoProd = $this->parseNum($this->getVal($row, $colMap, 'costo_prod'));
            $costoCant = $this->parseNum($this->getVal($row, $colMap, 'costo_cant'));
            // SPEC INTEGRAL Fase A: penalidades TMS (Pen.POD + Pen.NO.POD + Penalidad + Pen.Hs.Caídas)
            $penPod       = $this->parseNum($this->getVal($row, $colMap, 'pen_mal_uso_pod') ?? $this->getVal($row, $colMap, 'pen_pod'));
            $penNoPod     = $this->parseNum($this->getVal($row, $colMap, 'pen_no_uso_pod') ?? $this->getVal($row, $colMap, 'pen_no_pod'));
            $penalidad    = $this->parseNum($this->getVal($row, $colMap, 'penalidad'));
            $penHsCaidas  = $this->parseNum($this->getVal($row, $colMap, 'pen_hs_caidas'));
            $penalidadesTms = round((float) $penPod + (float) $penNoPod + (float) $penalidad + (float) $penHsCaidas, 2);
            $distancia = $this->parseNum($this->getVal($row, $colMap, 'distancia'));
            $totalParadas = (int) $this->parseNum($this->getVal($row, $colMap, 'total_paradas'));
            $patente = strtoupper(trim(preg_replace('/[\s\-]/', '', (string) ($this->getVal($row, $colMap, 'patente') ?? '')) ?? ''));
            $ruta = trim((string) ($this->getVal($row, $colMap, 'ruta') ?? ''));
            $sucursalCod = strtoupper(trim((string) ($this->getVal($row, $colMap, 'sucursal') ?? '')));
            $pesoAprox = trim((string) ($this->getVal($row, $colMap, 'capacidad_vehiculo') ?? ''));
            $fechaRaw = $this->getVal($row, $colMap, 'fecha');
            // BUGFIX 31 v2: IdTrack (2da/3ra vuelta) para Modelo 1
            $idTrackRaw = trim((string) ($this->getVal($row, $colMap, 'id_track') ?? $this->getVal($row, $colMap, 'idtrack') ?? ''));
            $idTrackTms = $idTrackRaw !== '' ? $idTrackRaw : null;

            // Ignorar filas con CostoTransporte = 0 (filas vacías / totales)
            if ($costoTransporte == 0 && $costoFijo == 0 && $costoProd == 0) {
                continue;
            }

            // Clasificar modelo de tarifa
            $modeloTarifa = $this->clasificarModelo($costoFijo, $costoKm, $costoProd);

            // Parsear capacidad vehicular
            $capacidadKg = $this->parsearCapacidadVehicular($pesoAprox);

            // Resolver sucursal
            $sucursalTarifa = $mapeosSucursal[$sucursalCod] ?? null;

            // Campos originales
            $camposOriginales = [];
            foreach ($headers as $idx => $header) {
                if ($header !== '') {
                    $camposOriginales[$header] = $row[$idx] ?? null;
                }
            }

            // Duplicados intra-archivo
            $idOpCliente = $transporteStr;
            $estado = 'pendiente';
            $observaciones = null;

            if (isset($idsVistos[$idOpCliente])) {
                $estado = 'duplicado';
            } else {
                $idsVistos[$idOpCliente] = true;
            }

            // Duplicados cross-archivo
            $dupExistente = null;
            if ($dupHabilitado && $estado !== 'duplicado') {
                $dupExistente = LiqOperacion::where('id_operacion_cliente', $idOpCliente)
                    ->whereIn('liquidacion_cliente_id', function ($q) use ($liquidacion) {
                        $q->select('id')->from('liq_liquidaciones_cliente')
                            ->where('cliente_id', $liquidacion->cliente_id);
                    })
                    ->whereNotIn('estado', ['ignorado', 'anulado', 'duplicado'])
                    ->where('liquidacion_cliente_id', '!=', $liquidacion->id)
                    ->first();

                if ($dupExistente) {
                    $estado = 'duplicado';
                    $observaciones = $this->appendObs(
                        $observaciones,
                        "Duplicado de operación #{$dupExistente->id} en liquidación #{$dupExistente->liquidacion_cliente_id}."
                    );
                    $duplicados[] = [
                        'id_operacion_cliente' => $idOpCliente,
                        'operacion_existente_id' => $dupExistente->id,
                    ];
                }
            }

            // Resolver distribuidor por patente
            $distribuidorId = null;
            $capacidadDistribuidor = null;  // BUGFIX 22 L: fallback cuando TMS no trae capacidad
            if ($estado !== 'duplicado' && $patente !== '') {
                $persona = $this->buscarDistribuidorPorPatente($patente, $distribuidoresLookup);
                if ($persona) {
                    $distribuidorId = $persona->id;
                    $capacidadDistribuidor = $persona->capacidad_vehiculo_kg ?? null;
                } else {
                    // Fallback: mapeo sucursal-distribuidor (Feature C)
                    if ($sucursalTarifa) {
                        $mapeoSucDist = \App\Models\LiqMapeoSucursalDistribuidor::where('cliente_id', $liquidacion->cliente_id)
                            ->where('sucursal', $sucursalTarifa)
                            ->where('es_unico', true)
                            ->first();
                        if ($mapeoSucDist) {
                            $distribuidorId = $mapeoSucDist->persona_id;
                            $capacidadDistribuidor = \App\Models\Persona::whereKey($distribuidorId)->value('capacidad_vehiculo_kg');
                            $observaciones = $this->appendObs($observaciones, 'Distribuidor asignado por mapeo sucursal (unico).');
                        }
                    }
                    if (!$distribuidorId) {
                        $estado = 'sin_distribuidor';
                        $observaciones = $this->appendObs($observaciones, "Patente {$patente} no encontrada en maestro de distribuidores.");
                    }
                }
            }

            // Buscar tarifa y calcular pago distribuidor
            $lineaTarifaId = null;
            $valorTarifaOriginal = $costoTransporte;
            $valorTarifaDistribuidor = null;
            $porcentajeAgencia = null;
            $diferencia = null;
            $fraccionJornada = 1.0;
            $tarifaJornadaDistrib = null;
            $tarifaKmDistribValor = null;
            $tarifaProdDistrib = null;
            $dimensionesValores = [];

            if ($ruta !== '') {
                $dimensionesValores['ruta'] = $ruta;
            }
            if ($capacidadKg) {
                $dimensionesValores['capacidad_vehiculo'] = (string) $capacidadKg;
            } elseif ($capacidadDistribuidor) {
                // BUGFIX 22 L: TMS no trajo capacidad → usar la del distribuidor (personas.capacidad_vehiculo_kg)
                // Evita que el matching tome la primera línea ambigua (ej. CBNT01+700 en vez de CBNT01+2500).
                $dimensionesValores['capacidad_vehiculo'] = (string) $capacidadDistribuidor;
                $capacidadKg = (int) $capacidadDistribuidor;
                $observaciones = $this->appendObs($observaciones, "Capacidad tomada del distribuidor ({$capacidadDistribuidor}kg).");
            }

            if ($estado === 'pendiente' && $distribuidorId) {
                $tarifaResult = $this->buscarTarifaOcasa(
                    $esquema,
                    $patente,
                    $dimensionesValores,
                    $liquidacion->periodo_desde->toDateString(),
                    $liquidacion->cliente_id
                );

                if ($tarifaResult) {
                    $linea = $tarifaResult['linea'];
                    $override = $tarifaResult['override'] ?? null;
                    $lineaTarifaId = $linea->id;

                    // Detectar fracción de jornada
                    if (in_array($modeloTarifa, ['JORNADA', 'JORNADA_KM'])) {
                        $costoFijoBase = $linea->costo_fijo_base ?? (float) $linea->precio_original;
                        $fraccionJornada = $this->detectarFraccion($costoFijo, $costoFijoBase);
                    }

                    // Calcular pago distribuidor según modelo
                    $pagoResult = $this->calcularPagoDistribuidor(
                        $modeloTarifa,
                        $linea,
                        $override,
                        $fraccionJornada,
                        $distancia,
                        $costoProd,
                        $totalParadas
                    );

                    $valorTarifaDistribuidor = $pagoResult['total'];
                    $tarifaJornadaDistrib = $pagoResult['jornada'] ?? null;
                    $tarifaKmDistribValor = $pagoResult['km_valor'] ?? null;
                    $tarifaProdDistrib = $pagoResult['prod'] ?? null;
                    $porcentajeAgencia = $costoTransporte > 0
                        ? round((1 - $valorTarifaDistribuidor / $costoTransporte) * 100, 2)
                        : 0;
                    $diferencia = 0.0; // OCASA: no hay diferencia, valor_cliente = CostoTransporte
                    $estado = 'ok';

                    if ($override) {
                        $observaciones = $this->appendObs($observaciones, 'Tarifa aplicada por patente (override).');
                    }
                } else {
                    $estado = 'sin_tarifa';
                    $observaciones = $this->appendObs(
                        $observaciones,
                        "Sin tarifa para ruta={$ruta}, capacidad={$capacidadKg}."
                    );
                }
            }

            // Fecha
            $fechaOp = $this->parseFecha($fechaRaw);

            LiqOperacion::create([
                'liquidacion_cliente_id' => $liquidacion->id,
                'archivo_entrada_id' => $archivo->id,
                'campos_originales' => $camposOriginales,
                'id_operacion_cliente' => $idOpCliente,
                'dominio' => $patente !== '' ? $patente : null,
                'concepto' => $ruta !== '' ? $ruta : null,
                'sucursal_tarifa' => $sucursalTarifa,
                'dimensiones_valores' => $dimensionesValores !== [] ? $dimensionesValores : null,
                'valor_cliente' => $costoTransporte,
                'linea_tarifa_id' => $lineaTarifaId,
                'valor_tarifa_original' => $valorTarifaOriginal,
                'valor_tarifa_distribuidor' => $valorTarifaDistribuidor,
                'porcentaje_agencia' => $porcentajeAgencia,
                'diferencia_cliente' => $diferencia,
                'estado' => $estado,
                'tipo_operacion' => 'normal',
                'distribuidor_id' => $distribuidorId,
                'observaciones' => $observaciones,
                // OCASA-specific
                'modelo_tarifa' => $modeloTarifa,
                'costo_fijo' => $costoFijo,
                'costo_km' => $costoKm,
                'costo_prod' => $costoProd,
                'costo_cant' => $costoCant,
                'distancia_km' => $distancia,
                'total_paradas' => $totalParadas,
                'capacidad_vehiculo_kg' => $capacidadKg,
                'fraccion_jornada' => $fraccionJornada,
                'tarifa_jornada_distrib' => $tarifaJornadaDistrib,
                'tarifa_km_distrib_valor' => $tarifaKmDistribValor,
                'tarifa_prod_distrib' => $tarifaProdDistrib,
                'importe_gravado' => $costoTransporte, // default, actualizable por PDF
                'importe_no_gravado' => 0,
                // BUGFIX 31 v2: IdTrack para detectar 2da/3ra vuelta en Modelo 1
                'idtrack_tms' => $idTrackTms,
                // SPEC INTEGRAL Fase A: penalidades TMS sumadas (se restan en motor de cálculo)
                'penalidades_tms' => $penalidadesTms,
            ]);

            $operacionesCreadas++;
        }

        $archivo->update(['cant_registros' => $operacionesCreadas]);
        $this->recalcularTotales($liquidacion);

        $result = [
            'archivo_id' => $archivo->id,
            'tipo_detectado' => 'TMS',
            'total_filas' => $operacionesCreadas,
            'estados' => LiqOperacion::where('liquidacion_cliente_id', $liquidacion->id)
                ->selectRaw('estado, COUNT(*) as total')
                ->groupBy('estado')
                ->pluck('total', 'estado'),
        ];

        if (!empty($duplicados)) {
            $result['duplicados'] = ['total' => count($duplicados), 'detalle' => $duplicados];
        }

        return $result;
    }

    /**
     * Procesar archivo YCC1: vincular detalle por Transporte a operaciones existentes.
     */
    public function procesarYcc1(
        LiqArchivoEntrada $archivo,
        LiqLiquidacionCliente $liquidacion,
        array $config
    ): array {
        $disk = $archivo->disk ?: 'local';
        $path = Storage::disk($disk)->path($archivo->ruta_storage);
        $ycc1Config = $config['archivos']['ycc1'] ?? [];
        $hojaConfig = $ycc1Config['hoja'] ?? $config['hoja'] ?? '8';
        $columnas = $ycc1Config['columnas'] ?? [];

        $spreadsheet = IOFactory::load($path);
        $sheet = self::resolverHoja($spreadsheet, $hojaConfig);
        $rows = $sheet->toArray(null, true, true, false);

        if (empty($rows)) {
            throw new RuntimeException('El archivo YCC1 está vacío');
        }

        $rawHeaders = $rows[0] ?? [];
        $headers = [];
        foreach ($rawHeaders as $idx => $h) {
            $headers[$idx] = trim((string) ($h ?? ''));
        }
        $colMap = $this->mapearColumnas($headers, $columnas);

        // Cargar operaciones de esta liquidación indexadas por id_operacion_cliente
        $operaciones = LiqOperacion::where('liquidacion_cliente_id', $liquidacion->id)
            ->whereNotNull('id_operacion_cliente')
            ->get(['id', 'id_operacion_cliente'])
            ->keyBy('id_operacion_cliente');

        $detallesCreados = 0;
        $transportesVinculados = [];
        $dataRows = array_slice($rows, 1);

        foreach ($dataRows as $row) {
            $transporte = trim((string) ($this->getVal($row, $colMap, 'transporte') ?? ''));
            if ($transporte === '' || !is_numeric($transporte)) {
                continue;
            }

            $operacion = $operaciones->get($transporte);
            if (!$operacion) {
                continue;
            }

            $parada = $this->getVal($row, $colMap, 'parada');
            $bultos = $this->getVal($row, $colMap, 'bultos');
            $costo = $this->parseNum($this->getVal($row, $colMap, 'costo'));
            $costoProd = $this->parseNum($this->getVal($row, $colMap, 'costo_productividad'));
            // BUGFIX 31 v2: capturar material, zona (cod_regio), motivo, cp, distrito para Modelo 3 y eficiencia
            $material = trim((string) ($this->getVal($row, $colMap, 'material') ?? $this->getVal($row, $colMap, 'gr_material') ?? ''));
            $codRegio = trim((string) ($this->getVal($row, $colMap, 'cod_regio') ?? ''));
            $motivo   = trim((string) ($this->getVal($row, $colMap, 'motivo') ?? ''));
            $cp       = trim((string) ($this->getVal($row, $colMap, 'codigo_postal') ?? $this->getVal($row, $colMap, 'cp') ?? ''));
            $distrito = trim((string) ($this->getVal($row, $colMap, 'distrito') ?? ''));

            LiqOperacionDetalle::create([
                'operacion_id' => $operacion->id,
                'parada' => $parada !== null ? (int) $parada : null,
                'bultos' => $bultos !== null ? (int) $bultos : null,
                'costo' => $costo,
                'costo_productividad' => $costoProd,
                'material_ycc' => $material !== '' ? $material : null,
                'cod_regio'    => $codRegio !== '' ? $codRegio : null,
                'motivo'       => $motivo !== '' ? $motivo : null,
                'codigo_postal' => $cp !== '' ? $cp : null,
                'distrito'     => $distrito !== '' ? $distrito : null,
            ]);

            $detallesCreados++;
            $transportesVinculados[$transporte] = true;
        }

        $archivo->update(['cant_registros' => $detallesCreados]);

        return [
            'archivo_id' => $archivo->id,
            'tipo_detectado' => 'YCC1',
            'total_filas_detalle' => $detallesCreados,
            'transportes_vinculados' => count($transportesVinculados),
            'transportes_sin_match' => 0, // no trackeamos esto por ahora
        ];
    }

    /**
     * Procesar PDFs de OCASA: extraer gravado/no gravado y actualizar operaciones.
     */
    public function procesarPdfCliente(
        LiqArchivoEntrada $archivo,
        LiqLiquidacionCliente $liquidacion,
        array $config,
        string $textoPdf
    ): array {
        $pdfConfig = $config['archivos']['pdf_cliente'] ?? [];

        // Parsear líneas del PDF para extraer Transporte, Importe, Imp.Grav, Imp.NoGrav
        $operacionesPdf = $this->parsearPdfOcasa($textoPdf, $pdfConfig);

        if (empty($operacionesPdf)) {
            return [
                'archivo_id' => $archivo->id,
                'tipo_detectado' => 'PDF_CLIENTE',
                'operaciones_parseadas' => 0,
                'operaciones_actualizadas' => 0,
            ];
        }

        // Cargar operaciones de esta liquidación indexadas por id_operacion_cliente
        $operaciones = LiqOperacion::where('liquidacion_cliente_id', $liquidacion->id)
            ->whereNotNull('id_operacion_cliente')
            ->get()
            ->keyBy('id_operacion_cliente');

        $actualizadas = 0;
        foreach ($operacionesPdf as $opPdf) {
            $transporte = (string) ($opPdf['transporte'] ?? '');
            $operacion = $operaciones->get($transporte);
            if (!$operacion) {
                continue;
            }

            $impGrav = $opPdf['importe_gravado'] ?? null;
            $impNoGrav = $opPdf['importe_no_gravado'] ?? null;

            $updates = [];
            if ($impGrav !== null) {
                $updates['importe_gravado'] = round((float) $impGrav, 2);
            }
            if ($impNoGrav !== null) {
                $updates['importe_no_gravado'] = round((float) $impNoGrav, 2);
            }

            if (!empty($updates)) {
                $operacion->update($updates);
                $actualizadas++;
            }
        }

        $archivo->update(['cant_registros' => count($operacionesPdf)]);

        return [
            'archivo_id' => $archivo->id,
            'tipo_detectado' => 'PDF_CLIENTE',
            'operaciones_parseadas' => count($operacionesPdf),
            'operaciones_actualizadas' => $actualizadas,
        ];
    }

    // -------------------------------------------------------------------------
    // Modelo de tarifa
    // -------------------------------------------------------------------------

    /**
     * Clasificar modelo de tarifa por componentes de costo.
     */
    public function clasificarModelo(float $costoFijo, float $costoKm, float $costoProd): string
    {
        if ($costoFijo == 0 && $costoProd > 0) {
            return 'PRODUCTIVIDAD';
        }
        if ($costoKm > 1) {
            return 'JORNADA_KM';
        }
        return 'JORNADA';
    }

    /**
     * Detectar fracción de jornada comparando CostoFijo con la base de jornada completa.
     */
    public function detectarFraccion(float $costoFijo, float $costoFijoBase): float
    {
        if ($costoFijoBase <= 0) {
            return 1.0;
        }

        $ratio = $costoFijo / $costoFijoBase;

        // Mapear a fracciones conocidas (tolerancia 1%)
        $fracciones = [0.25, 0.3333, 0.5, 0.6667, 0.75, 1.0];
        foreach ($fracciones as $f) {
            if (abs($ratio - $f) < 0.01) {
                return $f;
            }
        }

        // Fracción no estándar
        Log::warning('OCASA: Fracción no estándar', [
            'ratio' => round($ratio, 4),
            'costo_fijo' => $costoFijo,
            'costo_fijo_base' => $costoFijoBase,
        ]);

        return round($ratio, 4);
    }

    /**
     * Calcular pago al distribuidor según el modelo de tarifa.
     */
    public function calcularPagoDistribuidor(
        string $modeloTarifa,
        LiqLineaTarifa $linea,
        ?LiqTarifaPatente $override,
        float $fraccionJornada,
        float $distanciaKm,
        float $costoProdOcasa,
        int $totalParadas
    ): array {
        // Tarifa jornada base del distribuidor
        $tarifaJornadaDistrib = $override && $override->modo_calculo === 'fijo'
            ? (float) $override->valor_referencia
            : (float) $linea->precio_distribuidor;

        if ($modeloTarifa === 'JORNADA') {
            $pago = round($tarifaJornadaDistrib * $fraccionJornada, 2);
            return [
                'total' => $pago,
                'jornada' => $tarifaJornadaDistrib,
            ];
        }

        if ($modeloTarifa === 'JORNADA_KM') {
            if ($fraccionJornada >= 1.0) {
                // Jornada completa + km excedente
                $umbralKm = (int) ($linea->umbral_km ?? 240);
                $tarifaKmDistrib = $override ? null : (float) ($linea->tarifa_km_distribuidor ?? 0);

                // Si hay override con modo fijo, usar solo jornada fija (sin km distribuidor)
                if ($override && $override->modo_calculo === 'fijo') {
                    $tarifaKmDistrib = (float) ($linea->tarifa_km_distribuidor ?? 0);
                }

                $kmExcedente = max(0, $distanciaKm - $umbralKm);
                $valorKm = round($kmExcedente * $tarifaKmDistrib, 2);
                $pago = round($tarifaJornadaDistrib + $valorKm, 2);

                return [
                    'total' => $pago,
                    'jornada' => $tarifaJornadaDistrib,
                    'km_valor' => $valorKm,
                ];
            }

            // Fracción parcial: solo jornada proporcional (sin km excedente)
            $pago = round($tarifaJornadaDistrib * $fraccionJornada, 2);
            return [
                'total' => $pago,
                'jornada' => $tarifaJornadaDistrib,
            ];
        }

        if ($modeloTarifa === 'PRODUCTIVIDAD') {
            $modo = $linea->modo_productividad ?? 'porcentaje';
            $pagoProductividad = 0;

            if ($modo === 'por_parada' && $linea->tarifa_parada_distrib > 0) {
                $pagoProductividad = round($totalParadas * (float) $linea->tarifa_parada_distrib, 2);
            } elseif ($modo === 'por_bulto' && $linea->tarifa_bulto_distrib > 0) {
                // bultos viene del YCC1 — usar totalParadas como proxy si no hay bultos
                $pagoProductividad = round($totalParadas * (float) $linea->tarifa_bulto_distrib, 2);
            } else {
                // porcentaje: aplicar % agencia al CostoProd de OCASA
                $pctAgencia = (float) $linea->porcentaje_agencia;
                $pagoProductividad = round($costoProdOcasa * (1 - $pctAgencia / 100), 2);
            }

            return [
                'total' => $pagoProductividad,
                'prod' => $pagoProductividad,
            ];
        }

        return ['total' => 0];
    }

    // -------------------------------------------------------------------------
    // Tarifa lookup
    // -------------------------------------------------------------------------

    /**
     * Buscar tarifa OCASA: override por patente → línea por ruta + capacidad → null.
     */
    private function buscarTarifaOcasa(
        LiqEsquemaTarifario $esquema,
        string $patenteNorm,
        array $dimensionesValores,
        string $fecha,
        int $clienteId
    ): ?array {
        // 1. Override por patente
        if ($patenteNorm !== '') {
            $tp = LiqTarifaPatente::where('esquema_id', $esquema->id)
                ->where('activo', true)
                ->where('patente_norm', $patenteNorm)
                ->where(function ($q) use ($clienteId) {
                    $q->where('liq_cliente_id', $clienteId)->orWhereNull('liq_cliente_id');
                })
                ->where('vigencia_desde', '<=', $fecha)
                ->where(function ($q) use ($fecha) {
                    $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $fecha);
                })
                ->whereHas('lineaTarifa', function ($q) use ($fecha, $esquema) {
                    $q->where('esquema_id', $esquema->id)
                        ->where('activo', true)
                        ->whereNotNull('aprobado_por')
                        ->where('vigencia_desde', '<=', $fecha)
                        ->where(function ($q) use ($fecha) {
                            $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $fecha);
                        });
                })
                ->with('lineaTarifa')
                ->first();

            if ($tp && $tp->lineaTarifa) {
                return ['linea' => $tp->lineaTarifa, 'override' => $tp];
            }
        }

        // 2. Línea por dimensiones (ruta + capacidad)
        $q = LiqLineaTarifa::where('esquema_id', $esquema->id)
            ->where('activo', true)
            ->whereNotNull('aprobado_por')
            ->where('vigencia_desde', '<=', $fecha)
            ->where(function ($q) use ($fecha) {
                $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $fecha);
            });

        foreach ($dimensionesValores as $dim => $valor) {
            $q->where("dimensiones_valores->{$dim}", $valor);
        }

        $linea = $q->first();
        if ($linea) {
            return ['linea' => $linea, 'override' => null];
        }

        // 3. Fallback: solo por ruta (sin capacidad)
        if (isset($dimensionesValores['capacidad_vehiculo'])) {
            $dimsSimple = $dimensionesValores;
            unset($dimsSimple['capacidad_vehiculo']);

            $q2 = LiqLineaTarifa::where('esquema_id', $esquema->id)
                ->where('activo', true)
                ->whereNotNull('aprobado_por')
                ->where('vigencia_desde', '<=', $fecha)
                ->where(function ($q) use ($fecha) {
                    $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $fecha);
                });

            foreach ($dimsSimple as $dim => $valor) {
                $q2->where("dimensiones_valores->{$dim}", $valor);
            }

            $lineaFallback = $q2->first();
            if ($lineaFallback) {
                return ['linea' => $lineaFallback, 'override' => null];
            }
        }

        return null;
    }

    // -------------------------------------------------------------------------
    // PDF parsing
    // -------------------------------------------------------------------------

    /**
     * Parsear el texto de un PDF de OCASA para extraer operaciones con gravado/no gravado.
     * Formato esperado: tablas con columnas Transporte, Importe, Imp.Grav, Imp.NoGrav
     */
    private function parsearPdfOcasa(string $texto, array $pdfConfig): array
    {
        $formatoNumeros = $pdfConfig['formato_numeros'] ?? 'argentino';
        $operaciones = [];
        $lines = preg_split('/\R/u', $texto) ?: [];

        // Buscar líneas con patrón: número_transporte ... importes
        // El formato típico es: Transporte | ... | Importe | Imp.Grav | Imp.NoGrav
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }

            // Patrón: un número de transporte (8+ dígitos) seguido de importes
            // Los importes pueden estar en formato argentino: 131.251,00
            if (preg_match('/(\d{7,})\s+/', $line, $matchTransporte)) {
                $transporte = $matchTransporte[1];

                // Extraer todos los números en formato argentino del resto de la línea
                $importes = [];
                // Formato argentino: 1.234.567,89 o 131.251,00
                // También manejar dígitos separados: $ 1 31.251,00
                preg_match_all('/[\d]+(?:\.[\d]{3})*(?:,[\d]{2})/', $line, $numMatches);
                foreach ($numMatches[0] as $numStr) {
                    $importes[] = $this->parseNumeroArgentino($numStr);
                }

                // Necesitamos al menos 3 importes: Importe, Imp.Grav, Imp.NoGrav
                if (count($importes) >= 3) {
                    $totalImportes = count($importes);
                    $operaciones[] = [
                        'transporte' => $transporte,
                        'importe' => $importes[$totalImportes - 3],
                        'importe_gravado' => $importes[$totalImportes - 2],
                        'importe_no_gravado' => $importes[$totalImportes - 1],
                    ];
                }
            }
        }

        return $operaciones;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private static function resolverHoja($spreadsheet, string $hojaConfig)
    {
        // Intentar por nombre de hoja
        $sheet = $spreadsheet->getSheetByName($hojaConfig);
        if ($sheet) {
            return $sheet;
        }

        // Intentar por índice (base 0)
        $idx = is_numeric($hojaConfig) ? (int) $hojaConfig : null;
        if ($idx !== null) {
            // Intentar índice-1 (spec dice hoja '8' pero podría ser 0-based)
            $count = $spreadsheet->getSheetCount();
            if ($idx < $count) {
                return $spreadsheet->getSheet($idx);
            }
            if (($idx - 1) >= 0 && ($idx - 1) < $count) {
                return $spreadsheet->getSheet($idx - 1);
            }
        }

        // Fallback: primera hoja
        return $spreadsheet->getActiveSheet();
    }

    private function mapearColumnas(array $headers, array $columnasConfig): array
    {
        $map = [];
        $headersNorm = [];
        foreach ($headers as $idx => $h) {
            $headersNorm[$idx] = strtolower(trim(preg_replace('/\s+/', ' ', $h) ?? $h));
        }

        foreach ($columnasConfig as $campo => $headerName) {
            $headerNorm = strtolower(trim(preg_replace('/\s+/', ' ', (string) $headerName) ?? (string) $headerName));
            foreach ($headersNorm as $idx => $h) {
                // Match exacto o match con strip trailing
                if ($h === $headerNorm || rtrim($h) === $headerNorm || $h === rtrim($headerNorm)) {
                    $map[$campo] = $idx;
                    break;
                }
            }
        }

        return $map;
    }

    private function getVal(array $row, array $colMap, string $campo): mixed
    {
        $idx = $colMap[$campo] ?? null;
        if ($idx === null) {
            return null;
        }
        return $row[$idx] ?? null;
    }

    private function parseNum(mixed $raw): float
    {
        if ($raw === null) {
            return 0.0;
        }
        if (is_int($raw) || is_float($raw)) {
            return (float) $raw;
        }
        $value = trim((string) $raw);
        if ($value === '') {
            return 0.0;
        }
        // Quitar caracteres no numéricos excepto punto, coma y signo
        $value = preg_replace('/[^\d\.,\-]/u', '', $value) ?? $value;
        if ($value === '') {
            return 0.0;
        }
        // Formato con punto decimal (Excel estándar)
        if (preg_match('/^\-?[\d,]*\.\d+$/', $value)) {
            return (float) str_replace(',', '', $value);
        }
        // Formato argentino: punto = miles, coma = decimal
        if (preg_match('/^\-?[\d.]*,\d+$/', $value)) {
            return (float) str_replace(['.', ','], ['', '.'], $value);
        }
        return (float) preg_replace('/[^\d.\-]/', '', $value);
    }

    private function parseNumeroArgentino(string $value): float
    {
        // 131.251,00 → 131251.00
        $value = str_replace('.', '', $value);
        $value = str_replace(',', '.', $value);
        return (float) $value;
    }

    private function parsearCapacidadVehicular(string $pesoAprox): ?int
    {
        if ($pesoAprox === '') {
            return null;
        }
        // Extraer número
        $num = (int) preg_replace('/[^\d]/', '', $pesoAprox);
        if ($num <= 0) {
            return null;
        }
        // Normalizar a los rangos conocidos
        if ($num <= 100) return 100;
        if ($num <= 700) return 700;
        if ($num <= 1500) return 1500;
        if ($num <= 2500) return 2500;
        if ($num <= 5000) return 5000;
        if ($num <= 7500) return 7500;
        return 10000;
    }

    private function parseFecha(mixed $raw): ?string
    {
        if ($raw === null) {
            return null;
        }
        try {
            return \Illuminate\Support\Carbon::parse((string) $raw)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    private function buildDistribuidoresLookup(?string $periodoDesde = null, ?string $periodoHasta = null): array
    {
        $lookup = [];
        $query = Persona::with('patentesAdicionales:id,persona_id,patente,patente_norm,activo');

        // BUGFIX 21 B: solo fecha_baja, no fecha_alta (permite altas retroactivas)
        if ($periodoDesde) {
            $query->where(function ($q) use ($periodoDesde) {
                $q->whereNull('fecha_baja')->orWhere('fecha_baja', '>=', $periodoDesde);
            });
        }

        $personas = $query->get(['id', 'patente', 'fecha_alta', 'fecha_baja']);

        foreach ($personas as $persona) {
            foreach (PersonaPatenteHelper::normalizedDomainsForPersona($persona) as $patente) {
                if ($patente === '') {
                    continue;
                }
                $lookup[$patente][] = $persona;
            }
        }

        return $lookup;
    }

    private function buscarDistribuidorPorPatente(string $patenteNorm, array $lookup): ?Persona
    {
        $candidates = $lookup[$patenteNorm] ?? [];
        if (count($candidates) === 1) {
            return $candidates[0];
        }
        // Dedup por ID
        $unique = [];
        foreach ($candidates as $c) {
            $unique[$c->id] = $c;
        }
        return count($unique) === 1 ? array_values($unique)[0] : null;
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

    private function appendObs(?string $base, string $fragment): string
    {
        $fragment = trim($fragment);
        if ($fragment === '') {
            return trim((string) $base);
        }
        if (!is_string($base) || trim($base) === '') {
            return $fragment;
        }
        return trim($base) . ' ' . $fragment;
    }
}

<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqCliente;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqLiquidacionDistribuidor;
use App\Models\LiqOperacion;
use App\Models\Persona;
use App\Services\Pdf\LiqDistribuidorPdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

class LiqExtractosController extends Controller
{
    // ── DEBUG: inspeccionar Excel sin procesar (eliminar antes de producción) ─

    public function debugXlsx(Request $request): JsonResponse
    {
        $this->authorize($request);

        $request->validate(['archivo' => ['required', 'file', 'mimes:xlsx,xls', 'max:20480']]);

        /** @var \Illuminate\Http\UploadedFile $archivo */
        $archivo = $request->file('archivo');
        $rows    = $this->parseXlsxRows($archivo->getRealPath());

        // Devolver las primeras 10 filas crudas + la fila detectada como header
        $headerIndex = null;
        foreach ($rows as $i => $row) {
            $noVacias = count(array_filter($row, fn ($c) => trim((string) $c) !== ''));
            if ($noVacias >= 5) {
                $headerIndex = $i;
                break;
            }
        }

        $headers = $headerIndex !== null
            ? array_map(fn ($h) => strtolower(trim((string) $h)), $rows[$headerIndex])
            : [];

        return response()->json([
            'total_rows'   => count($rows),
            'header_index' => $headerIndex,
            'headers'      => $headers,
            'first_10_raw' => array_slice($rows, 0, 10),
        ]);
    }

    // ── Listado de liquidaciones ──────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $this->authorize($request);

        $query = LiqLiquidacionCliente::query()
            ->with('cliente:id,nombre_corto')
            ->with('usuarioCarga:id,name')
            ->orderByDesc('id');

        if ($clienteId = $request->integer('cliente_id')) {
            $query->where('cliente_id', $clienteId);
        }
        $estado = trim((string) $request->input('estado', ''));
        if ($estado !== '') {
            $query->where('estado', $estado);
        }
        $desde = trim((string) $request->input('periodo_desde', ''));
        if ($desde !== '') {
            $query->where('periodo_hasta', '>=', $desde);
        }
        $hasta = trim((string) $request->input('periodo_hasta', ''));
        if ($hasta !== '') {
            $query->where('periodo_desde', '<=', $hasta);
        }

        $paginator = $query->paginate($request->integer('per_page', 50));

        $items = collect($paginator->items())->map(fn (LiqLiquidacionCliente $r) => [
            ...$r->toArray(),
            'cliente_nombre' => $r->cliente?->nombre_corto,
            'usuario_nombre' => $r->usuarioCarga?->name,
        ]);

        return response()->json([
            'data' => $items,
            'meta' => [
                'total'        => $paginator->total(),
                'per_page'     => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
            ],
        ]);
    }

    // ── Carga de archivo Excel ────────────────────────────────────────────

    public function upload(Request $request): JsonResponse
    {
        $this->authorize($request);

        $validated = $request->validate([
            'archivo'        => ['required', 'file', 'mimes:xlsx,xls', 'max:20480'],
            'cliente_id'     => ['required', 'integer', 'exists:liq_clientes,id'],
            'periodo_desde'  => ['required', 'date'],
            'periodo_hasta'  => ['required', 'date', 'after_or_equal:periodo_desde'],
            'sucursal_tarifa'=> ['nullable', 'string', 'max:255'],
        ]);

        /** @var \Illuminate\Http\UploadedFile $archivo */
        $archivo = $validated['archivo'];
        $nombreArchivo = $archivo->getClientOriginalName();

        /** @var LiqCliente $cliente */
        $cliente = LiqCliente::query()->findOrFail($validated['cliente_id']);
        $configExcel = is_array($cliente->configuracion_excel) ? $cliente->configuracion_excel : [];
        $sheetName   = isset($configExcel['sheet_name']) && is_string($configExcel['sheet_name'])
            ? trim($configExcel['sheet_name'])
            : null;
        $headerRow   = isset($configExcel['header_row']) ? (int) $configExcel['header_row'] : null;
        $columnAliases = is_array($configExcel['column_aliases'] ?? null) ? $configExcel['column_aliases'] : [];

        // Detectar sucursal tarifa desde el nombre del archivo (si no viene explícita)
        $sucursalTarifa = $validated['sucursal_tarifa'] ?? null;
        if (! $sucursalTarifa) {
            $mapeo = $cliente->resolverSucursalPorArchivo($nombreArchivo);
            $sucursalTarifa = $mapeo?->sucursal_tarifa;
        }

        // Parsear el Excel
        $rows = $this->parseXlsxRows($archivo->getRealPath(), $sheetName);
        if (empty($rows)) {
            return response()->json(['message' => 'El archivo está vacío o no se pudo leer.'], 422);
        }

        $liquidacion = DB::transaction(function () use ($validated, $nombreArchivo, $sucursalTarifa, $rows, $cliente, $headerRow, $columnAliases, $request) {
            $liq = LiqLiquidacionCliente::query()->create([
                'cliente_id'      => $validated['cliente_id'],
                'archivo_origen'  => $nombreArchivo,
                'sucursal_tarifa' => $sucursalTarifa,
                'periodo_desde'   => $validated['periodo_desde'],
                'periodo_hasta'   => $validated['periodo_hasta'],
                'usuario_carga'   => $request->user()?->id,
                'estado'          => 'en_proceso',
            ]);

            // Procesar filas
            $this->procesarFilas(
                $liq,
                $rows,
                $cliente,
                $sucursalTarifa ?? '',
                $headerRow,
                $columnAliases
            );
            $liq->recalcularTotales();
            $liq->update(['estado' => 'auditada']);

            return $liq;
        });

        $liquidacion->load('cliente:id,nombre_corto', 'usuarioCarga:id,name');

        return response()->json([
            'data' => [
                ...$liquidacion->toArray(),
                'cliente_nombre' => $liquidacion->cliente?->nombre_corto,
                'usuario_nombre' => $liquidacion->usuarioCarga?->name,
            ],
        ], 201);
    }

    // ── Operaciones de un extracto ────────────────────────────────────────

    public function operaciones(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $this->authorize($request);

        $ops = $liquidacionCliente->operaciones()
            ->with('distribuidor:id,nombres,apellidos,patente')
            ->orderBy('id')
            ->get()
            ->map(fn (LiqOperacion $o) => [
                ...$o->toArray(),
                'distribuidor_nombre' => $o->distribuidor
                    ? trim("{$o->distribuidor->apellidos} {$o->distribuidor->nombres}")
                    : null,
            ]);

        return response()->json(['data' => $ops]);
    }

    // ── Recalcular cruce tarifario (sin re-subir Excel) ───────────────────

    public function recalcular(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $this->authorize($request);

        if (in_array($liquidacionCliente->estado, ['aprobada', 'rechazada'], true)) {
            return response()->json([
                'message' => "No se puede recalcular un extracto en estado '{$liquidacionCliente->estado}'.",
            ], 422);
        }

        $cliente = $liquidacionCliente->cliente;
        if (! $cliente) {
            return response()->json(['message' => 'Cliente no encontrado para este extracto.'], 422);
        }

        $esquema = $cliente->esquemas()->where('activo', true)->first();
        if (! $esquema) {
            return response()->json(['message' => 'El cliente no tiene un esquema tarifario activo.'], 422);
        }

        $mapeosConceptoRaw = $cliente->mapeosConcepto()->where('activo', true)->get();
        $mapeosConceptoStrict = $mapeosConceptoRaw
            ->keyBy(fn ($m) => $this->normalizeKeyStrict((string) $m->valor_excel));
        $mapeosConceptoLoose = $mapeosConceptoRaw
            ->keyBy(fn ($m) => $this->normalizeKeyLoose((string) $m->valor_excel));

        $sucursalTarifa = (string) ($liquidacionCliente->sucursal_tarifa ?? '');
        $fechaCruce = $liquidacionCliente->periodo_desde->toDateString();

        DB::transaction(function () use ($liquidacionCliente, $esquema, $mapeosConceptoStrict, $mapeosConceptoLoose, $sucursalTarifa, $fechaCruce) {
            // Limpiar filas no operativas que quedaron cargadas como "operación" (ej: TOTAL/SUBTOTAL)
            $liquidacionCliente->operaciones()
                ->whereNull('distribuidor_id')
                ->whereNull('linea_tarifa_id')
                ->where(function ($q) {
                    $q->where('dominio', 'like', 'TOTAL%')
                        ->orWhere('concepto', 'like', 'TOTAL%')
                        ->orWhere('dominio', 'like', 'SUBTOTAL%')
                        ->orWhere('concepto', 'like', 'SUBTOTAL%');
                })
                ->delete();

            $liquidacionCliente->operaciones()
                ->orderBy('id')
                ->chunkById(500, function ($chunk) use ($esquema, $mapeosConceptoStrict, $mapeosConceptoLoose, $sucursalTarifa, $fechaCruce) {
                    foreach ($chunk as $op) {
                        $this->recalcularOperacion($op, $esquema, [
                            'strict' => $mapeosConceptoStrict,
                            'loose' => $mapeosConceptoLoose,
                        ], $sucursalTarifa, $fechaCruce);
                    }
                });

            $liquidacionCliente->recalcularTotales();
            $liquidacionCliente->update(['estado' => 'auditada']);
        });

        $counts = $liquidacionCliente->operaciones()
            ->select('estado', DB::raw('COUNT(*) as c'))
            ->groupBy('estado')
            ->pluck('c', 'estado');

        $missingConcepts = $liquidacionCliente->operaciones()
            ->where('estado', 'sin_tarifa')
            ->whereNotNull('concepto')
            ->select('concepto', DB::raw('COUNT(*) as c'))
            ->groupBy('concepto')
            ->orderByDesc('c')
            ->limit(50)
            ->get()
            ->map(fn ($r) => ['concepto' => $r->concepto, 'count' => (int) $r->c]);

        return response()->json([
            'data' => [
                'liquidacion' => $liquidacionCliente->fresh(),
                'estado_counts' => $counts,
                'missing_concepts' => $missingConcepts,
            ],
            'message' => 'Recalculo realizado.',
        ]);
    }

    // ── Aprobar extracto ──────────────────────────────────────────────────

    public function aprobar(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $this->authorize($request);

        if ($liquidacionCliente->estado !== 'auditada') {
            return response()->json([
                'message' => "Solo se pueden aprobar extractos en estado 'auditada'. Estado actual: {$liquidacionCliente->estado}.",
            ], 422);
        }

        $liquidacionCliente->update(['estado' => 'aprobada']);

        return response()->json([
            'data'    => $liquidacionCliente,
            'message' => 'Extracto aprobado correctamente.',
        ]);
    }

    // ── Borrar extracto ───────────────────────────────────────────────────

    public function destroy(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $this->authorize($request);

        // Seguridad: no permitir borrar si ya está incluido en un pago
        $liqDists = $liquidacionCliente->liquidacionesDistribuidor()
            ->get(['id', 'pago_id', 'estado', 'pdf_path']);

        $hasPago = $liqDists->contains(fn ($l) => $l->pago_id !== null);
        if ($hasPago) {
            return response()->json([
                'message' => 'No se puede borrar: el extracto tiene liquidaciones incluidas en un lote de pagos.',
            ], 422);
        }

        $hasPagada = $liqDists->contains(fn ($l) => $l->estado === 'pagada');
        if ($hasPagada) {
            return response()->json([
                'message' => 'No se puede borrar: el extracto tiene liquidaciones ya pagadas.',
            ], 422);
        }

        // Borrar PDFs derivados (si existen) antes de borrar la DB
        $pdfPaths = $liqDists
            ->pluck('pdf_path')
            ->filter(fn ($p) => is_string($p) && trim($p) !== '')
            ->map(fn ($p) => trim((string) $p))
            ->unique()
            ->values();

        foreach ($pdfPaths as $path) {
            try {
                Storage::disk('public')->delete($path);
            } catch (\Throwable) {
                // ignore
            }
        }

        DB::transaction(function () use ($liquidacionCliente) {
            // FK cascades:
            // - liq_operaciones + auditorías
            // - liq_liquidaciones_distribuidor + pago_items
            $liquidacionCliente->delete();
        });

        return response()->json([
            'data' => ['id' => $liquidacionCliente->id],
            'message' => 'Extracto borrado.',
        ]);
    }

    // ── Generar liquidaciones por distribuidor ────────────────────────────

    public function generarDistribuidores(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $this->authorize($request);

        if ($liquidacionCliente->estado !== 'aprobada') {
            return response()->json([
                'message' => "Solo se pueden generar liquidaciones desde un extracto aprobado.",
            ], 422);
        }

        $periodoDesde = $liquidacionCliente->periodo_desde->toDateString();
        $periodoHasta = $liquidacionCliente->periodo_hasta->toDateString();

        $gasto = $liquidacionCliente->cliente->gastoActivoPara($periodoDesde);
        $montoGasto = $gasto?->monto ?? 0;

        $operaciones = $liquidacionCliente->operaciones()
            ->whereIn('estado', ['ok', 'diferencia'])
            ->where('excluida', false)
            ->whereNotNull('distribuidor_id')
            ->get();

        $porDistribuidor = $operaciones->groupBy('distribuidor_id');

        $liquidaciones = DB::transaction(function () use ($liquidacionCliente, $porDistribuidor, $montoGasto, $periodoDesde, $periodoHasta) {
            $resultado = [];

            foreach ($porDistribuidor as $distribuidorId => $ops) {
                $subtotal = $ops->sum('valor_tarifa_distribuidor');

                $liqDist = LiqLiquidacionDistribuidor::query()->updateOrCreate(
                    [
                        'liquidacion_cliente_id' => $liquidacionCliente->id,
                        'distribuidor_id'        => $distribuidorId,
                    ],
                    [
                        'periodo_desde'           => $periodoDesde,
                        'periodo_hasta'           => $periodoHasta,
                        'fecha_generacion'        => now(),
                        'cantidad_operaciones'    => $ops->count(),
                        'subtotal'                => $subtotal,
                        'gastos_administrativos'  => $montoGasto,
                        'total_a_pagar'           => max(0, $subtotal - $montoGasto),
                        'estado'                  => 'generada',
                    ]
                );

                $resultado[] = [$liqDist, $ops];
            }

            return $resultado;
        });

        // Generar PDFs fuera de la transacción (operación de I/O)
        $pdfService = new LiqDistribuidorPdfService();
        $clienteNombre = $liquidacionCliente->cliente?->razon_social
            ?? $liquidacionCliente->cliente?->nombre_corto
            ?? '';

        foreach ($liquidaciones as [$liqDist, $ops]) {
            try {
                $this->generarPdfDistribuidor($pdfService, $liqDist, $ops, $clienteNombre);
            } catch (\Throwable) {
                // PDF fallido no bloquea la liquidación; quedará sin pdf_path
            }
        }

        $count = count($liquidaciones);

        return response()->json([
            'message' => "Se generaron {$count} liquidaciones por distribuidor.",
            'count'   => $count,
        ]);
    }

    // ── Generación de PDF por distribuidor ───────────────────────────────

    /**
     * Genera el PDF de una liquidación de distribuidor y actualiza pdf_path en el modelo.
     *
     * @param \Illuminate\Support\Collection $ops  Colección de LiqOperacion
     */
    private function generarPdfDistribuidor(
        LiqDistribuidorPdfService $service,
        LiqLiquidacionDistribuidor $liqDist,
        $ops,
        string $clienteNombre
    ): void {
        $dist = $liqDist->distribuidor;

        $rows = $ops->map(function (LiqOperacion $op) {
            return [
                'fecha'        => $op->created_at?->format('d/m/Y') ?? '',
                'dominio'      => (string) ($op->dominio ?? ''),
                'concepto'     => (string) ($op->concepto ?? ''),
                'valor_cliente'=> $this->formatPeso((float) ($op->valor_cliente ?? 0)),
                'tarifa_dist'  => $this->formatPeso((float) ($op->valor_tarifa_distribuidor ?? 0)),
                'diferencia'   => $this->formatPeso((float) ($op->diferencia_cliente ?? 0)),
            ];
        })->values()->all();

        $subtotal    = (float) $liqDist->subtotal;
        $gastosAdmin = (float) $liqDist->gastos_administrativos;
        $total       = (float) $liqDist->total_a_pagar;

        $data = [
            'company_name'           => 'Logística Argentina SRL',
            'cliente'                => $clienteNombre,
            'distribuidor_nombre'    => $dist ? trim("{$dist->apellidos} {$dist->nombres}") : '',
            'distribuidor_patente'   => (string) ($dist?->patente ?? ''),
            'distribuidor_cuit'      => (string) ($dist?->cuit_cuil ?? ''),
            'periodo'                => sprintf(
                '%s al %s',
                $liqDist->periodo_desde->format('d/m/Y'),
                $liqDist->periodo_hasta->format('d/m/Y')
            ),
            'fecha_generacion'       => now()->format('d/m/Y'),
            'rows'                   => $rows,
            'totals'                 => [
                'subtotal'    => $this->formatPeso($subtotal),
                'gastos_admin'=> $this->formatPeso($gastosAdmin),
                'total'       => $this->formatPeso($total),
            ],
        ];

        $pdfContent = $service->generate($data);
        $path       = sprintf('liquidaciones/distribuidor/%d.pdf', $liqDist->id);

        Storage::disk('public')->put($path, $pdfContent);
        $liqDist->update(['pdf_path' => $path]);
    }

    private function formatPeso(float $amount): string
    {
        return '$ ' . number_format($amount, 2, ',', '.');
    }

    // ── Parseo de XLSX (misma técnica que CierreDiarioController) ────────

    private function parsearFilasNormalizadas(
        LiqLiquidacionCliente $liq,
        array $rows,
        ?int $headerRow = null,
        array $columnAliases = []
    ): array
    {
        if (empty($rows)) {
            return [];
        }

        // Detectar fila de encabezados (primera fila con >= 5 celdas no vacías)
        $headerIndex = null;
        if ($headerRow !== null && $headerRow >= 1) {
            $headerIndex = $headerRow - 1;
        } else {
            foreach ($rows as $i => $row) {
                $noVacias = count(array_filter($row, fn ($c) => trim((string) $c) !== ''));
                if ($noVacias >= 5) {
                    $headerIndex = $i;
                    break;
                }
            }
        }

        if ($headerIndex === null) {
            return [];
        }
        if (! isset($rows[$headerIndex])) {
            return [];
        }

        // Normalizar encabezados: minúsculas + solo alfanumérico (maneja espacios, tildes, chars especiales)
        $headers = array_map(
            fn ($h) => preg_replace('/[^a-z0-9]/', '', strtolower(trim((string) $h))),
            $rows[$headerIndex]
        );
        // Headers legibles para campos_originales (con espacios, sin tanta normalización)
        $headersLegibles = array_map(fn ($h) => strtolower(trim((string) $h)), $rows[$headerIndex]);

        $resultado = [];
        foreach (array_slice($rows, $headerIndex + 1) as $row) {
            // Construir campos_originales con headers legibles
            $original = [];
            foreach ($headersLegibles as $idx => $header) {
                if ($header !== '') {
                    $original[$header] = $row[$idx] ?? null;
                }
            }

            // Extraer campos clave (nombres normalizados = solo alfanumérico, minúsculas)
            $dominioRaw = $this->resolverCelda(
                $row,
                $headers,
                $this->buildHeaderAliases($columnAliases, 'dominio', ['dominio', 'patente', 'matricula'])
            );
            $concepto = $this->resolverCelda(
                $row,
                $headers,
                $this->buildHeaderAliases($columnAliases, 'concepto', ['concepto', 'tipoviaje', 'tipo', 'categoriavehiculo'])
            );
            $valorRaw = $this->resolverCelda(
                $row,
                $headers,
                $this->buildHeaderAliases($columnAliases, 'valor', ['valor', 'importe', 'monto', 'precio', 'valorviaje'])
            );

            // Ignorar filas de totales/subtotales (no operativas)
            if ($this->isTotalLike($dominioRaw) || $this->isTotalLike($concepto)) {
                continue;
            }

            $dominio = $dominioRaw ? LiqOperacion::normalizarPatente($dominioRaw) : null;
            $valor   = $this->parseDecimal($valorRaw);

            if ($dominio === null && $valor === 0.0 && $concepto === null) {
                continue; // fila vacía / total
            }

            $resultado[] = compact('original', 'dominio', 'concepto', 'valor');
        }

        return $resultado;
    }

    private function procesarFilas(
        LiqLiquidacionCliente $liq,
        array $rows,
        LiqCliente $cliente,
        string $sucursalTarifa,
        ?int $headerRow = null,
        array $columnAliases = []
    ): void
    {
        $filas = $this->parsearFilasNormalizadas($liq, $rows, $headerRow, $columnAliases);

        // Mapeos del cliente
        $mapeosConceptoRaw = $cliente->mapeosConcepto()->where('activo', true)->get();
        $mapeosConceptoStrict = $mapeosConceptoRaw
            ->keyBy(fn ($m) => $this->normalizeKeyStrict((string) $m->valor_excel));
        $mapeosConceptoLoose = $mapeosConceptoRaw
            ->keyBy(fn ($m) => $this->normalizeKeyLoose((string) $m->valor_excel));

        // Esquema tarifario activo
        $esquema = $cliente->esquemas()->where('activo', true)->first();

        // Cache de distribuidores por patente
        $distribuidoresCache = [];

        foreach ($filas as $fila) {
            $dominio  = $fila['dominio'];
            $concepto = $fila['concepto'];
            $valor    = $fila['valor'];

            // Identificar distribuidor
            $distribuidorId = null;
            $estado         = 'sin_distribuidor';
            $observacion    = null;

            if ($dominio) {
                if (! isset($distribuidoresCache[$dominio])) {
                    $persona = Persona::query()
                        ->where('patente_idx', $dominio)
                        ->first();
                    $distribuidoresCache[$dominio] = $persona;
                }

                $persona = $distribuidoresCache[$dominio];
                if ($persona) {
                    $distribuidorId = $persona->id;
                    $estado         = 'ok';
                    // Verificar si está activo
                    $estadoPersona = strtolower(trim((string) ($persona->estado ?? '')));
                    if (in_array($estadoPersona, ['baja', 'suspendido', 'inactivo'], true)) {
                        $estado = 'observado';
                        $observacion = 'Distribuidor inactivo/observado.';
                    }
                } else {
                    $observacion = 'Patente no encontrada en maestro de distribuidores.';
                }
            } else {
                $observacion = 'Fila sin patente/dominio.';
            }

            // Cruce tarifario
            $lineaTarifa             = null;
            $valorTarifaOriginal     = null;
            $valorTarifaDistribuidor = null;
            $porcentajeAgencia       = null;
            $diferencia              = null;

            if ($esquema && $concepto) {
                $conceptoNormStrict = $this->normalizeKeyStrict($concepto);
                $conceptoNormLoose  = $this->normalizeKeyLoose($concepto);
                $mapeo = $mapeosConceptoStrict->get($conceptoNormStrict)
                    ?? $mapeosConceptoLoose->get($conceptoNormLoose);

                if ($mapeo) {
                    $dimensionesValores = [
                        $mapeo->dimension_destino => $mapeo->valor_tarifa,
                    ];
                    if ($sucursalTarifa && in_array('sucursal', $esquema->dimensiones ?? [], true)) {
                        $dimensionesValores['sucursal'] = $sucursalTarifa;
                    }

                    $lineaTarifa = $esquema->buscarLinea($dimensionesValores, $liq->periodo_desde->toDateString());

                    if ($lineaTarifa) {
                        $valorTarifaOriginal     = (float) $lineaTarifa->precio_original;
                        $valorTarifaDistribuidor = (float) $lineaTarifa->precio_distribuidor;
                        $porcentajeAgencia       = (float) $lineaTarifa->porcentaje_agencia;
                        $diferencia              = $valor - $valorTarifaOriginal;

                        // Clasificar según diferencia
                        if ($estado !== 'observado' && $estado !== 'sin_distribuidor') {
                            $tolerancia = 0.02; // 2% default
                            $pctDif     = $valorTarifaOriginal > 0
                                ? abs($diferencia) / $valorTarifaOriginal
                                : ($diferencia !== 0.0 ? 1.0 : 0.0);

                            $estado = $pctDif <= $tolerancia ? 'ok' : 'diferencia';
                        }
                        $observacion = $observacion ?: null;
                    } else {
                        if ($estado === 'ok') {
                            $estado = 'sin_tarifa';
                        }
                        $observacion = 'Sin línea de tarifa para la combinación: '
                            . json_encode($dimensionesValores, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                    }
                } else {
                    if ($estado === 'ok') {
                        $estado = 'sin_tarifa';
                    }
                    $observacion = "Concepto sin mapeo: {$concepto}";
                }
            } else {
                // Sin concepto o sin esquema: no se puede cruzar tarifa
                if ($estado === 'ok' || $estado === 'observado') {
                    $estado = 'sin_tarifa';
                }
                if (! $esquema) {
                    $observacion = 'Sin esquema tarifario activo para el cliente.';
                } elseif (! $concepto) {
                    $observacion = 'Fila sin concepto.';
                }
            }

            LiqOperacion::query()->create([
                'liquidacion_cliente_id'    => $liq->id,
                'campos_originales'         => $fila['original'],
                'dominio'                   => $dominio,
                'concepto'                  => $concepto,
                'valor_cliente'             => $valor,
                'linea_tarifa_id'           => $lineaTarifa?->id,
                'valor_tarifa_original'     => $valorTarifaOriginal,
                'valor_tarifa_distribuidor' => $valorTarifaDistribuidor,
                'porcentaje_agencia'        => $porcentajeAgencia,
                'diferencia_cliente'        => $diferencia,
                'estado'                    => $estado,
                'distribuidor_id'           => $distribuidorId,
                'observacion'               => $observacion,
            ]);
        }
    }

    private function normalizeKey(?string $raw): string
    {
        return $this->normalizeKeyStrict($raw);
    }

    private function normalizeKeyStrict(?string $raw): string
    {
        $value = $raw ?? '';
        $value = str_replace("\xc2\xa0", ' ', $value); // NBSP
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?? trim($value);

        return function_exists('mb_strtolower') ? mb_strtolower($value) : strtolower($value);
    }

    private function normalizeKeyLoose(?string $raw): string
    {
        $strict = $this->normalizeKeyStrict($raw);
        $loose = preg_replace('/[^a-z0-9]/', '', $strict);

        return $loose ?? $strict;
    }

    private function isTotalLike(?string $raw): bool
    {
        if ($raw === null) {
            return false;
        }

        $key = $this->normalizeKeyLoose($raw);

        return str_starts_with($key, 'total') || str_starts_with($key, 'subtotal');
    }

    private function recalcularOperacion(
        LiqOperacion $op,
        $esquema,
        array $mapeosConcepto,
        string $sucursalTarifa,
        string $fechaCruce
    ): void {
        if ($op->estado === 'duplicado') {
            return;
        }

        $estadoBase = $op->distribuidor_id ? 'ok' : 'sin_distribuidor';
        $observacion = $op->distribuidor_id ? null : 'Sin distribuidor asignado.';

        if ($op->estado === 'observado' && $op->distribuidor_id) {
            $estadoBase = 'observado';
            $observacion = $op->observacion ?: 'Distribuidor observado.';
        }

        // Cruce tarifario (si hay concepto)
        $lineaTarifa = null;
        $valorTarifaOriginal = null;
        $valorTarifaDistribuidor = null;
        $porcentajeAgencia = null;
        $diferencia = null;

        if ($op->concepto) {
            $conceptoNormStrict = $this->normalizeKeyStrict($op->concepto);
            $conceptoNormLoose  = $this->normalizeKeyLoose($op->concepto);
            $mapeo = $mapeosConcepto['strict']->get($conceptoNormStrict)
                ?? $mapeosConcepto['loose']->get($conceptoNormLoose);

            if (! $mapeo) {
                if ($estadoBase === 'ok') {
                    $estadoBase = 'sin_tarifa';
                }
                $observacion = "Concepto sin mapeo: {$op->concepto}";
            } else {
                $dimensionesValores = [
                    $mapeo->dimension_destino => $mapeo->valor_tarifa,
                ];
                if ($sucursalTarifa && in_array('sucursal', $esquema->dimensiones ?? [], true)) {
                    $dimensionesValores['sucursal'] = $sucursalTarifa;
                }

                $lineaTarifa = $esquema->buscarLinea($dimensionesValores, $fechaCruce);
                if (! $lineaTarifa) {
                    if ($estadoBase === 'ok') {
                        $estadoBase = 'sin_tarifa';
                    }
                    $observacion = 'Sin línea de tarifa para la combinación: '
                        . json_encode($dimensionesValores, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                } else {
                    $valorTarifaOriginal = (float) $lineaTarifa->precio_original;
                    $valorTarifaDistribuidor = (float) $lineaTarifa->precio_distribuidor;
                    $porcentajeAgencia = (float) $lineaTarifa->porcentaje_agencia;
                    $diferencia = (float) $op->valor_cliente - $valorTarifaOriginal;

                    if ($estadoBase === 'ok') {
                        $tolerancia = 0.02;
                        $pctDif = $valorTarifaOriginal > 0
                            ? abs($diferencia) / $valorTarifaOriginal
                            : ($diferencia !== 0.0 ? 1.0 : 0.0);
                        $estadoBase = $pctDif <= $tolerancia ? 'ok' : 'diferencia';
                    }
                }
            }
        } else {
            if ($estadoBase === 'ok') {
                $estadoBase = 'sin_tarifa';
            }
            $observacion = 'Fila sin concepto.';
        }

        $op->update([
            'linea_tarifa_id' => $lineaTarifa?->id,
            'valor_tarifa_original' => $valorTarifaOriginal,
            'valor_tarifa_distribuidor' => $valorTarifaDistribuidor,
            'porcentaje_agencia' => $porcentajeAgencia,
            'diferencia_cliente' => $diferencia,
            'estado' => $estadoBase,
            'observacion' => $observacion,
        ]);
    }

    private function resolverCelda(array $row, array $headers, array $posiblesNombres): ?string
    {
        foreach ($posiblesNombres as $nombre) {
            $idx = array_search($nombre, $headers, true);
            if ($idx !== false && isset($row[$idx])) {
                $val = trim((string) $row[$idx]);
                if ($val !== '') {
                    return $val;
                }
            }
        }

        return null;
    }

    private function buildHeaderAliases(array $columnAliases, string $field, array $default): array
    {
        $aliases = $columnAliases[$field] ?? null;
        if (is_string($aliases)) {
            $aliases = [$aliases];
        }
        if (! is_array($aliases)) {
            $aliases = [];
        }

        $aliases = array_values(array_filter(array_map(function ($v) {
            if (! is_string($v)) {
                return null;
            }
            $trimmed = strtolower(trim($v));
            return $trimmed !== '' ? preg_replace('/[^a-z0-9]/', '', $trimmed) : null;
        }, $aliases)));

        return array_values(array_unique([...$aliases, ...$default]));
    }

    /**
     * Parsea un valor numérico que puede venir como número crudo ("79451.00"),
     * con formato inglés ("79,451.00"), o con formato argentino ("$ 79.451,00").
     */
    private function parseDecimal(?string $raw): float
    {
        if ($raw === null || $raw === '') {
            return 0.0;
        }

        // Si ya es numérico directo ("79451" o "79451.50"), retornar inmediatamente
        if (is_numeric($raw)) {
            return (float) $raw;
        }

        // Quitar símbolo $, espacios y caracteres no numéricos excepto puntos y comas
        $clean = preg_replace('/[^0-9.,\-]/', '', $raw);

        if ($clean === '' || $clean === '-') {
            return 0.0;
        }

        // Detectar formato argentino: miles con punto, decimal con coma (ej: 79.451,00)
        // vs formato inglés: miles con coma, decimal con punto (ej: 79,451.00)
        $ultimaComa  = strrpos($clean, ',');
        $ultimoPunto = strrpos($clean, '.');

        if ($ultimaComa !== false && $ultimoPunto !== false) {
            if ($ultimaComa > $ultimoPunto) {
                // Formato argentino: 79.451,00 → quitar puntos, coma→punto
                $clean = str_replace('.', '', $clean);
                $clean = str_replace(',', '.', $clean);
            } else {
                // Formato inglés: 79,451.00 → quitar comas
                $clean = str_replace(',', '', $clean);
            }
        } elseif ($ultimaComa !== false) {
            // Solo coma: puede ser decimal argentino (79451,00) o miles inglés (79,451)
            // Si hay exactamente 2 dígitos tras la coma, es decimal
            $partes = explode(',', $clean);
            if (count($partes) === 2 && strlen(end($partes)) === 2) {
                $clean = str_replace(',', '.', $clean);
            } else {
                $clean = str_replace(',', '', $clean);
            }
        }
        // Si solo tiene puntos, es número estándar o miles (ej: 79.451) — se deja como está

        return is_numeric($clean) ? (float) $clean : 0.0;
    }

    private function parseXlsxRows(string $path, ?string $sheetName = null): array
    {
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            return [];
        }

        try {
            $sharedStrings = $this->readSharedStrings($zip);
            $sheetXml = $this->readSheetXml($zip, $sheetName);
            if (! is_string($sheetXml)) {
                return [];
            }

            return $this->extractRows($sheetXml, $sharedStrings);
        } finally {
            $zip->close();
        }
    }

    private function readSharedStrings(ZipArchive $zip): array
    {
        $xml = $zip->getFromName('xl/sharedStrings.xml');
        if (! is_string($xml)) {
            return [];
        }

        $dom = @simplexml_load_string($xml);
        if (! $dom) {
            return [];
        }

        $dom->registerXPathNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
        $values = [];
        foreach ($dom->xpath('//x:si') ?: [] as $node) {
            $domNode = dom_import_simplexml($node);
            $values[] = $domNode ? trim((string) $domNode->textContent) : trim((string) $node);
        }

        return $values;
    }

    private function readSheetXml(ZipArchive $zip, ?string $sheetName): ?string
    {
        $candidates = [];
        if (is_string($sheetName) && trim($sheetName) !== '') {
            $candidates[] = trim($sheetName);
        } else {
            $candidates[] = 'Detalle';
        }

        foreach ($candidates as $name) {
            $xml = $this->sheetXmlByName($zip, $name);
            if (is_string($xml)) {
                return $xml;
            }
        }

        $fallback = $zip->getFromName('xl/worksheets/sheet1.xml');

        return is_string($fallback) ? $fallback : null;
    }

    private function sheetXmlByName(ZipArchive $zip, string $desiredName): ?string
    {
        $workbookXml = $zip->getFromName('xl/workbook.xml');
        $relsXml = $zip->getFromName('xl/_rels/workbook.xml.rels');
        if (! is_string($workbookXml) || ! is_string($relsXml)) {
            return null;
        }

        $workbook = @simplexml_load_string($workbookXml);
        $rels = @simplexml_load_string($relsXml);
        if (! $workbook || ! $rels) {
            return null;
        }

        $workbook->registerXPathNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
        $sheets = $workbook->xpath('//x:sheets/x:sheet') ?: [];

        $toLower = function (string $value): string {
            $trimmed = trim($value);
            return function_exists('mb_strtolower') ? mb_strtolower($trimmed) : strtolower($trimmed);
        };

        $desiredLower = $toLower($desiredName);
        $relId = null;

        foreach ($sheets as $sheet) {
            $name = (string) ($sheet['name'] ?? '');
            if ($toLower($name) !== $desiredLower) {
                continue;
            }

            $attrs = $sheet->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships');
            $relId = $attrs ? (string) ($attrs['id'] ?? '') : null;
            break;
        }

        if (! $relId) {
            return null;
        }

        $rels->registerXPathNamespace('r', 'http://schemas.openxmlformats.org/package/2006/relationships');
        $relsNodes = $rels->xpath("//r:Relationship[@Id='{$relId}']") ?: [];
        $target = (string) ($relsNodes[0]['Target'] ?? '');
        if ($target === '') {
            return null;
        }

        $path = 'xl/' . ltrim($target, '/');
        $sheetXml = $zip->getFromName($path);

        return is_string($sheetXml) ? $sheetXml : null;
    }

    private function extractRows(string $sheetXml, array $sharedStrings): array
    {
        $dom = @simplexml_load_string($sheetXml);
        if (! $dom) {
            return [];
        }

        $dom->registerXPathNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
        $rows = [];

        foreach ($dom->xpath('//x:sheetData/x:row') ?: [] as $rowNode) {
            $cells     = [];
            $maxIndex  = -1;

            foreach ($rowNode->c ?? [] as $cellNode) {
                $ref   = (string) ($cellNode['r'] ?? '');
                $col   = $this->colIndex($ref);
                $type  = (string) ($cellNode['t'] ?? '');
                $raw   = isset($cellNode->v) ? trim((string) $cellNode->v) : '';
                $value = $type === 's' ? ($sharedStrings[(int) $raw] ?? '') : $raw;

                $cells[$col] = $value;
                $maxIndex    = max($maxIndex, $col);
            }

            if ($maxIndex < 0) {
                continue;
            }

            $row = [];
            for ($i = 0; $i <= $maxIndex; $i++) {
                $row[] = $cells[$i] ?? '';
            }

            $rows[] = $row;
        }

        return $rows;
    }

    private function colIndex(string $ref): int
    {
        preg_match('/^[A-Z]+/i', $ref, $m);
        $letters = strtoupper($m[0] ?? 'A');
        $idx     = 0;
        foreach (str_split($letters) as $l) {
            $idx = $idx * 26 + (ord($l) - 64);
        }

        return max(0, $idx - 1);
    }

    private function authorize(Request $request): void
    {
        $user  = $request->user();
        $role  = strtolower(trim((string) ($user?->role ?? '')));
        $perms = is_array($user?->permissions) ? $user->permissions : [];

        $allowed = in_array($role, ['admin', 'admin2', 'encargado'], true)
            || in_array('liquidaciones', $perms, true);

        if (! $allowed) {
            abort(response()->json(['message' => 'Sin permisos para liquidaciones.'], 403));
        }
    }
}

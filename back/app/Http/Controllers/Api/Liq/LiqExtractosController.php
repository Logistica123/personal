<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqCliente;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqArchivoEntrada;
use App\Models\LiqOperacion;
use App\Models\LiqLiquidacionDistribuidor;
use App\Models\LiqConfiguracionGastos;
use App\Models\LiqEstadoCuentaCliente;
use App\Services\Liq\LiqIngestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class LiqExtractosController extends Controller
{
    private const BASE_UPLOAD_TYPES = ['DATA_CLIENTE', 'DETALLE_SUCURSAL'];
    private const SUPPORTED_UPLOAD_TYPES = ['DATA_CLIENTE', 'DETALLE_SUCURSAL', 'TARIFARIO', 'BASE_DISTRIB', 'VARIABLES'];

    public function __construct(
        private readonly LiqIngestService $ingestService,
    ) {}

    // GET /liq/liquidaciones - list all liquidaciones cliente
    public function index(Request $request): JsonResponse
    {
        $query = LiqLiquidacionCliente::with('cliente:id,nombre_corto,razon_social')
            ->withCount('archivosEntrada')
            ->orderBy('periodo_desde', 'desc');
        if ($request->filled('cliente_id')) {
            $query->where('cliente_id', $request->integer('cliente_id'));
        }
        if ($request->filled('estado')) {
            $query->where('estado', $request->string('estado'));
        }
        $liquidaciones = $query->paginate(20);
        return response()->json(['data' => $liquidaciones]);
    }

    // POST /liq/liquidaciones - create a new liquidacion header
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cliente_id' => 'required|exists:liq_clientes,id',
            'periodo_desde' => 'required|date',
            'periodo_hasta' => 'required|date|after_or_equal:periodo_desde',
            'archivo_origen' => 'nullable|string|max:255',
            'sucursal_tarifa' => 'nullable|string|max:255',
        ]);
        $liquidacion = LiqLiquidacionCliente::create([
            'cliente_id' => $data['cliente_id'],
            'periodo_desde' => $data['periodo_desde'],
            'periodo_hasta' => $data['periodo_hasta'],
            'fecha_carga' => now(),
            'usuario_carga' => $request->user()?->id,
            'estado' => LiqLiquidacionCliente::ESTADO_PENDIENTE,
            'archivo_origen' => $data['archivo_origen'] ?? null,
            'sucursal_tarifa' => $data['sucursal_tarifa'] ?? null,
        ]);
        return response()->json(['data' => $liquidacion, 'message' => 'Liquidación creada'], 201);
    }

    // POST /liq/liquidaciones/upload - upload Excel file and process
    public function upload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'liquidacion_cliente_id' => 'required|exists:liq_liquidaciones_cliente,id',
            'archivo' => 'required|file|mimes:xlsx,xls,pdf',
            'sucursal' => 'nullable|string|max:255',
            'sucursal_tarifa' => 'nullable|string|max:255',
            'tipo_archivo' => 'nullable|string|max:80',
        ]);

        $liquidacion = LiqLiquidacionCliente::with('cliente')->findOrFail($data['liquidacion_cliente_id']);
        $allowedTipos = $this->allowedUploadTypesForCliente($liquidacion->cliente);
        $tipoArchivo = strtoupper(trim((string) ($data['tipo_archivo'] ?? 'DATA_CLIENTE')));
        if (! in_array($tipoArchivo, $allowedTipos, true)) {
            return response()->json([
                'error' => 'Tipo de archivo no permitido para este cliente. Permitidos: ' . implode(', ', $allowedTipos),
            ], 422);
        }
        $file = $request->file('archivo');

        $disk = 'local';
        $nombreOriginal = $file->getClientOriginalName();
        $nombreInterno = (string) Str::uuid() . '.' . $file->getClientOriginalExtension();
        $dir = "liq/{$liquidacion->cliente_id}/archivos";
        $rutaStorage = $file->storeAs($dir, $nombreInterno, $disk);

        $archivo = LiqArchivoEntrada::create([
            'liquidacion_cliente_id' => $liquidacion->id,
            'tipo_archivo' => $tipoArchivo,
            'nombre_original' => $nombreOriginal,
            'nombre_interno' => $nombreInterno,
            'disk' => $disk,
            'ruta_storage' => $rutaStorage,
            'tamano' => (int) ($file->getSize() ?? 0),
            'sucursal' => $data['sucursal'] ?? ($data['sucursal_tarifa'] ?? null),
        ]);

        try {
            $result = $this->ingestService->procesarArchivo($archivo, $liquidacion);
            return response()->json(['data' => $result, 'message' => 'Archivo procesado correctamente'], 201);
        } catch (\Throwable $e) {
            // No hay columnas de estado/error en esta tabla; dejamos el registro creado y devolvemos el error.
            return response()->json(['error' => 'Error al procesar el archivo: ' . $e->getMessage()], 422);
        }
    }

    // GET /liq/liquidaciones/{liquidacionCliente} - detail with summary
    public function show(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $liquidacionCliente->load(['cliente:id,nombre_corto,razon_social', 'archivosEntrada', 'usuarioCarga:id,name,email']);
        $estadosCounts = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->selectRaw('estado, COUNT(*) as total')
            ->groupBy('estado')
            ->pluck('total', 'estado');
        return response()->json([
            'data' => $liquidacionCliente,
            'estados' => $estadosCounts,
        ]);
    }

    // DELETE /liq/liquidaciones/{liquidacionCliente} - elimina cabecera + archivos + operaciones (y binarios best-effort)
    public function destroy(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (! in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['message' => 'No tenés permisos para eliminar liquidaciones.'], 403);
        }

        $archivos = LiqArchivoEntrada::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->get(['disk', 'ruta_storage']);
        $pdfs = LiqLiquidacionDistribuidor::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->whereNotNull('pdf_path')
            ->pluck('pdf_path')
            ->all();

        DB::beginTransaction();
        try {
            $liquidacionCliente->delete(); // cascades: archivos, operaciones, liquidaciones distribuidor
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'No se pudo eliminar la liquidación: ' . $e->getMessage()], 500);
        }

        // Best-effort: borrar binarios asociados
        foreach ($archivos as $a) {
            $disk = $a->disk ?: 'local';
            $path = $a->ruta_storage;
            if (! $path) continue;
            try {
                Storage::disk($disk)->delete($path);
            } catch (\Throwable $e) {
                // no bloqueante
            }
        }
        foreach ($pdfs as $pdfPath) {
            if (! is_string($pdfPath) || trim($pdfPath) === '') continue;
            $candidate = trim($pdfPath);
            // Normalizar paths tipo "storage/xxx.pdf"
            $candidate = preg_replace('#^/?storage/#', '', $candidate) ?? $candidate;
            try {
                Storage::disk('local')->delete($candidate);
            } catch (\Throwable $e) {
                // no bloqueante
            }
        }

        return response()->json(['message' => 'Liquidación eliminada']);
    }

    // GET /liq/liquidaciones/{liquidacionCliente}/operaciones - list operations with filters
    public function operaciones(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $query = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->with(['distribuidor:id,apellidos,nombres,patente,fecha_alta,fecha_baja', 'lineaTarifa:id,dimensiones_valores,precio_original,precio_distribuidor,porcentaje_agencia']);
        if ($request->filled('estado')) {
            $query->where('estado', $request->string('estado'));
        }
        if ($request->filled('distribuidor_id')) {
            $query->where('distribuidor_id', $request->integer('distribuidor_id'));
        }
        if ($request->filled('dominio')) {
            $query->where('dominio', 'like', '%' . $request->string('dominio') . '%');
        }
        $operaciones = $query->orderBy('id')->paginate(50);
        return response()->json(['data' => $operaciones]);
    }

    // DELETE /liq/liquidaciones/{liquidacionCliente}/operaciones - purge all operations (keeps headers + files)
    public function destroyOperaciones(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (! in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['message' => 'No tenés permisos para eliminar operaciones.'], 403);
        }

        DB::beginTransaction();
        try {
            LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)->delete();
            LiqLiquidacionDistribuidor::where('liquidacion_cliente_id', $liquidacionCliente->id)->delete();

            $liquidacionCliente->update([
                'total_operaciones' => 0,
                'total_importe_cliente' => 0,
                'total_importe_correcto' => 0,
                'total_diferencia' => 0,
                'estado' => LiqLiquidacionCliente::ESTADO_PENDIENTE,
            ]);

            DB::commit();
            return response()->json(['message' => 'Operaciones eliminadas']);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'No se pudieron eliminar las operaciones: ' . $e->getMessage()], 500);
        }
    }

    // POST /liq/liquidaciones/{liquidacionCliente}/generar - generate distributor liquidations
    public function generarLiquidaciones(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        if (!in_array($liquidacionCliente->estado, [LiqLiquidacionCliente::ESTADO_AUDITADA, LiqLiquidacionCliente::ESTADO_PENDIENTE, LiqLiquidacionCliente::ESTADO_EN_PROCESO], true)) {
            return response()->json(['error' => 'Solo se pueden generar liquidaciones en estado auditada, pendiente o en proceso'], 422);
        }

        DB::beginTransaction();
        try {
            // Delete existing generated distributor liquidations for this liquidacion
            LiqLiquidacionDistribuidor::where('liquidacion_cliente_id', $liquidacionCliente->id)->delete();

            // Get gas config for the period
            $gasto = LiqConfiguracionGastos::where('cliente_id', $liquidacionCliente->cliente_id)
                ->where('activo', true)
                ->where('vigencia_desde', '<=', $liquidacionCliente->periodo_hasta)
                ->where(function ($q) use ($liquidacionCliente) {
                    $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $liquidacionCliente->periodo_desde);
                })
                ->first();

            // Group valid operations by distribuidor
            $operaciones = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
                ->whereIn('estado', ['ok', 'diferencia'])
                ->where('excluida', false)
                ->whereNotNull('distribuidor_id')
                ->get();

            $porDistribuidor = $operaciones->groupBy('distribuidor_id');
            $created = [];

            foreach ($porDistribuidor as $distribuidorId => $ops) {
                $subtotal = $ops->sum(fn($op) => (float) $op->valor_tarifa_distribuidor);
                $montoGasto = $this->resolveGastoAmount($gasto, (float) $subtotal);
                $total = $subtotal - $montoGasto;

                $liqDist = LiqLiquidacionDistribuidor::create([
                    'liquidacion_cliente_id' => $liquidacionCliente->id,
                    'distribuidor_id' => $distribuidorId,
                    'periodo_desde' => $liquidacionCliente->periodo_desde,
                    'periodo_hasta' => $liquidacionCliente->periodo_hasta,
                    'fecha_generacion' => now(),
                    'cantidad_operaciones' => $ops->count(),
                    'subtotal' => round($subtotal, 2),
                    'gastos_administrativos' => round($montoGasto, 2),
                    'total_a_pagar' => round($total, 2),
                    'estado' => LiqLiquidacionDistribuidor::ESTADO_GENERADA,
                ]);
                $created[] = $liqDist->id;
            }

            // Crear filas automaticas en Estado de Cuenta por sucursal (cara cliente)
            LiqEstadoCuentaCliente::where('liquidacion_cliente_id', $liquidacionCliente->id)->delete();
            $estadoCuentaIds = LiqEstadoCuentaController::crearFilasDesdeOperaciones(
                $liquidacionCliente->id,
                $liquidacionCliente->cliente_id,
                $liquidacionCliente->periodo_desde->format('Y-m-d'),
                $liquidacionCliente->periodo_hasta->format('Y-m-d'),
                $request->user()?->id
            );

            $liquidacionCliente->update(['estado' => LiqLiquidacionCliente::ESTADO_AUDITADA]);
            DB::commit();

            return response()->json([
                'data' => [
                    'liquidaciones_generadas' => count($created),
                    'ids' => $created,
                    'estado_cuenta_generadas' => count($estadoCuentaIds),
                    'estado_cuenta_ids' => $estadoCuentaIds,
                ],
                'message' => count($created) . ' liquidaciones de distribuidores generadas, ' . count($estadoCuentaIds) . ' filas de estado de cuenta creadas'
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'Error al generar liquidaciones: ' . $e->getMessage()], 500);
        }
    }

    // GET /liq/liquidaciones/{liquidacionCliente}/distribuidores - list distributor liquidations
    public function distribuidores(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $liqDist = LiqLiquidacionDistribuidor::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->with('distribuidor:id,apellidos,nombres,patente,cbu_alias,fecha_alta,fecha_baja')
            ->orderBy('total_a_pagar', 'desc')
            ->get();
        return response()->json(['data' => $liqDist]);
    }

    // GET /liq/liquidaciones/{liquidacionCliente}/auditoria - full audit report
    public function auditoria(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $liqId = $liquidacionCliente->id;

        // ── 1. Resumen por estado ─────────────────────────────────────────────
        $countsPorEstado = LiqOperacion::where('liquidacion_cliente_id', $liqId)
            ->selectRaw('estado, COUNT(*) as cantidad, SUM(valor_cliente) as total_cliente, SUM(valor_tarifa_original) as total_correcto, SUM(diferencia_cliente) as total_diferencia')
            ->groupBy('estado')
            ->get()
            ->keyBy('estado');

        $resumen = [
            'total_operaciones'     => LiqOperacion::where('liquidacion_cliente_id', $liqId)->count(),
            'estados'               => $countsPorEstado,
            'total_importe_cliente' => (float) ($liquidacionCliente->total_importe_cliente ?? 0),
            'total_diferencia'      => (float) ($liquidacionCliente->total_diferencia ?? 0),
        ];

        // Margen: sólo sobre operaciones válidas (ok + diferencia, no excluidas)
        $margenData = LiqOperacion::where('liquidacion_cliente_id', $liqId)
            ->whereIn('estado', ['ok', 'diferencia'])
            ->where('excluida', false)
            ->selectRaw('SUM(valor_tarifa_original) as sum_original, SUM(valor_tarifa_distribuidor) as sum_distribuidor')
            ->first();
        $resumen['total_margen_agencia'] = round(
            (float) ($margenData->sum_original ?? 0) - (float) ($margenData->sum_distribuidor ?? 0),
            2
        );
        $resumen['total_importe_distribuidor'] = round((float) ($margenData->sum_distribuidor ?? 0), 2);

        // ── 2. Operaciones con diferencia (fuera de tolerancia) ───────────────
        $diferencias = LiqOperacion::where('liquidacion_cliente_id', $liqId)
            ->where('estado', 'diferencia')
            ->with('distribuidor:id,apellidos,nombres,patente,fecha_alta,fecha_baja')
            ->orderByRaw('ABS(diferencia_cliente) DESC')
            ->limit(200)
            ->get(['id', 'dominio', 'concepto', 'sucursal_tarifa', 'valor_cliente', 'valor_tarifa_original', 'diferencia_cliente', 'distribuidor_id', 'campos_originales']);

        // ── 3. Sin tarifa ─────────────────────────────────────────────────────
        $sinTarifa = LiqOperacion::where('liquidacion_cliente_id', $liqId)
            ->where('estado', 'sin_tarifa')
            ->orderBy('concepto')
            ->limit(200)
            ->get(['id', 'dominio', 'concepto', 'sucursal_tarifa', 'valor_cliente', 'dimension_fallida', 'campos_originales']);

        // Agrupar sin_tarifa por concepto único para facilitar mapeo
        $sinTarifaAgrupado = $sinTarifa->groupBy('concepto')
            ->map(fn($ops) => [
                'concepto'         => $ops->first()->concepto,
                'dimension_fallida' => $ops->first()->dimension_fallida,
                'sucursal_tarifa'  => $ops->first()->sucursal_tarifa,
                'cantidad'         => $ops->count(),
                'total_cliente'    => round($ops->sum(fn($o) => (float) $o->valor_cliente), 2),
            ])
            ->values();

        // ── 4. Sin distribuidor ───────────────────────────────────────────────
        $sinDistribuidor = LiqOperacion::where('liquidacion_cliente_id', $liqId)
            ->where('estado', 'sin_distribuidor')
            ->orderBy('dominio')
            ->limit(200)
            ->get(['id', 'dominio', 'concepto', 'sucursal_tarifa', 'valor_cliente']);

        $sinDistribuidorAgrupado = $sinDistribuidor->groupBy('dominio')
            ->map(fn($ops) => [
                'dominio'       => $ops->first()->dominio,
                'cantidad'      => $ops->count(),
                'total_cliente' => round($ops->sum(fn($o) => (float) $o->valor_cliente), 2),
            ])
            ->values();

        // ── 5. Duplicados ─────────────────────────────────────────────────────
        $duplicados = LiqOperacion::where('liquidacion_cliente_id', $liqId)
            ->where('estado', 'duplicado')
            ->with('distribuidor:id,apellidos,nombres,patente,fecha_alta,fecha_baja')
            ->limit(100)
            ->get(['id', 'dominio', 'concepto', 'valor_cliente', 'distribuidor_id', 'campos_originales']);

        // ── 6. Resumen por distribuidor ───────────────────────────────────────
        $porDistribuidor = LiqOperacion::where('liquidacion_cliente_id', $liqId)
            ->whereIn('estado', ['ok', 'diferencia'])
            ->where('excluida', false)
            ->whereNotNull('distribuidor_id')
            ->selectRaw('
                distribuidor_id,
                COUNT(*) as cantidad,
                SUM(valor_cliente) as total_cliente,
                SUM(valor_tarifa_original) as total_correcto,
                SUM(valor_tarifa_distribuidor) as total_distribuidor,
                SUM(diferencia_cliente) as total_diferencia
            ')
            ->groupBy('distribuidor_id')
            ->with('distribuidor:id,apellidos,nombres,patente,fecha_alta,fecha_baja')
            ->orderByRaw('SUM(valor_tarifa_distribuidor) DESC')
            ->get()
            ->map(fn($row) => [
                'distribuidor_id'    => $row->distribuidor_id,
                'nombre'             => $row->distribuidor ? trim($row->distribuidor->apellidos . ', ' . $row->distribuidor->nombres) : "ID {$row->distribuidor_id}",
                'patente'            => $row->distribuidor?->patente ?? '—',
                'fecha_alta'         => $row->distribuidor?->fecha_alta,
                'fecha_baja'         => $row->distribuidor?->fecha_baja,
                'cantidad'           => (int) $row->cantidad,
                'total_cliente'      => round((float) $row->total_cliente, 2),
                'total_correcto'     => round((float) $row->total_correcto, 2),
                'total_distribuidor' => round((float) $row->total_distribuidor, 2),
                'total_diferencia'   => round((float) $row->total_diferencia, 2),
                'margen_agencia'     => round((float) $row->total_correcto - (float) $row->total_distribuidor, 2),
            ]);

        // ── 7. Resumen por sucursal ───────────────────────────────────────────
        $porSucursal = LiqOperacion::where('liquidacion_cliente_id', $liqId)
            ->selectRaw('
                sucursal_tarifa,
                estado,
                COUNT(*) as cantidad,
                SUM(valor_cliente) as total_cliente,
                SUM(valor_tarifa_original) as total_correcto,
                SUM(diferencia_cliente) as total_diferencia
            ')
            ->groupBy('sucursal_tarifa', 'estado')
            ->orderBy('sucursal_tarifa')
            ->get()
            ->groupBy('sucursal_tarifa')
            ->map(fn($rows, $sucursal) => [
                'sucursal'        => $sucursal ?? '(sin sucursal)',
                'total'           => (int) $rows->sum('cantidad'),
                'ok'              => (int) ($rows->firstWhere('estado', 'ok')?->cantidad ?? 0),
                'diferencia'      => (int) ($rows->firstWhere('estado', 'diferencia')?->cantidad ?? 0),
                'sin_tarifa'      => (int) ($rows->firstWhere('estado', 'sin_tarifa')?->cantidad ?? 0),
                'sin_distribuidor' => (int) ($rows->firstWhere('estado', 'sin_distribuidor')?->cantidad ?? 0),
                'total_cliente'   => round((float) $rows->sum('total_cliente'), 2),
                'total_correcto'  => round((float) $rows->sum('total_correcto'), 2),
                'total_diferencia' => round((float) $rows->sum('total_diferencia'), 2),
            ])
            ->values();

        return response()->json([
            'data' => [
                'liquidacion'          => $liquidacionCliente->only(['id', 'cliente_id', 'periodo_desde', 'periodo_hasta', 'estado']),
                'resumen'              => $resumen,
                'diferencias'          => $diferencias,
                'sin_tarifa_agrupado'  => $sinTarifaAgrupado,
                'sin_distribuidor_agrupado' => $sinDistribuidorAgrupado,
                'duplicados'           => $duplicados,
                'por_distribuidor'     => $porDistribuidor,
                'por_sucursal'         => $porSucursal,
            ],
        ]);
    }

    // PATCH /liq/liquidaciones/{liquidacionCliente}/estado
    public function cambiarEstado(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $data = $request->validate([
            'estado' => 'required|in:pendiente,en_proceso,auditada,aprobada,rechazada',
            'motivo' => 'nullable|string|max:500',
        ]);

        $transiciones = [
            'pendiente'   => ['en_proceso'],
            'en_proceso'  => ['auditada', 'rechazada'],
            'auditada'    => ['aprobada', 'rechazada', 'en_proceso'],
            'aprobada'    => ['rechazada'],
            'rechazada'   => ['en_proceso'],
        ];

        $actual = $liquidacionCliente->estado;
        $nuevo  = $data['estado'];

        if (! in_array($nuevo, $transiciones[$actual] ?? [], true)) {
            return response()->json([
                'error' => "Transición no permitida: '{$actual}' → '{$nuevo}'"
            ], 422);
        }

        $liquidacionCliente->update(['estado' => $nuevo]);

        return response()->json([
            'data'    => $liquidacionCliente->fresh(['cliente:id,nombre_corto,razon_social']),
            'message' => "Estado actualizado a {$nuevo}",
        ]);
    }

    // GET /liq/liquidaciones/{liquidacionCliente}/origenes-sin-mapear
    public function origenesSinMapear(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $clienteId = $liquidacionCliente->cliente_id;

        // Obtener todos los orígenes únicos de las operaciones sin sucursal
        $sinSucursal = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->whereNull('sucursal_tarifa')
            ->selectRaw("DISTINCT JSON_UNQUOTE(JSON_EXTRACT(campos_originales, '$.origen')) as origen_texto")
            ->pluck('origen_texto')
            ->filter(fn ($v) => $v !== null && $v !== '' && $v !== 'null')
            ->values();

        // También buscar en campos_originales los que tienen sucursal pero el origen no está mapeado
        $todosOrigenes = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->selectRaw("DISTINCT JSON_UNQUOTE(JSON_EXTRACT(campos_originales, '$.origen')) as origen_texto")
            ->pluck('origen_texto')
            ->filter(fn ($v) => $v !== null && $v !== '' && $v !== 'null')
            ->unique()
            ->values();

        // Verificar cuáles tienen mapeo
        $mapeados = \App\Models\LiqMapeoSucursal::where('cliente_id', $clienteId)
            ->where('activo', true)
            ->pluck('patron_archivo')
            ->map(fn ($p) => strtolower(trim($p)))
            ->toArray();

        $sinMapear = $todosOrigenes->filter(function ($origen) use ($mapeados) {
            $origenLower = strtolower(trim($origen));
            foreach ($mapeados as $m) {
                if ($origenLower === $m || str_contains($origenLower, $m) || str_contains($m, $origenLower)) {
                    return false;
                }
            }
            return true;
        })->values();

        return response()->json([
            'data' => $sinMapear,
            'total_origenes' => $todosOrigenes->count(),
            'sin_mapear' => $sinMapear->count(),
        ]);
    }

    // POST /liq/liquidaciones/{liquidacionCliente}/mapear-tarifa — GENÉRICO (Loginter + OCA + futuros)
    public function mapearTarifa(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $data = $request->validate([
            'operacion_id' => 'nullable|integer',
            'patente' => 'required|string|max:20',
            'persona_id' => 'nullable|integer',
            'sucursal' => 'required|string|max:50',
            'concepto' => 'required|string|max:200',
            'valor_cliente' => 'required|numeric|min:0',
            'modo_calculo' => 'required|in:fijo,porcentaje',
            'valor_referencia' => 'required|numeric|min:0',
            'dimension_destino' => 'nullable|string',
        ]);

        $clienteId = $liquidacionCliente->cliente_id;

        // Paso 2: esquema activo
        $esquema = \App\Models\LiqEsquemaTarifario::where('cliente_id', $clienteId)
            ->where('activo', true)->first();
        if (!$esquema) {
            return response()->json(['error' => 'No hay esquema tarifario activo para este cliente'], 422);
        }

        $sucursal = trim($data['sucursal']);
        $concepto = trim($data['concepto']);
        $valorCliente = (float) $data['valor_cliente'];
        $patenteNorm = strtoupper(preg_replace('/[^A-Z0-9]/', '', strtoupper($data['patente'])));

        // Calcular precio distribuidor y porcentaje
        if ($data['modo_calculo'] === 'fijo') {
            $precioDistribuidor = (float) $data['valor_referencia'];
            $pctAgencia = $valorCliente > 0 ? round((1 - $precioDistribuidor / $valorCliente) * 100, 4) : 0;
        } else {
            $pctAgencia = (float) $data['valor_referencia'];
            $precioDistribuidor = round($valorCliente * (1 - $pctAgencia / 100), 2);
        }

        DB::beginTransaction();
        try {
            // Paso 3: buscar o crear línea de tarifa
            $dimValues = ['sucursal' => $sucursal, 'concepto' => $concepto];
            $lineaTarifa = \App\Models\LiqLineaTarifa::where('esquema_id', $esquema->id)
                ->where('activo', true)
                ->where('dimensiones_valores->sucursal', $sucursal)
                ->where('dimensiones_valores->concepto', $concepto)
                ->first();

            if ($lineaTarifa) {
                $lineaTarifa->update([
                    'precio_original' => $valorCliente,
                    'porcentaje_agencia' => $pctAgencia,
                    'precio_distribuidor' => $precioDistribuidor,
                ]);
            } else {
                $lineaTarifa = \App\Models\LiqLineaTarifa::create([
                    'esquema_id' => $esquema->id,
                    'dimensiones_valores' => $dimValues,
                    'precio_original' => $valorCliente,
                    'porcentaje_agencia' => $pctAgencia,
                    'precio_distribuidor' => $precioDistribuidor,
                    'vigencia_desde' => $liquidacionCliente->periodo_desde,
                    'vigencia_hasta' => null,
                    'creado_por' => $request->user()?->id,
                    'aprobado_por' => $request->user()?->id,
                    'fecha_aprobacion' => now(),
                    'activo' => true,
                ]);

                // Auto-crear dimension values si no existen
                foreach ($dimValues as $dim => $val) {
                    \App\Models\LiqDimensionValor::firstOrCreate(
                        ['esquema_id' => $esquema->id, 'nombre_dimension' => $dim, 'valor' => $val],
                        ['orden_display' => 0, 'activo' => true]
                    );
                }
            }

            // Paso 4: UPSERT tarifa por patente
            $tarifaData = [
                'esquema_id' => $esquema->id,
                'linea_tarifa_id' => $lineaTarifa->id,
                'modo_calculo' => $data['modo_calculo'],
                'valor_referencia' => $data['valor_referencia'],
                'precio_original' => $valorCliente,
                'activo' => true,
                'creado_por' => $request->user()?->id,
                'vigencia_desde' => $liquidacionCliente->periodo_desde,
            ];

            // Buscar por liq_cliente_id + patente si la columna existe
            $tarifaPatente = \App\Models\LiqTarifaPatente::where('esquema_id', $esquema->id)
                ->where('patente_norm', $patenteNorm)
                ->where(function ($q) use ($clienteId) {
                    $q->where('liq_cliente_id', $clienteId)->orWhereNull('liq_cliente_id');
                })
                ->first();

            if ($tarifaPatente) {
                $tarifaPatente->update(array_merge($tarifaData, ['liq_cliente_id' => $clienteId]));
            } else {
                $tarifaPatente = \App\Models\LiqTarifaPatente::create(array_merge($tarifaData, [
                    'patente_norm' => $patenteNorm,
                    'dimensiones_valores' => $dimValues,
                    'liq_cliente_id' => $clienteId,
                ]));
            }

            // Paso 5: mapeo de concepto
            \App\Models\LiqMapeoConcepto::firstOrCreate(
                ['cliente_id' => $clienteId, 'valor_excel' => $concepto, 'dimension_destino' => $data['dimension_destino'] ?? 'concepto'],
                ['valor_tarifa' => $concepto, 'activo' => true]
            );

            // Paso 6: vincular distribuidor si se indicó persona_id
            if ($data['persona_id']) {
                \App\Models\LiqMapeoDistribuidor::updateOrCreate(
                    ['cliente_id' => $clienteId, 'nombre_pdf' => $patenteNorm, 'sucursal' => null],
                    ['persona_id' => $data['persona_id'], 'creado_por' => $request->user()?->id]
                );
            }

            // Historial
            if (class_exists(\App\Models\LiqHistorialMovimiento::class)) {
                \App\Models\LiqHistorialMovimiento::registrar(
                    'tarifa_mapeada',
                    "Tarifa {$sucursal}/{$concepto}: cliente \${$valorCliente} → distrib \${$precioDistribuidor} ({$data['modo_calculo']})",
                    $request->user()?->id, $liquidacionCliente->id, null, $data['persona_id'] ?? null,
                    ['patente' => $patenteNorm, 'modo' => $data['modo_calculo'], 'valor_ref' => $data['valor_referencia']]
                );
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'tarifa_patente_id' => $tarifaPatente->id,
                'linea_tarifa_id' => $lineaTarifa->id,
                'precio_distribuidor' => $precioDistribuidor,
                'porcentaje_agencia' => $pctAgencia,
                'margen' => round($valorCliente - $precioDistribuidor, 2),
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'Error al guardar tarifa: ' . $e->getMessage()], 500);
        }
    }

    private function allowedUploadTypesForCliente(?LiqCliente $cliente): array
    {
        $cfg = $cliente?->configuracion_excel;
        $extra = [];

        if (is_array($cfg)) {
            $raw = $cfg['allowed_tipos_archivo'] ?? $cfg['tipos_archivo'] ?? [];
            if (is_array($raw)) {
                foreach ($raw as $value) {
                    if (! is_string($value)) {
                        continue;
                    }
                    $candidate = strtoupper(trim($value));
                    if ($candidate !== '' && in_array($candidate, self::SUPPORTED_UPLOAD_TYPES, true)) {
                        $extra[] = $candidate;
                    }
                }
            }
        }

        return array_values(array_unique(array_merge(self::BASE_UPLOAD_TYPES, $extra)));
    }

    private function resolveGastoAmount(?LiqConfiguracionGastos $gasto, float $subtotal): float
    {
        if (! $gasto) {
            return 0.0;
        }

        $monto = (float) $gasto->monto;
        if ($monto <= 0) {
            return 0.0;
        }

        if ($gasto->tipo === 'porcentual') {
            return round($subtotal * ($monto / 100), 2);
        }

        return round($monto, 2);
    }
}

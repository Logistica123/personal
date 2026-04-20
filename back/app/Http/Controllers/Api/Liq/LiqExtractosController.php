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
use App\Models\LiqHistorialAuditoria;
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
            // BUGFIX 22 Addendum A: si es PDF + cliente OCASA, usar OcasaPdfProcessor
            $ext = strtolower((string) $file->getClientOriginalExtension());
            $esOcasa = $this->clienteEsOcasa($liquidacion->cliente);
            if ($ext === 'pdf' && $esOcasa) {
                $ocasaPdfProcessor = app(\App\Services\Liq\OcasaPdfProcessor::class);
                $pdfResult = $ocasaPdfProcessor->procesarArchivo($archivo, $liquidacion);
                return response()->json(['data' => $pdfResult, 'message' => 'PDF OCASA procesado correctamente'], 201);
            }

            $result = $this->ingestService->procesarArchivo($archivo, $liquidacion);
            return response()->json(['data' => $result, 'message' => 'Archivo procesado correctamente'], 201);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Error al procesar el archivo: ' . $e->getMessage()], 422);
        }
    }

    /**
     * Heurística rápida para detectar cliente OCASA.
     * Usa configuracion_excel.formato === 'OCASA' si está disponible, si no por nombre.
     */
    private function clienteEsOcasa(?LiqCliente $cliente): bool
    {
        if (!$cliente) return false;
        $config = is_array($cliente->configuracion_excel) ? $cliente->configuracion_excel : [];
        $formato = strtoupper((string) ($config['formato'] ?? ''));
        if ($formato === 'OCASA') return true;
        $nombre = strtoupper((string) ($cliente->nombre_corto ?? $cliente->razon_social ?? ''));
        return str_contains($nombre, 'OCASA');
    }

    /**
     * POST /liq/liquidaciones/upload-ocasa
     *
     * Endpoint especifico para OCASA: acepta TMS (obligatorio) + YCC1 (opcional) + PDFs (opcionales)
     * en un solo request. Procesa en orden correcto y retorna estadisticas detalladas.
     */
    public function uploadOcasa(Request $request): JsonResponse
    {
        $data = $request->validate([
            'liquidacion_cliente_id' => 'required|exists:liq_liquidaciones_cliente,id',
            'tms_file' => 'required|file|mimes:xlsx,xls',
            'ycc1_file' => 'nullable|file|mimes:xlsx,xls',
            'pdf_files' => 'nullable|array',
            'pdf_files.*' => 'file|mimes:pdf',
        ]);

        $liquidacion = LiqLiquidacionCliente::with('cliente')->findOrFail($data['liquidacion_cliente_id']);
        $config = is_array($liquidacion->cliente?->configuracion_excel) ? $liquidacion->cliente->configuracion_excel : [];
        $disk = 'local';
        $dir = "liq/{$liquidacion->cliente_id}/archivos";

        $esquema = \App\Models\LiqEsquemaTarifario::where('cliente_id', $liquidacion->cliente_id)
            ->where('activo', true)->latest()->first();
        if (!$esquema) {
            return response()->json(['error' => 'No hay un esquema tarifario activo para este cliente'], 422);
        }

        $ocasaProcessor = app(\App\Services\Liq\OcasaExcelProcessor::class);
        $resultados = ['archivos' => [], 'errores' => []];

        // --- 1. Procesar TMS (obligatorio) ---
        $tmsFile = $request->file('tms_file');
        $tmsNombre = (string) Str::uuid() . '.' . $tmsFile->getClientOriginalExtension();
        $tmsRuta = $tmsFile->storeAs($dir, $tmsNombre, $disk);

        $archivoTms = LiqArchivoEntrada::create([
            'liquidacion_cliente_id' => $liquidacion->id,
            'tipo_archivo' => 'DATA_CLIENTE',
            'nombre_original' => $tmsFile->getClientOriginalName(),
            'nombre_interno' => $tmsNombre,
            'disk' => $disk,
            'ruta_storage' => $tmsRuta,
            'tamano' => (int) ($tmsFile->getSize() ?? 0),
        ]);

        try {
            $tmsResult = $ocasaProcessor->procesarTms($archivoTms, $liquidacion, $esquema, $config);
            $resultados['archivos']['tms'] = [
                'estado' => 'ok',
                'nombre' => $tmsFile->getClientOriginalName(),
                'operaciones' => $tmsResult['total_filas'] ?? 0,
                'estados' => $tmsResult['estados'] ?? [],
            ];
        } catch (\Throwable $e) {
            $resultados['archivos']['tms'] = ['estado' => 'error', 'mensaje' => $e->getMessage()];
            $resultados['errores'][] = 'TMS: ' . $e->getMessage();
        }

        // --- 2. Procesar YCC1 (opcional) ---
        if ($request->hasFile('ycc1_file')) {
            $ycc1File = $request->file('ycc1_file');
            $ycc1Nombre = (string) Str::uuid() . '.' . $ycc1File->getClientOriginalExtension();
            $ycc1Ruta = $ycc1File->storeAs($dir, $ycc1Nombre, $disk);

            $archivoYcc1 = LiqArchivoEntrada::create([
                'liquidacion_cliente_id' => $liquidacion->id,
                'tipo_archivo' => 'DETALLE_SUCURSAL',
                'nombre_original' => $ycc1File->getClientOriginalName(),
                'nombre_interno' => $ycc1Nombre,
                'disk' => $disk,
                'ruta_storage' => $ycc1Ruta,
                'tamano' => (int) ($ycc1File->getSize() ?? 0),
            ]);

            try {
                $ycc1Result = $ocasaProcessor->procesarYcc1($archivoYcc1, $liquidacion, $config);
                $resultados['archivos']['ycc1'] = [
                    'estado' => 'ok',
                    'nombre' => $ycc1File->getClientOriginalName(),
                    'filas' => $ycc1Result['total_filas_detalle'] ?? 0,
                    'transportes_vinculados' => $ycc1Result['transportes_vinculados'] ?? 0,
                ];
            } catch (\Throwable $e) {
                $resultados['archivos']['ycc1'] = ['estado' => 'error', 'mensaje' => $e->getMessage()];
                $resultados['errores'][] = 'YCC1: ' . $e->getMessage();
            }
        } else {
            $resultados['archivos']['ycc1'] = ['estado' => 'no_cargado'];
        }

        // --- 3. Procesar PDFs (opcionales) — BUGFIX 22 A: usa OcasaPdfProcessor con microservicio Python ---
        $pdfFiles = $request->file('pdf_files', []);
        if (!empty($pdfFiles)) {
            $ocasaPdfProcessor = app(\App\Services\Liq\OcasaPdfProcessor::class);
            $pdfsOk = 0;
            $opsActualizadas = 0;
            $opsHuerfanas = 0;
            $warningsAll = [];

            foreach ($pdfFiles as $pdfFile) {
                $pdfNombre = (string) Str::uuid() . '.pdf';
                $pdfRuta = $pdfFile->storeAs($dir, $pdfNombre, $disk);

                $archivoPdf = LiqArchivoEntrada::create([
                    'liquidacion_cliente_id' => $liquidacion->id,
                    'tipo_archivo' => 'DATA_CLIENTE',
                    'nombre_original' => $pdfFile->getClientOriginalName(),
                    'nombre_interno' => $pdfNombre,
                    'disk' => $disk,
                    'ruta_storage' => $pdfRuta,
                    'tamano' => (int) ($pdfFile->getSize() ?? 0),
                ]);

                try {
                    $pdfResult = $ocasaPdfProcessor->procesarArchivo($archivoPdf, $liquidacion);
                    $pdfsOk++;
                    $opsActualizadas += $pdfResult['operaciones_actualizadas'] ?? 0;
                    $opsHuerfanas += $pdfResult['operaciones_huerfanas'] ?? 0;
                    if (!empty($pdfResult['warnings'])) {
                        $warningsAll[$pdfFile->getClientOriginalName()] = $pdfResult['warnings'];
                    }
                } catch (\Throwable $e) {
                    $resultados['errores'][] = 'PDF ' . $pdfFile->getClientOriginalName() . ': ' . $e->getMessage();
                }
            }

            $resultados['archivos']['pdfs'] = [
                'estado' => $pdfsOk > 0 ? 'ok' : 'error',
                'facturas' => $pdfsOk,
                'ops_actualizadas' => $opsActualizadas,
                'ops_huerfanas' => $opsHuerfanas,
                'warnings' => $warningsAll ?: null,
            ];
        } else {
            $resultados['archivos']['pdfs'] = ['estado' => 'no_cargado'];
        }

        // --- 4. Estadisticas detalladas ---
        $ops = LiqOperacion::where('liquidacion_cliente_id', $liquidacion->id);

        // Modelos de tarifa
        $modelosCounts = (clone $ops)->whereNotNull('modelo_tarifa')
            ->selectRaw('modelo_tarifa, COUNT(*) as cantidad')
            ->groupBy('modelo_tarifa')
            ->pluck('cantidad', 'modelo_tarifa');
        $totalOps = $modelosCounts->sum();
        $resultados['modelos'] = [];
        foreach (['JORNADA', 'JORNADA_KM', 'PRODUCTIVIDAD'] as $m) {
            $c = (int) ($modelosCounts[$m] ?? 0);
            $resultados['modelos'][$m] = [
                'cantidad' => $c,
                'porcentaje' => $totalOps > 0 ? round($c / $totalOps * 100, 1) : 0,
            ];
        }

        // Fracciones
        $fraccionesCounts = (clone $ops)->whereIn('modelo_tarifa', ['JORNADA', 'JORNADA_KM'])
            ->selectRaw('fraccion_jornada, COUNT(*) as cantidad')
            ->groupBy('fraccion_jornada')
            ->pluck('cantidad', 'fraccion_jornada');
        $totalFrac = $fraccionesCounts->sum();
        $resultados['fracciones'] = [];
        foreach ($fraccionesCounts as $frac => $cnt) {
            $resultados['fracciones'][(string) $frac] = [
                'cantidad' => (int) $cnt,
                'porcentaje' => $totalFrac > 0 ? round((int) $cnt / $totalFrac * 100, 1) : 0,
            ];
        }

        // Vinculacion
        $estadosCounts = (clone $ops)->selectRaw('estado, COUNT(*) as cantidad')
            ->groupBy('estado')->pluck('cantidad', 'estado');
        $distribOk = (clone $ops)->whereNotNull('distribuidor_id')->distinct('distribuidor_id')->count('distribuidor_id');
        $distribTotal = (clone $ops)->selectRaw('COUNT(DISTINCT COALESCE(distribuidor_id, dominio)) as total')->value('total');

        $resultados['vinculacion'] = [
            'distribuidores_ok' => $distribOk,
            'distribuidores_total' => (int) $distribTotal,
            'distribuidores_sin_match' => (int) ($estadosCounts['sin_distribuidor'] ?? 0),
            'ops_con_tarifa' => (int) ($estadosCounts['ok'] ?? 0) + (int) ($estadosCounts['diferencia'] ?? 0),
            'ops_sin_tarifa' => (int) ($estadosCounts['sin_tarifa'] ?? 0),
            'ops_total' => $totalOps,
        ];

        $resultados['estados'] = $estadosCounts;

        return response()->json([
            'data' => $resultados,
            'message' => empty($resultados['errores'])
                ? "OCASA procesado: {$totalOps} operaciones"
                : "OCASA procesado con advertencias: {$totalOps} operaciones",
        ], 201);
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
            ->with(['distribuidor:id,apellidos,nombres,patente,fecha_alta,fecha_baja,estado_id,retener_pago', 'lineaTarifa:id,dimensiones_valores,precio_original,precio_distribuidor,porcentaje_agencia']);
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

        // BUGFIX 25: pagar peajes al distribuidor sólo si el cliente tiene el flag activo.
        //   Para OCASA (flag=false) el split grav/no_grav es puramente fiscal y no se
        //   reembolsa al distribuidor — se omite la validación y el cálculo de peajes.
        $liquidacionCliente->loadMissing('cliente');
        $clientePagaPeajes = (bool) ($liquidacionCliente->cliente?->pagar_peajes_a_distribuidor ?? false);

        // BUGFIX 22 F10: contar peajes pendientes de autorizar como warning (sólo si el cliente paga peajes)
        $peajesPendientes = 0;
        if ($clientePagaPeajes) {
            $peajesPendientes = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
                ->whereIn('estado', ['ok', 'diferencia'])
                ->where('excluida', false)
                ->where('importe_no_gravado', '>', 0)
                ->where('peaje_autorizado', false)
                ->whereNull('peaje_motivo')
                ->count();

            $confirmarSinAutorizar = (bool) $request->input('confirmar_sin_autorizar', false);
            if ($peajesPendientes > 0 && !$confirmarSinAutorizar) {
                return response()->json([
                    'error' => 'peajes_pendientes',
                    'message' => "Hay {$peajesPendientes} operaciones con peajes sin autorizar. Estas no se incluirán en el reembolso.",
                    'peajes_pendientes' => $peajesPendientes,
                    'requiere_confirmacion' => true,
                ], 409);
            }
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

                $distribuidor = \App\Models\Persona::find($distribuidorId);
                // BUGFIX 20 Feature E: flag pago_retenido del distribuidor
                $pagoRetenido = (bool) ($distribuidor?->retener_pago ?? false);

                // BUGFIX 25: subtotal_peajes queda como dato informativo (para la facturación cliente).
                //   total_reembolso_peajes = 0 salvo que el cliente tenga pagar_peajes_a_distribuidor=true
                //   Para OCASA nunca se reembolsa: el imp_no_gravado es clasificación fiscal, no peaje.
                $subtotalPeajes = round($ops->sum(fn($op) => (float) ($op->importe_no_gravado ?? 0)), 2);

                $distribuidorPagaPeajes = $distribuidor?->paga_peajes ?? true;
                $totalReembolsoPeajes = ($clientePagaPeajes && $distribuidorPagaPeajes)
                    ? round($ops->sum(function ($op) {
                        if (!$op->peaje_autorizado) return 0;
                        return (float) ($op->peaje_monto_ajustado ?? $op->importe_no_gravado ?? 0);
                    }), 2)
                    : 0;

                // Beneficio seguro: por ahora manual, campo en liq_liquidaciones_distribuidor
                $beneficioSeguro = 0;

                $total = $subtotal + $totalReembolsoPeajes - $montoGasto - $beneficioSeguro;

                $liqDist = LiqLiquidacionDistribuidor::create([
                    'liquidacion_cliente_id' => $liquidacionCliente->id,
                    'distribuidor_id' => $distribuidorId,
                    'periodo_desde' => $liquidacionCliente->periodo_desde,
                    'periodo_hasta' => $liquidacionCliente->periodo_hasta,
                    'fecha_generacion' => now(),
                    'cantidad_operaciones' => $ops->count(),
                    'subtotal' => round($subtotal, 2),
                    'gastos_administrativos' => round($montoGasto, 2),
                    'subtotal_peajes' => $subtotalPeajes,
                    'total_reembolso_peajes' => $totalReembolsoPeajes,
                    'beneficio_seguro' => $beneficioSeguro,
                    'total_a_pagar' => round($total, 2),
                    'estado' => LiqLiquidacionDistribuidor::ESTADO_GENERADA,
                ]);
                $created[] = $liqDist->id;

                // BUGFIX 24: calcular eficiencia al momento de crear la liquidación distribuidor
                try {
                    app(\App\Services\Liq\LiqEficienciaService::class)->calcular($liqDist);
                } catch (\Throwable $e) {
                    // No bloquear la generación si falla el cálculo — se puede recalcular luego
                    \Log::warning('Eficiencia no calculada para liqDist #' . $liqDist->id . ': ' . $e->getMessage());
                }

                LiqHistorialAuditoria::registrar(
                    'liquidacion_distribuidor', $liqDist->id, 'creacion',
                    null,
                    ['subtotal' => (float) $liqDist->subtotal, 'gastos' => (float) $liqDist->gastos_administrativos, 'total' => (float) $liqDist->total_a_pagar, 'operaciones' => $ops->count()],
                    'Generacion automatica',
                    $request->user(), $request->ip()
                );
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
                    'peajes_pendientes' => $peajesPendientes,
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
            ->with('distribuidor:id,apellidos,nombres,patente,fecha_alta,fecha_baja,estado_id,retener_pago')
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
            ->with('distribuidor:id,apellidos,nombres,patente,fecha_alta,fecha_baja,estado_id,retener_pago')
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
            ->with('distribuidor:id,apellidos,nombres,patente,fecha_alta,fecha_baja,estado_id,retener_pago')
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

    // GET /liq/liquidaciones/{liquidacionCliente}/totales-por-sucursal (BUGFIX 22 B)
    public function totalesPorSucursal(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $totales = \DB::table('liq_liquidacion_sucursal_totales')
            ->where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->orderBy('sucursal')
            ->get();

        $totalGlobal = [
            'total_importe' => 0,
            'total_gravado' => 0,
            'total_no_gravado' => 0,
            'cantidad_operaciones' => 0,
        ];

        foreach ($totales as $t) {
            $totalGlobal['total_importe'] += (float) $t->total_importe;
            $totalGlobal['total_gravado'] += (float) $t->total_gravado;
            $totalGlobal['total_no_gravado'] += (float) $t->total_no_gravado;
            $totalGlobal['cantidad_operaciones'] += (int) $t->cantidad_operaciones;
        }

        return response()->json([
            'data' => [
                'por_sucursal' => $totales,
                'total_global' => $totalGlobal,
            ],
        ]);
    }

    // POST /liq/liquidaciones/{liquidacionCliente}/recalcular-totales-sucursal (BUGFIX 22 B)
    public function recalcularTotalesSucursal(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $processor = app(\App\Services\Liq\OcasaPdfProcessor::class);
        $sucursales = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->whereNotNull('sucursal_tarifa')
            ->distinct()
            ->pluck('sucursal_tarifa');

        foreach ($sucursales as $suc) {
            $processor->recalcularTotalSucursal($liquidacionCliente->id, $suc);
        }

        return response()->json([
            'message' => count($sucursales) . ' sucursales recalculadas',
            'sucursales' => $sucursales->values(),
        ]);
    }

    // GET /liq/facturacion-clientes/{cliente}/periodo/{yyyymm}/resumen-fiscal (BUGFIX 25 Feature 25.3)
    // Devuelve el split Gravado / NoGravado por sucursal para facturar LA → cliente.
    public function resumenFiscalCliente(Request $request, int $clienteId, string $periodo): JsonResponse
    {
        if (!preg_match('/^\d{4}-?\d{2}$/', $periodo)) {
            return response()->json(['error' => 'Formato de período inválido. Usar YYYY-MM o YYYYMM.'], 422);
        }
        $periodo = preg_replace('/[^\d]/', '', $periodo);
        $y = (int) substr($periodo, 0, 4);
        $m = (int) substr($periodo, 4, 2);
        $from = sprintf('%04d-%02d-01', $y, $m);
        $to   = date('Y-m-t', strtotime($from));

        $cliente = LiqCliente::findOrFail($clienteId);

        $ops = LiqOperacion::query()
            ->join('liq_liquidaciones_cliente as lc', 'lc.id', '=', 'liq_operaciones.liquidacion_cliente_id')
            ->where('lc.cliente_id', $clienteId)
            ->whereBetween('lc.periodo_desde', [$from, $to])
            ->whereNotIn('liq_operaciones.estado', ['ignorado', 'anulado', 'excluida'])
            ->selectRaw('
                liq_operaciones.sucursal_tarifa as sucursal,
                COUNT(*) as cantidad,
                COALESCE(SUM(liq_operaciones.valor_cliente), 0)         as total_importe,
                COALESCE(SUM(liq_operaciones.importe_gravado), 0)       as total_gravado,
                COALESCE(SUM(liq_operaciones.importe_no_gravado), 0)    as total_no_gravado
            ')
            ->groupBy('liq_operaciones.sucursal_tarifa')
            ->orderBy('liq_operaciones.sucursal_tarifa')
            ->get();

        $totales = [
            'total_operaciones'   => (int) $ops->sum('cantidad'),
            'total_importe'       => round((float) $ops->sum('total_importe'), 2),
            'total_gravado'       => round((float) $ops->sum('total_gravado'), 2),
            'total_no_gravado'    => round((float) $ops->sum('total_no_gravado'), 2),
        ];

        // Consistencia: gravado + no_gravado debería igualar el importe (tolerancia 1 peso/mes)
        $diff = round($totales['total_importe'] - ($totales['total_gravado'] + $totales['total_no_gravado']), 2);
        $consistente = abs($diff) <= 1.0;

        return response()->json([
            'data' => [
                'cliente'            => $cliente->nombre_corto ?? $cliente->razon_social,
                'cliente_id'         => $cliente->id,
                'periodo'            => sprintf('%04d-%02d', $y, $m),
                'totales'            => $totales,
                'consistente'        => $consistente,
                'diferencia_total'   => $diff,
                'desglose_por_sucursal' => $ops->map(fn ($r) => [
                    'sucursal'     => $r->sucursal,
                    'cantidad'     => (int) $r->cantidad,
                    'importe'      => round((float) $r->total_importe, 2),
                    'gravado'      => round((float) $r->total_gravado, 2),
                    'no_gravado'   => round((float) $r->total_no_gravado, 2),
                ])->values(),
            ],
        ]);
    }

    // POST /liq/liquidaciones-distribuidor/{id}/recalcular-eficiencia (BUGFIX 24 A5)
    public function recalcularEficiencia(LiqLiquidacionDistribuidor $liquidacionDistribuidor): JsonResponse
    {
        try {
            $pct = app(\App\Services\Liq\LiqEficienciaService::class)->calcular($liquidacionDistribuidor);
            return response()->json([
                'message' => 'Eficiencia recalculada',
                'data' => [
                    'eficiencia_pct'     => $pct,
                    'eficiencia_detalle' => $liquidacionDistribuidor->fresh()->eficiencia_detalle,
                    'calculada_at'       => $liquidacionDistribuidor->fresh()->eficiencia_calculada_at,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Error al calcular eficiencia: ' . $e->getMessage()], 500);
        }
    }

    // POST /liq/liquidaciones/{liquidacionCliente}/reparsear-pdfs-ocasa (BUGFIX 22 Addendum A)
    // Reprocesa PDFs existentes vía OcasaPdfProcessor. Útil cuando los PDFs fueron subidos
    // antes de que existiera el trigger automático, o cuando el microservicio Python estaba caído.
    public function reparsearPdfsOcasa(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        // Validar que el cliente sea OCASA antes de invocar al procesador OCASA
        $liquidacionCliente->loadMissing('cliente');
        if (!$this->clienteEsOcasa($liquidacionCliente->cliente)) {
            $nombre = $liquidacionCliente->cliente?->nombre_corto ?? $liquidacionCliente->cliente?->razon_social ?? '?';
            return response()->json([
                'error' => "Esta liquidación es del cliente '{$nombre}', no OCASA. El parser OCASA solo aplica a PDFs del formato OCASA (columnas Id Liquidacion, Transporte, CUIT, Imp.Grav, Imp.NoGrav). Si es OCA usá el flujo de carga OCA con PDF principal + distribuidores.",
            ], 422);
        }

        // Verificar que el microservicio Python esté disponible
        try {
            $ping = \Illuminate\Support\Facades\Http::timeout(3)->get(rtrim((string) config('services.oca.base_url', 'http://localhost:8100'), '/') . '/docs');
            if (!$ping->ok()) {
                return response()->json(['error' => 'Microservicio Python no responde en ' . config('services.oca.base_url', 'http://localhost:8100') . '. Verificá que esté corriendo (uvicorn app.main:app --port 8100).'], 503);
            }
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Microservicio Python no accesible: ' . $e->getMessage()], 503);
        }

        $processor = app(\App\Services\Liq\OcasaPdfProcessor::class);

        $pdfs = LiqArchivoEntrada::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->where(function ($q) {
                $q->where('nombre_original', 'like', '%.pdf')
                  ->orWhere('nombre_interno', 'like', '%.pdf');
            })
            ->get();

        if ($pdfs->isEmpty()) {
            return response()->json([
                'message' => 'No hay PDFs para reparsear en esta liquidación',
                'data' => ['pdfs_total' => 0, 'pdfs_ok' => 0, 'pdfs_error' => 0, 'ops_actualizadas' => 0, 'ops_huerfanas' => 0],
            ]);
        }

        $pdfsOk = 0;
        $pdfsError = 0;
        $opsActualizadas = 0;
        $opsHuerfanas = 0;
        $warnings = [];
        $errores = [];

        foreach ($pdfs as $pdf) {
            try {
                $r = $processor->procesarArchivo($pdf, $liquidacionCliente);
                $pdfsOk++;
                $opsActualizadas += $r['operaciones_actualizadas'] ?? 0;
                $opsHuerfanas += $r['operaciones_huerfanas'] ?? 0;
                if (!empty($r['warnings'])) {
                    $warnings[$pdf->nombre_original] = $r['warnings'];
                }
            } catch (\Throwable $e) {
                $pdfsError++;
                $errores[] = ($pdf->nombre_original ?? '#' . $pdf->id) . ': ' . $e->getMessage();
            }
        }

        return response()->json([
            'message' => "Reparseo: {$pdfsOk}/{$pdfs->count()} PDFs OK, {$opsActualizadas} ops actualizadas",
            'data' => [
                'pdfs_total' => $pdfs->count(),
                'pdfs_ok' => $pdfsOk,
                'pdfs_error' => $pdfsError,
                'ops_actualizadas' => $opsActualizadas,
                'ops_huerfanas' => $opsHuerfanas,
                'warnings' => $warnings ?: null,
                'errores' => $errores ?: null,
            ],
        ]);
    }

    // GET /liq/liquidaciones/{liquidacionCliente}/peajes (BUGFIX 22 F; gateado por BUGFIX 25)
    // Lista peajes agrupados por distribuidor con estado de autorización
    public function peajes(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        // BUGFIX 25: gateado por flag del cliente. Si el cliente no paga peajes, no se habilita el panel.
        $liquidacionCliente->loadMissing('cliente');
        if (!($liquidacionCliente->cliente?->pagar_peajes_a_distribuidor ?? false)) {
            return response()->json([
                'data' => [],
                'disabled' => true,
                'message' => 'Panel de peajes desactivado para este cliente (BUGFIX 25). El split Imp.Gravado/No Gravado sólo se usa para facturación cliente, no para pago a distribuidor.',
            ]);
        }

        // Agrupar operaciones con peajes por distribuidor
        $ops = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->whereNotIn('estado', ['ignorado', 'anulado', 'excluida'])
            ->where('importe_no_gravado', '>', 0)
            ->with('distribuidor:id,apellidos,nombres,patente')
            ->get();

        $porDistrib = [];
        foreach ($ops as $op) {
            if (!$op->distribuidor_id) continue;
            $key = $op->distribuidor_id;
            if (!isset($porDistrib[$key])) {
                $porDistrib[$key] = [
                    'distribuidor_id' => $op->distribuidor_id,
                    'distribuidor' => $op->distribuidor ? "{$op->distribuidor->apellidos} {$op->distribuidor->nombres}" : null,
                    'patente' => $op->distribuidor?->patente,
                    'sucursales' => [],
                    'ops_con_peajes' => 0,
                    'ops_totales' => 0,
                    'total_peajes_pdf' => 0,
                    'total_peajes_autorizado' => 0,
                    'total_tarifa' => 0,
                    'pendientes' => 0,
                    'autorizadas' => 0,
                    'rechazadas' => 0,
                ];
            }
            $porDistrib[$key]['ops_con_peajes']++;
            $porDistrib[$key]['total_peajes_pdf'] += (float) $op->importe_no_gravado;
            $porDistrib[$key]['total_tarifa'] += (float) $op->valor_tarifa_distribuidor;
            $montoEfectivo = $op->peaje_autorizado
                ? ($op->peaje_monto_ajustado ?? (float) $op->importe_no_gravado)
                : 0;
            $porDistrib[$key]['total_peajes_autorizado'] += $montoEfectivo;
            if ($op->peaje_autorizado) {
                $porDistrib[$key]['autorizadas']++;
            } elseif ($op->peaje_motivo) {
                $porDistrib[$key]['rechazadas']++;
            } else {
                $porDistrib[$key]['pendientes']++;
            }
            if ($op->sucursal_tarifa && !in_array($op->sucursal_tarifa, $porDistrib[$key]['sucursales'])) {
                $porDistrib[$key]['sucursales'][] = $op->sucursal_tarifa;
            }
        }

        // Contar ops totales por distribuidor (incluyendo las sin peajes)
        $opsTotalesPorDist = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->whereNotIn('estado', ['ignorado', 'anulado', 'excluida'])
            ->whereNotNull('distribuidor_id')
            ->selectRaw('distribuidor_id, COUNT(*) as total')
            ->groupBy('distribuidor_id')
            ->pluck('total', 'distribuidor_id');

        foreach ($porDistrib as $k => &$d) {
            $d['ops_totales'] = (int) ($opsTotalesPorDist[$k] ?? 0);
            $d['total_peajes_pdf'] = round($d['total_peajes_pdf'], 2);
            $d['total_peajes_autorizado'] = round($d['total_peajes_autorizado'], 2);
            $d['total_tarifa'] = round($d['total_tarifa'], 2);

            if ($d['pendientes'] > 0) $d['estado'] = 'pendiente';
            elseif ($d['autorizadas'] > 0 && $d['rechazadas'] === 0) $d['estado'] = 'autorizado';
            elseif ($d['rechazadas'] > 0 && $d['autorizadas'] === 0) $d['estado'] = 'rechazado';
            else $d['estado'] = 'mixto';
        }
        unset($d);

        return response()->json(['data' => array_values($porDistrib)]);
    }

    // GET /liq/liquidaciones/{liquidacionCliente}/peajes/distribuidor/{distribuidorId}
    public function peajesDistribuidor(LiqLiquidacionCliente $liquidacionCliente, int $distribuidorId): JsonResponse
    {
        $ops = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->where('distribuidor_id', $distribuidorId)
            ->where('importe_no_gravado', '>', 0)
            ->whereNotIn('estado', ['ignorado', 'anulado', 'excluida'])
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $ops->map(fn ($op) => [
                'id' => $op->id,
                'fecha' => $op->campos_originales['fecha'] ?? null,
                'id_operacion_cliente' => $op->id_operacion_cliente,
                'ruta' => $op->campos_originales['ruta'] ?? $op->concepto,
                'importe_total' => (float) $op->valor_cliente,
                'importe_gravado' => (float) $op->importe_gravado,
                'importe_no_gravado' => (float) $op->importe_no_gravado,
                'peaje_autorizado' => (bool) $op->peaje_autorizado,
                'peaje_monto_ajustado' => $op->peaje_monto_ajustado,
                'peaje_motivo' => $op->peaje_motivo,
            ]),
        ]);
    }

    // POST /liq/liquidaciones/{liquidacionCliente}/peajes/autorizar (BUGFIX 22 F; gateado por BUGFIX 25)
    public function autorizarPeajes(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        // BUGFIX 25: no se permite autorizar peajes si el cliente no los paga al distribuidor.
        $liquidacionCliente->loadMissing('cliente');
        if (!($liquidacionCliente->cliente?->pagar_peajes_a_distribuidor ?? false)) {
            return response()->json([
                'error' => 'peajes_desactivados',
                'message' => 'Este cliente no reembolsa peajes al distribuidor. El split grav/no_grav se preserva sólo para facturación cliente.',
            ], 410);
        }

        $data = $request->validate([
            'resoluciones' => 'required|array',
            'resoluciones.*.operacion_id' => 'required|integer',
            'resoluciones.*.accion' => 'required|in:autorizar,rechazar,ajustar',
            'resoluciones.*.monto_ajustado' => 'nullable|numeric|min:0',
            'resoluciones.*.motivo' => 'nullable|string|max:255',
        ]);

        $stats = ['autorizadas' => 0, 'rechazadas' => 0, 'ajustadas' => 0];

        \DB::beginTransaction();
        try {
            foreach ($data['resoluciones'] as $res) {
                $op = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
                    ->find($res['operacion_id']);
                if (!$op) continue;

                switch ($res['accion']) {
                    case 'autorizar':
                        $op->update([
                            'peaje_autorizado' => true,
                            'peaje_monto_ajustado' => null,
                            'peaje_motivo' => $res['motivo'] ?? 'Autorizado',
                        ]);
                        $stats['autorizadas']++;
                        break;
                    case 'rechazar':
                        $op->update([
                            'peaje_autorizado' => false,
                            'peaje_monto_ajustado' => 0,
                            'peaje_motivo' => $res['motivo'] ?? 'Rechazado',
                        ]);
                        $stats['rechazadas']++;
                        break;
                    case 'ajustar':
                        $op->update([
                            'peaje_autorizado' => true,
                            'peaje_monto_ajustado' => $res['monto_ajustado'],
                            'peaje_motivo' => $res['motivo'] ?? 'Ajustado',
                        ]);
                        $stats['ajustadas']++;
                        break;
                }

                // Auditoría
                if (class_exists(\App\Models\LiqHistorialMovimiento::class)) {
                    \App\Models\LiqHistorialMovimiento::registrar(
                        'autorizar_peaje_' . $res['accion'],
                        "Peaje op#{$op->id} — " . ($res['motivo'] ?? $res['accion']),
                        $request->user()?->id, $liquidacionCliente->id, null, $op->distribuidor_id,
                        ['operacion_id' => $op->id, 'accion' => $res['accion'], 'monto_ajustado' => $res['monto_ajustado'] ?? null]
                    );
                }
            }

            \DB::commit();
            return response()->json(['message' => 'Peajes actualizados', 'data' => $stats]);
        } catch (\Throwable $e) {
            \DB::rollBack();
            return response()->json(['error' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // GET /liq/peajes/dashboard (BUGFIX 22 G)
    // Métricas agregadas cross-liquidación con filtros
    public function dashboardPeajes(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'cliente_id'      => 'nullable|integer|exists:liq_clientes,id',
            'distribuidor_id' => 'nullable|integer',
            'desde'           => 'nullable|date',
            'hasta'           => 'nullable|date',
            'estado'          => 'nullable|in:autorizado,rechazado,pendiente',
        ]);

        $q = LiqOperacion::query()
            ->join('liq_liquidaciones_cliente as lc', 'lc.id', '=', 'liq_operaciones.liquidacion_cliente_id')
            ->leftJoin('personas as p', 'p.id', '=', 'liq_operaciones.distribuidor_id')
            ->where('liq_operaciones.importe_no_gravado', '>', 0)
            ->whereNotIn('liq_operaciones.estado', ['ignorado', 'anulado', 'excluida']);

        if (!empty($filters['cliente_id'])) {
            $q->where('lc.cliente_id', $filters['cliente_id']);
        }
        if (!empty($filters['distribuidor_id'])) {
            $q->where('liq_operaciones.distribuidor_id', $filters['distribuidor_id']);
        }
        if (!empty($filters['desde'])) {
            $q->whereDate('lc.periodo_desde', '>=', $filters['desde']);
        }
        if (!empty($filters['hasta'])) {
            $q->whereDate('lc.periodo_hasta', '<=', $filters['hasta']);
        }
        if (!empty($filters['estado'])) {
            switch ($filters['estado']) {
                case 'autorizado':
                    $q->where('liq_operaciones.peaje_autorizado', true);
                    break;
                case 'rechazado':
                    $q->where('liq_operaciones.peaje_autorizado', false)
                      ->whereNotNull('liq_operaciones.peaje_motivo');
                    break;
                case 'pendiente':
                    $q->where('liq_operaciones.peaje_autorizado', false)
                      ->whereNull('liq_operaciones.peaje_motivo');
                    break;
            }
        }

        $base = (clone $q);

        // Métricas globales
        $metrics = (clone $base)
            ->selectRaw("
                COUNT(*) as total_ops,
                COALESCE(SUM(liq_operaciones.importe_no_gravado), 0) as total_bruto,
                COALESCE(SUM(CASE WHEN liq_operaciones.peaje_autorizado = 1
                    THEN COALESCE(liq_operaciones.peaje_monto_ajustado, liq_operaciones.importe_no_gravado)
                    ELSE 0 END), 0) as total_autorizado,
                COALESCE(SUM(CASE WHEN liq_operaciones.peaje_autorizado = 0 AND liq_operaciones.peaje_motivo IS NOT NULL
                    THEN liq_operaciones.importe_no_gravado ELSE 0 END), 0) as total_rechazado,
                COALESCE(SUM(CASE WHEN liq_operaciones.peaje_autorizado = 0 AND liq_operaciones.peaje_motivo IS NULL
                    THEN liq_operaciones.importe_no_gravado ELSE 0 END), 0) as total_pendiente,
                SUM(CASE WHEN liq_operaciones.peaje_autorizado = 1 THEN 1 ELSE 0 END) as ops_autorizadas,
                SUM(CASE WHEN liq_operaciones.peaje_autorizado = 0 AND liq_operaciones.peaje_motivo IS NOT NULL THEN 1 ELSE 0 END) as ops_rechazadas,
                SUM(CASE WHEN liq_operaciones.peaje_autorizado = 0 AND liq_operaciones.peaje_motivo IS NULL THEN 1 ELSE 0 END) as ops_pendientes
            ")
            ->first();

        $totalOps = (int) ($metrics->total_ops ?? 0);
        $porcentajeAutorizacion = $totalOps > 0
            ? round((float) ($metrics->ops_autorizadas ?? 0) / $totalOps * 100, 2)
            : 0;

        // Top 10 distribuidores por monto autorizado
        $topDistribuidores = (clone $base)
            ->selectRaw("
                liq_operaciones.distribuidor_id,
                COALESCE(CONCAT(p.apellidos, ' ', p.nombres), 'Sin distribuidor') as distribuidor,
                p.patente,
                COUNT(*) as ops,
                COALESCE(SUM(CASE WHEN liq_operaciones.peaje_autorizado = 1
                    THEN COALESCE(liq_operaciones.peaje_monto_ajustado, liq_operaciones.importe_no_gravado)
                    ELSE 0 END), 0) as total_autorizado,
                COALESCE(SUM(liq_operaciones.importe_no_gravado), 0) as total_bruto
            ")
            ->groupBy('liq_operaciones.distribuidor_id', 'p.apellidos', 'p.nombres', 'p.patente')
            ->orderByDesc('total_autorizado')
            ->limit(10)
            ->get();

        // Serie temporal: por mes (YYYY-MM de periodo_desde)
        $serie = (clone $base)
            ->selectRaw("
                DATE_FORMAT(lc.periodo_desde, '%Y-%m') as mes,
                COUNT(*) as ops,
                COALESCE(SUM(CASE WHEN liq_operaciones.peaje_autorizado = 1
                    THEN COALESCE(liq_operaciones.peaje_monto_ajustado, liq_operaciones.importe_no_gravado)
                    ELSE 0 END), 0) as total_autorizado,
                COALESCE(SUM(liq_operaciones.importe_no_gravado), 0) as total_bruto
            ")
            ->groupBy('mes')
            ->orderBy('mes')
            ->get();

        // Motivos de rechazo/ajuste más frecuentes
        $motivos = (clone $base)
            ->whereNotNull('liq_operaciones.peaje_motivo')
            ->selectRaw('liq_operaciones.peaje_motivo as motivo, COUNT(*) as cantidad, COALESCE(SUM(liq_operaciones.importe_no_gravado), 0) as monto')
            ->groupBy('liq_operaciones.peaje_motivo')
            ->orderByDesc('cantidad')
            ->limit(10)
            ->get();

        return response()->json([
            'data' => [
                'metricas' => [
                    'total_ops'             => $totalOps,
                    'total_bruto'           => round((float) ($metrics->total_bruto ?? 0), 2),
                    'total_autorizado'      => round((float) ($metrics->total_autorizado ?? 0), 2),
                    'total_rechazado'       => round((float) ($metrics->total_rechazado ?? 0), 2),
                    'total_pendiente'       => round((float) ($metrics->total_pendiente ?? 0), 2),
                    'ops_autorizadas'       => (int) ($metrics->ops_autorizadas ?? 0),
                    'ops_rechazadas'        => (int) ($metrics->ops_rechazadas ?? 0),
                    'ops_pendientes'        => (int) ($metrics->ops_pendientes ?? 0),
                    'porcentaje_autorizacion' => $porcentajeAutorizacion,
                ],
                'top_distribuidores' => $topDistribuidores,
                'serie_temporal'     => $serie,
                'motivos'            => $motivos,
            ],
        ]);
    }

    // GET /liq/peajes/dashboard/export (BUGFIX 22 G)
    // Export detallado a Excel de operaciones con peajes aplicando mismos filtros
    public function exportDashboardPeajes(Request $request)
    {
        $filters = $request->validate([
            'cliente_id'      => 'nullable|integer|exists:liq_clientes,id',
            'distribuidor_id' => 'nullable|integer',
            'desde'           => 'nullable|date',
            'hasta'           => 'nullable|date',
            'estado'          => 'nullable|in:autorizado,rechazado,pendiente',
        ]);

        $q = LiqOperacion::query()
            ->join('liq_liquidaciones_cliente as lc', 'lc.id', '=', 'liq_operaciones.liquidacion_cliente_id')
            ->leftJoin('personas as p', 'p.id', '=', 'liq_operaciones.distribuidor_id')
            ->leftJoin('liq_clientes as c', 'c.id', '=', 'lc.cliente_id')
            ->where('liq_operaciones.importe_no_gravado', '>', 0)
            ->whereNotIn('liq_operaciones.estado', ['ignorado', 'anulado', 'excluida']);

        if (!empty($filters['cliente_id'])) {
            $q->where('lc.cliente_id', $filters['cliente_id']);
        }
        if (!empty($filters['distribuidor_id'])) {
            $q->where('liq_operaciones.distribuidor_id', $filters['distribuidor_id']);
        }
        if (!empty($filters['desde'])) {
            $q->whereDate('lc.periodo_desde', '>=', $filters['desde']);
        }
        if (!empty($filters['hasta'])) {
            $q->whereDate('lc.periodo_hasta', '<=', $filters['hasta']);
        }
        if (!empty($filters['estado'])) {
            switch ($filters['estado']) {
                case 'autorizado':
                    $q->where('liq_operaciones.peaje_autorizado', true);
                    break;
                case 'rechazado':
                    $q->where('liq_operaciones.peaje_autorizado', false)
                      ->whereNotNull('liq_operaciones.peaje_motivo');
                    break;
                case 'pendiente':
                    $q->where('liq_operaciones.peaje_autorizado', false)
                      ->whereNull('liq_operaciones.peaje_motivo');
                    break;
            }
        }

        $rows = $q->select(
            'liq_operaciones.id',
            'lc.id as liquidacion_id',
            'c.nombre_corto as cliente',
            'lc.periodo_desde',
            'lc.periodo_hasta',
            'liq_operaciones.dominio',
            'liq_operaciones.sucursal_tarifa',
            'liq_operaciones.concepto',
            'liq_operaciones.id_operacion_cliente',
            'p.apellidos',
            'p.nombres',
            'p.patente',
            'liq_operaciones.importe_gravado',
            'liq_operaciones.importe_no_gravado',
            'liq_operaciones.peaje_autorizado',
            'liq_operaciones.peaje_monto_ajustado',
            'liq_operaciones.peaje_motivo'
        )->orderBy('lc.periodo_desde', 'desc')->get();

        $header = [
            'Op ID', 'Liq ID', 'Cliente', 'Periodo Desde', 'Periodo Hasta',
            'Dominio', 'Sucursal', 'Concepto', 'Id Op Cliente',
            'Distribuidor', 'Patente',
            'Imp. Gravado', 'Imp. No Gravado',
            'Autorizado', 'Monto Ajustado', 'Motivo',
        ];

        $out = fopen('php://temp', 'r+');
        fputcsv($out, $header, ';');
        foreach ($rows as $r) {
            fputcsv($out, [
                $r->id,
                $r->liquidacion_id,
                $r->cliente,
                optional($r->periodo_desde)->format('Y-m-d') ?? $r->periodo_desde,
                optional($r->periodo_hasta)->format('Y-m-d') ?? $r->periodo_hasta,
                $r->dominio,
                $r->sucursal_tarifa,
                $r->concepto,
                $r->id_operacion_cliente,
                trim(($r->apellidos ?? '') . ' ' . ($r->nombres ?? '')),
                $r->patente,
                number_format((float) $r->importe_gravado, 2, ',', ''),
                number_format((float) $r->importe_no_gravado, 2, ',', ''),
                $r->peaje_autorizado ? 'Si' : 'No',
                $r->peaje_monto_ajustado !== null ? number_format((float) $r->peaje_monto_ajustado, 2, ',', '') : '',
                $r->peaje_motivo,
            ], ';');
        }
        rewind($out);
        $csv = stream_get_contents($out);
        fclose($out);

        $filename = 'peajes_dashboard_' . now()->format('Ymd_His') . '.csv';
        return response($csv, 200, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    // GET /liq/liquidaciones/{liquidacionCliente}/factura-lista (BUGFIX 22 E)
    public function facturaLista(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $tolerancia = (float) ($liquidacionCliente->cliente?->tolerancia_facturacion ?? 100.0);

        // 1. Sin tarifa?
        $sinTarifa = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->where('estado', 'sin_tarifa')
            ->count();

        // 2. Sin distribuidor?
        $sinDistribuidor = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->where('estado', 'sin_distribuidor')
            ->count();

        // 3. Sucursales con ops pero sin totales de PDF
        $sucursalesConOps = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->whereNotIn('estado', ['ignorado', 'anulado', 'excluida'])
            ->whereNotNull('sucursal_tarifa')
            ->distinct()
            ->pluck('sucursal_tarifa');

        $sucursalesConPdf = \DB::table('liq_liquidacion_sucursal_totales')
            ->where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->where('total_gravado', '>', 0)
            ->pluck('sucursal');

        $sucursalesFaltantesPdf = $sucursalesConOps->diff($sucursalesConPdf)->values();

        // 4. Discrepancias TMS vs PDF
        $discrepancias = 0;
        $porSuc = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->whereNotIn('estado', ['ignorado', 'anulado', 'excluida'])
            ->selectRaw('sucursal_tarifa, COALESCE(SUM(valor_cliente),0) as t1, COALESCE(SUM(importe_gravado + importe_no_gravado),0) as t2')
            ->groupBy('sucursal_tarifa')
            ->get();
        foreach ($porSuc as $s) {
            if ((float) $s->t2 > 0 && abs((float) $s->t1 - (float) $s->t2) > $tolerancia) {
                $discrepancias++;
            }
        }

        // Estado final
        $bloqueos = [];
        if ($sinTarifa > 0) $bloqueos[] = "{$sinTarifa} operaciones sin tarifa";
        if ($sinDistribuidor > 0) $bloqueos[] = "{$sinDistribuidor} operaciones sin distribuidor";
        if ($sucursalesFaltantesPdf->isNotEmpty()) $bloqueos[] = 'Faltan PDFs de sucursales: ' . $sucursalesFaltantesPdf->join(', ');
        if ($discrepancias > 0) $bloqueos[] = "Discrepancias TMS vs PDF en {$discrepancias} sucursales";

        $lista = empty($bloqueos);
        $badgeColor = $lista ? 'verde' : (count($bloqueos) > 2 ? 'rojo' : 'naranja');

        return response()->json([
            'data' => [
                'lista' => $lista,
                'badge_color' => $badgeColor,
                'bloqueos' => $bloqueos,
                'checks' => [
                    'sin_tarifa' => $sinTarifa,
                    'sin_distribuidor' => $sinDistribuidor,
                    'sucursales_faltantes_pdf' => $sucursalesFaltantesPdf->values(),
                    'discrepancias' => $discrepancias,
                ],
            ],
        ]);
    }

    // GET /liq/liquidaciones/{liquidacionCliente}/discrepancias-tms-pdf (BUGFIX 22 D)
    public function discrepanciasTmsPdf(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $tolerancia = (float) ($liquidacionCliente->cliente?->tolerancia_facturacion ?? 100.0);

        // Operaciones con importe en PDF distinto al TMS (valor_cliente)
        $ops = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->whereNotIn('estado', ['ignorado', 'anulado', 'excluida'])
            ->whereNotNull('importe_gravado')
            ->with('distribuidor:id,apellidos,nombres,patente')
            ->get();

        $discrepancias = [];
        foreach ($ops as $op) {
            $valorTms = (float) $op->valor_cliente;
            $totalPdf = (float) $op->importe_gravado + (float) $op->importe_no_gravado;
            $diff = abs($valorTms - $totalPdf);

            if ($diff > $tolerancia) {
                $discrepancias[] = [
                    'operacion_id' => $op->id,
                    'id_operacion_cliente' => $op->id_operacion_cliente,
                    'sucursal' => $op->sucursal_tarifa,
                    'fecha' => $op->campos_originales['fecha'] ?? null,
                    'distribuidor' => $op->distribuidor ? "{$op->distribuidor->apellidos} {$op->distribuidor->nombres}" : null,
                    'dominio' => $op->dominio,
                    'valor_tms' => round($valorTms, 2),
                    'valor_pdf' => round($totalPdf, 2),
                    'imp_gravado' => (float) $op->importe_gravado,
                    'imp_no_gravado' => (float) $op->importe_no_gravado,
                    'diferencia' => round($valorTms - $totalPdf, 2),
                ];
            }
        }

        // Agregado por sucursal
        $porSucursalTms = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->whereNotIn('estado', ['ignorado', 'anulado', 'excluida'])
            ->selectRaw('sucursal_tarifa as sucursal, COALESCE(SUM(valor_cliente),0) as total_tms, COALESCE(SUM(importe_gravado + importe_no_gravado),0) as total_pdf')
            ->groupBy('sucursal_tarifa')
            ->get()
            ->map(fn ($s) => [
                'sucursal' => $s->sucursal,
                'total_tms' => round((float) $s->total_tms, 2),
                'total_pdf' => round((float) $s->total_pdf, 2),
                'diferencia' => round((float) $s->total_tms - (float) $s->total_pdf, 2),
                'ok' => abs((float) $s->total_tms - (float) $s->total_pdf) <= $tolerancia,
            ]);

        return response()->json([
            'data' => [
                'tolerancia' => $tolerancia,
                'total_discrepancias' => count($discrepancias),
                'discrepancias' => $discrepancias,
                'por_sucursal' => $porSucursalTms,
            ],
        ]);
    }

    // GET /liq/liquidaciones/{liquidacionCliente}/pre-factura (BUGFIX 22 C)
    // Devuelve totales listos para pre-poblar el formulario de factura del Estado de Cuenta
    public function preFactura(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $porSucursal = \DB::table('liq_liquidacion_sucursal_totales')
            ->where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->orderBy('sucursal')
            ->get();

        // Si no hay totales calculados, recalcular on-demand desde liq_operaciones
        if ($porSucursal->isEmpty()) {
            $porSucursal = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
                ->whereNotIn('estado', ['ignorado', 'anulado', 'excluida'])
                ->whereNotNull('sucursal_tarifa')
                ->selectRaw('sucursal_tarifa as sucursal, COUNT(*) as cantidad_operaciones, COALESCE(SUM(valor_cliente),0) as total_importe, COALESCE(SUM(importe_gravado),0) as total_gravado, COALESCE(SUM(importe_no_gravado),0) as total_no_gravado')
                ->groupBy('sucursal_tarifa')
                ->orderBy('sucursal_tarifa')
                ->get();
        }

        $totalGravado = 0;
        $totalNoGravado = 0;
        $totalOps = 0;
        foreach ($porSucursal as $s) {
            $totalGravado += (float) $s->total_gravado;
            $totalNoGravado += (float) $s->total_no_gravado;
            $totalOps += (int) $s->cantidad_operaciones;
        }

        $iva = round($totalGravado * 0.21, 2);
        $totalFacturado = round($totalGravado + $iva + $totalNoGravado, 2);

        return response()->json([
            'data' => [
                'periodo_desde' => $liquidacionCliente->periodo_desde?->toDateString(),
                'periodo_hasta' => $liquidacionCliente->periodo_hasta?->toDateString(),
                'cliente_id' => $liquidacionCliente->cliente_id,
                'cantidad_operaciones' => $totalOps,
                'neto_gravado' => round($totalGravado, 2),
                'iva' => $iva,
                'no_gravado' => round($totalNoGravado, 2),
                'importe_a_cobrar' => $totalFacturado,
                'desglose_sucursal' => $porSucursal,
            ],
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

    // POST /liq/liquidaciones/{liquidacionCliente}/revincular-distribuidores
    // BUGFIX 20 Feature G: re-match distribuidores sin_distribuidor consultando personas
    public function revincularDistribuidores(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $opsSinDist = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->where('estado', 'sin_distribuidor')
            ->get();

        if ($opsSinDist->isEmpty()) {
            return response()->json(['data' => ['total' => 0, 'vinculadas' => 0, 'sin_match' => 0], 'message' => 'No hay operaciones sin_distribuidor']);
        }

        $periodoDesde = $liquidacionCliente->periodo_desde?->toDateString();
        $periodoHasta = $liquidacionCliente->periodo_hasta?->toDateString();

        // Cargar personas válidas para el periodo
        $query = \App\Models\Persona::with('patentesAdicionales:id,persona_id,patente,patente_norm,activo');
        // BUGFIX 21 B: solo fecha_baja
        if ($periodoDesde) {
            $query->where(function ($q) use ($periodoDesde) {
                $q->whereNull('fecha_baja')->orWhere('fecha_baja', '>=', $periodoDesde);
            });
        }
        $personas = $query->get(['id', 'patente', 'cuil', 'apellidos', 'nombres']);

        // Construir lookup por patente
        $lookup = [];
        foreach ($personas as $p) {
            $patentes = \App\Support\Personal\PersonaPatenteHelper::normalizedDomainsForPersona($p);
            foreach ($patentes as $pat) {
                if ($pat !== '') {
                    $lookup[$pat][] = $p;
                }
            }
        }

        $vinculadas = 0;
        $sinMatch = 0;
        DB::beginTransaction();
        try {
            foreach ($opsSinDist as $op) {
                $dominio = $op->dominio ? strtoupper(preg_replace('/[^A-Z0-9]/', '', $op->dominio)) : '';
                if ($dominio === '') { $sinMatch++; continue; }

                $candidates = $lookup[$dominio] ?? [];
                if (count($candidates) === 1) {
                    $op->update([
                        'distribuidor_id' => $candidates[0]->id,
                        'estado' => $op->linea_tarifa_id ? 'ok' : 'sin_tarifa',
                        'observaciones' => 'Vinculado via revincular-distribuidores (BUGFIX 20 G)',
                    ]);
                    $vinculadas++;
                } else {
                    $sinMatch++;
                }
            }

            // Recalcular totales
            $this->recalcularTotalesLiquidacion($liquidacionCliente);

            if (class_exists(\App\Models\LiqHistorialMovimiento::class)) {
                \App\Models\LiqHistorialMovimiento::registrar(
                    'revincular_distribuidores',
                    "Revincular: {$vinculadas} vinculadas, {$sinMatch} sin match de " . $opsSinDist->count() . " totales",
                    $request->user()?->id, $liquidacionCliente->id, null, null,
                    ['vinculadas' => $vinculadas, 'sin_match' => $sinMatch, 'total' => $opsSinDist->count()]
                );
            }

            DB::commit();
            return response()->json([
                'data' => ['total' => $opsSinDist->count(), 'vinculadas' => $vinculadas, 'sin_match' => $sinMatch],
                'message' => "{$vinculadas} operaciones vinculadas, {$sinMatch} quedaron sin match.",
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'Error revinculando: ' . $e->getMessage()], 500);
        }
    }

    // GET /liq/liquidaciones/{liquidacionCliente}/duplicados
    public function duplicados(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $dups = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->where('estado', 'duplicado')
            ->with('distribuidor:id,apellidos,nombres,patente')
            ->get()
            ->map(function ($op) {
                // Buscar operación existente con mismo id_operacion_cliente
                $existente = null;
                if ($op->id_operacion_cliente) {
                    $existente = LiqOperacion::where('id_operacion_cliente', $op->id_operacion_cliente)
                        ->where('id', '!=', $op->id)
                        ->whereNotIn('estado', ['ignorado', 'anulado', 'duplicado'])
                        ->with('distribuidor:id,apellidos,nombres,patente')
                        ->first();
                }

                return [
                    'id' => $op->id,
                    'id_operacion_cliente' => $op->id_operacion_cliente,
                    'importe_nuevo' => (float) $op->valor_cliente,
                    'concepto' => $op->concepto,
                    'dominio' => $op->dominio,
                    'distribuidor' => $op->distribuidor ? trim($op->distribuidor->apellidos . ' ' . $op->distribuidor->nombres) : null,
                    'existente' => $existente ? [
                        'id' => $existente->id,
                        'liquidacion_cliente_id' => $existente->liquidacion_cliente_id,
                        'importe' => (float) $existente->valor_cliente,
                        'estado' => $existente->estado,
                        'distribuidor' => $existente->distribuidor ? trim($existente->distribuidor->apellidos . ' ' . $existente->distribuidor->nombres) : null,
                    ] : null,
                    'diferencia' => $existente ? round((float) $op->valor_cliente - (float) $existente->valor_cliente, 2) : 0,
                ];
            });

        return response()->json(['data' => $dups, 'total' => $dups->count()]);
    }

    // POST /liq/liquidaciones/{liquidacionCliente}/resolver-duplicados
    public function resolverDuplicados(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $data = $request->validate([
            'resoluciones' => 'required|array',
            'resoluciones.*.operacion_duplicada_id' => 'required|integer',
            'resoluciones.*.accion' => 'required|in:actualizar,ajuste,ignorar,anular_recargar',
        ]);

        $stats = ['actualizadas' => 0, 'ajustes_creados' => 0, 'ignoradas' => 0, 'anuladas_recargadas' => 0];

        DB::beginTransaction();
        try {
            foreach ($data['resoluciones'] as $res) {
                $dupOp = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
                    ->where('id', $res['operacion_duplicada_id'])
                    ->where('estado', 'duplicado')
                    ->first();

                if (!$dupOp || !$dupOp->id_operacion_cliente) continue;

                // Buscar operación existente
                $existente = LiqOperacion::where('id_operacion_cliente', $dupOp->id_operacion_cliente)
                    ->where('id', '!=', $dupOp->id)
                    ->whereNotIn('estado', ['ignorado', 'anulado', 'duplicado'])
                    ->first();

                switch ($res['accion']) {
                    case 'actualizar':
                        // Reemplazar valores de la existente con los nuevos
                        if ($existente) {
                            $existente->update([
                                'valor_cliente' => $dupOp->valor_cliente,
                                'campos_originales' => $dupOp->campos_originales,
                                'concepto' => $dupOp->concepto ?? $existente->concepto,
                            ]);
                        }
                        $dupOp->update(['estado' => 'ignorado', 'observaciones' => 'Duplicado resuelto: actualizado en operación #' . ($existente?->id ?? '?')]);
                        $stats['actualizadas']++;
                        break;

                    case 'ajuste':
                        $diffImporte = round((float) $dupOp->valor_cliente - (float) ($existente?->valor_cliente ?? 0), 2);
                        $dupOp->update([
                            'estado' => 'ok',
                            'tipo_operacion' => 'ajuste',
                            'operacion_referencia_id' => $existente?->id,
                            'valor_cliente' => $diffImporte,
                            'observaciones' => 'Ajuste por corrección de ' . $dupOp->id_operacion_cliente . '. Diferencia: $' . number_format($diffImporte, 2),
                        ]);
                        $stats['ajustes_creados']++;
                        break;

                    case 'ignorar':
                        $dupOp->update(['estado' => 'ignorado', 'observaciones' => 'Duplicado ignorado por operador']);
                        $stats['ignoradas']++;
                        break;

                    case 'anular_recargar':
                        if ($existente) {
                            $existente->update(['estado' => 'anulado', 'observaciones' => 'Anulada por reemplazo - Op #' . $dupOp->id]);
                        }
                        $dupOp->update([
                            'estado' => 'ok',
                            'tipo_operacion' => 'reemplazo',
                            'operacion_referencia_id' => $existente?->id,
                            'observaciones' => 'Reemplazo de operación #' . ($existente?->id ?? '?'),
                        ]);
                        $stats['anuladas_recargadas']++;
                        break;
                }
            }

            DB::commit();

            // Recalcular totales
            $this->recalcularTotalesLiquidacion($liquidacionCliente);

            return response()->json(['message' => 'Duplicados resueltos', 'data' => $stats]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'Error resolviendo duplicados: ' . $e->getMessage()], 500);
        }
    }

    private function recalcularTotalesLiquidacion(LiqLiquidacionCliente $liq): void
    {
        $ops = LiqOperacion::where('liquidacion_cliente_id', $liq->id)
            ->whereNotIn('estado', ['ignorado', 'anulado', 'duplicado', 'excluida']);
        $liq->update([
            'total_operaciones' => $ops->count(),
            'total_importe_cliente' => $ops->sum('valor_cliente'),
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
                // Línea ya existe — NO pisar precio_original (es la tarifa GENÉRICA compartida)
                // Solo actualizar si no tenía precio distribuidor definido
                if (!$lineaTarifa->precio_distribuidor || $lineaTarifa->precio_distribuidor == 0) {
                    $lineaTarifa->update([
                        'porcentaje_agencia' => $pctAgencia,
                        'precio_distribuidor' => $precioDistribuidor,
                    ]);
                }
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
                // BUGFIX 21 A: asociar proveedor al override de tarifa
                $tarifaPatente->update(['proveedor_id' => $data['persona_id']]);

                \App\Models\LiqMapeoDistribuidor::updateOrCreate(
                    ['cliente_id' => $clienteId, 'nombre_pdf' => $patenteNorm, 'sucursal' => null],
                    ['persona_id' => $data['persona_id'], 'creado_por' => $request->user()?->id]
                );

                // BUGFIX 21 C: actualizar distribuidor_id en la operación si cambió
                if ($data['operacion_id']) {
                    $op = LiqOperacion::find($data['operacion_id']);
                    if ($op && $op->distribuidor_id !== (int) $data['persona_id']) {
                        $op->update([
                            'distribuidor_id' => $data['persona_id'],
                            'estado' => $op->linea_tarifa_id ? 'ok' : ($op->estado === 'sin_distribuidor' ? 'sin_tarifa' : $op->estado),
                        ]);
                    }
                }
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

    // ── Feature C: Mapeo sucursal-distribuidor (plataforma-wide) ─────────────

    /**
     * GET /liq/mapeos-sucursal-distribuidor?cliente_id=X
     */
    public function mapeosSucursalDistribuidor(Request $request): JsonResponse
    {
        $clienteId = $request->integer('cliente_id');
        if (!$clienteId) {
            return response()->json(['data' => []]);
        }

        $mapeos = \App\Models\LiqMapeoSucursalDistribuidor::where('cliente_id', $clienteId)
            ->with('persona:id,apellidos,nombres,patente,cuil')
            ->orderBy('sucursal')
            ->get();

        return response()->json(['data' => $mapeos]);
    }

    /**
     * POST /liq/mapeos-sucursal-distribuidor
     */
    public function storeMapeoSucursalDistribuidor(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cliente_id' => 'required|exists:liq_clientes,id',
            'sucursal' => 'required|string|max:50',
            'persona_id' => 'required|exists:personas,id',
            'es_unico' => 'nullable|boolean',
        ]);

        $mapeo = \App\Models\LiqMapeoSucursalDistribuidor::updateOrCreate(
            [
                'cliente_id' => $data['cliente_id'],
                'sucursal' => $data['sucursal'],
                'persona_id' => $data['persona_id'],
            ],
            [
                'es_unico' => $data['es_unico'] ?? false,
                'creado_por' => $request->user()?->id,
            ]
        );

        // Si es_unico, desmarcar otros mapeos de la misma sucursal
        if ($mapeo->es_unico) {
            \App\Models\LiqMapeoSucursalDistribuidor::where('cliente_id', $data['cliente_id'])
                ->where('sucursal', $data['sucursal'])
                ->where('id', '!=', $mapeo->id)
                ->update(['es_unico' => false]);
        }

        $mapeo->load('persona:id,apellidos,nombres,patente,cuil');

        return response()->json(['data' => $mapeo, 'message' => 'Mapeo guardado'], 201);
    }

    /**
     * DELETE /liq/mapeos-sucursal-distribuidor/{mapeo}
     */
    public function destroyMapeoSucursalDistribuidor(\App\Models\LiqMapeoSucursalDistribuidor $mapeo): JsonResponse
    {
        $mapeo->delete();
        return response()->json(['message' => 'Mapeo eliminado']);
    }

    /**
     * POST /liq/liquidaciones/{liquidacionCliente}/asignar-distribuidor-masivo
     *
     * Asigna un distribuidor a todas las operaciones sin_distribuidor de una sucursal.
     */
    public function asignarDistribuidorMasivo(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $data = $request->validate([
            'sucursal' => 'required|string|max:150',
            'persona_id' => 'required|exists:personas,id',
            'recordar' => 'nullable|boolean',
            'es_unico' => 'nullable|boolean',
        ]);

        $updated = LiqOperacion::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->where('estado', 'sin_distribuidor')
            ->where('sucursal_tarifa', $data['sucursal'])
            ->update([
                'distribuidor_id' => $data['persona_id'],
                'estado' => 'pendiente',
                'observaciones' => DB::raw("CONCAT(IFNULL(observaciones, ''), ' Distribuidor asignado manualmente.')"),
            ]);

        // Persistir mapeo si se pidió recordar
        if ($data['recordar'] ?? false) {
            \App\Models\LiqMapeoSucursalDistribuidor::updateOrCreate(
                [
                    'cliente_id' => $liquidacionCliente->cliente_id,
                    'sucursal' => $data['sucursal'],
                    'persona_id' => $data['persona_id'],
                ],
                [
                    'es_unico' => $data['es_unico'] ?? false,
                    'creado_por' => $request->user()?->id,
                ]
            );
        }

        return response()->json([
            'data' => ['operaciones_actualizadas' => $updated],
            'message' => "{$updated} operaciones asignadas al distribuidor",
        ]);
    }

    /**
     * POST /liq/liquidaciones/{liquidacionCliente}/asignar-distribuidor-individual
     *
     * Asigna un distribuidor a operaciones individuales.
     */
    public function asignarDistribuidorIndividual(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $data = $request->validate([
            'asignaciones' => 'required|array|min:1',
            'asignaciones.*.operacion_id' => 'required|integer',
            'asignaciones.*.persona_id' => 'required|exists:personas,id',
        ]);

        $updated = 0;
        foreach ($data['asignaciones'] as $asig) {
            $affected = LiqOperacion::where('id', $asig['operacion_id'])
                ->where('liquidacion_cliente_id', $liquidacionCliente->id)
                ->where('estado', 'sin_distribuidor')
                ->update([
                    'distribuidor_id' => $asig['persona_id'],
                    'estado' => 'pendiente',
                    'observaciones' => DB::raw("CONCAT(IFNULL(observaciones, ''), ' Distribuidor asignado manualmente.')"),
                ]);
            $updated += $affected;
        }

        return response()->json([
            'data' => ['operaciones_actualizadas' => $updated],
            'message' => "{$updated} operaciones asignadas individualmente",
        ]);
    }

    // ── Feature D: Creación manual de liquidación distribuidor ──────────────

    /**
     * POST /liq/liquidaciones-distribuidor/manual
     *
     * Crea una liquidación de distribuidor manualmente sin depender de liquidación cliente.
     */
    public function crearLiquidacionManual(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cliente_id' => 'required|exists:liq_clientes,id',
            'distribuidor_id' => 'required|exists:personas,id',
            'periodo_desde' => 'required|date',
            'periodo_hasta' => 'required|date|after_or_equal:periodo_desde',
            'sucursal' => 'nullable|string|max:150',
            'referencia_externa' => 'nullable|string|max:255',
            'observaciones' => 'nullable|string|max:1000',
            'lineas' => 'required|array|min:1',
            'lineas.*.concepto' => 'required|string|max:200',
            'lineas.*.descripcion' => 'nullable|string|max:500',
            'lineas.*.cantidad' => 'required|numeric|min:0',
            'lineas.*.tarifa_unitaria' => 'required|numeric|min:0',
            'descuentos' => 'nullable|array',
            'descuentos.*.concepto' => 'required|string|max:200',
            'descuentos.*.monto' => 'required|numeric|min:0',
        ]);

        $subtotal = 0;
        foreach ($data['lineas'] as $linea) {
            $subtotal += round((float) $linea['cantidad'] * (float) $linea['tarifa_unitaria'], 2);
        }

        $totalDescuentos = 0;
        foreach ($data['descuentos'] ?? [] as $desc) {
            $totalDescuentos += round((float) $desc['monto'], 2);
        }

        $gastoConfig = LiqConfiguracionGastos::where('cliente_id', $data['cliente_id'])
            ->where('activo', true)
            ->where('vigencia_desde', '<=', $data['periodo_hasta'])
            ->where(function ($q) use ($data) {
                $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $data['periodo_desde']);
            })
            ->first();
        $gastosAdmin = $this->resolveGastoAmount($gastoConfig, $subtotal);

        $totalAPagar = round($subtotal - $gastosAdmin - $totalDescuentos, 2);

        DB::beginTransaction();
        try {
            $liqDist = LiqLiquidacionDistribuidor::create([
                'liquidacion_cliente_id' => null,
                'cliente_id' => $data['cliente_id'],
                'distribuidor_id' => $data['distribuidor_id'],
                'periodo_desde' => $data['periodo_desde'],
                'periodo_hasta' => $data['periodo_hasta'],
                'fecha_generacion' => now(),
                'cantidad_operaciones' => count($data['lineas']),
                'subtotal' => round($subtotal, 2),
                'gastos_administrativos' => round($gastosAdmin, 2),
                'beneficio_seguro' => round($totalDescuentos, 2),
                'total_a_pagar' => $totalAPagar,
                'estado' => LiqLiquidacionDistribuidor::ESTADO_GENERADA,
                'origen' => 'manual',
                'referencia_externa' => $data['referencia_externa'] ?? null,
                'observaciones_manual' => $data['observaciones'] ?? null,
            ]);

            foreach ($data['lineas'] as $linea) {
                $totalLinea = round((float) $linea['cantidad'] * (float) $linea['tarifa_unitaria'], 2);
                \App\Models\LiqLiquidacionManualDetalle::create([
                    'liquidacion_distribuidor_id' => $liqDist->id,
                    'concepto' => $linea['concepto'],
                    'descripcion' => $linea['descripcion'] ?? null,
                    'cantidad' => $linea['cantidad'],
                    'tarifa_unitaria' => $linea['tarifa_unitaria'],
                    'total_linea' => $totalLinea,
                ]);
            }

            LiqHistorialAuditoria::registrar(
                'liquidacion_distribuidor', $liqDist->id, 'creacion',
                null,
                ['subtotal' => round($subtotal, 2), 'total' => $totalAPagar, 'origen' => 'manual', 'lineas' => count($data['lineas']), 'referencia' => $data['referencia_externa'] ?? null],
                $data['observaciones'] ?? 'Creacion manual',
                $request->user(), $request->ip()
            );

            DB::commit();

            $liqDist->load('distribuidor:id,apellidos,nombres,patente,cuil');

            return response()->json([
                'data' => $liqDist,
                'message' => 'Liquidación manual creada correctamente',
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'Error al crear liquidación manual: ' . $e->getMessage()], 500);
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

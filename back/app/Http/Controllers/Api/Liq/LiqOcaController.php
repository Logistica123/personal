<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqArchivoEntrada;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqLineaTarifa;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqHistorialMovimiento;
use App\Models\LiqMapeoDistribuidor;
use App\Models\LiqOperacion;
use App\Models\LiqTarifaPatente;
use App\Models\LiqVinculacionOca;
use App\Models\Persona;
use App\Services\Oca\OcaClient;
use App\Services\Oca\OcaIngestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class LiqOcaController extends Controller
{
    public function __construct(
        private readonly OcaIngestService $ocaIngestService,
        private readonly OcaClient $ocaClient,
    ) {}

    /**
     * POST /liq/oca/upload - Sube y procesa PDFs OCA.
     *
     * Recibe el PDF principal + PDFs de distribuidores para una liquidación.
     */
    public function upload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'liquidacion_cliente_id' => 'required|exists:liq_liquidaciones_cliente,id',
            'sucursal' => 'required|string|max:20',
            'main_pdf' => 'required|file|mimes:pdf',
            'distrib_pdfs' => 'required|array|min:1',
            'distrib_pdfs.*' => 'file|mimes:pdf',
        ]);

        $liquidacion = LiqLiquidacionCliente::with('cliente')->findOrFail($data['liquidacion_cliente_id']);
        $sucursal = strtoupper(trim($data['sucursal']));

        // Guardar PDF principal como archivo de entrada
        $mainFile = $request->file('main_pdf');
        $disk = 'local';
        $dir = "liq/{$liquidacion->cliente_id}/archivos";

        $mainNombreInterno = Str::uuid() . '.pdf';
        $mainRuta = $mainFile->storeAs($dir, $mainNombreInterno, $disk);

        $archivoPrincipal = LiqArchivoEntrada::create([
            'liquidacion_cliente_id' => $liquidacion->id,
            'tipo_archivo' => 'OCA_PRINCIPAL',
            'nombre_original' => $mainFile->getClientOriginalName(),
            'nombre_interno' => $mainNombreInterno,
            'disk' => $disk,
            'ruta_storage' => $mainRuta,
            'tamano' => (int) ($mainFile->getSize() ?? 0),
            'sucursal' => $sucursal,
        ]);

        // Guardar PDFs de distribuidores
        $archivosDistrib = [];
        foreach ($request->file('distrib_pdfs', []) as $distribFile) {
            $distribNombreInterno = Str::uuid() . '.pdf';
            $distribRuta = $distribFile->storeAs($dir, $distribNombreInterno, $disk);

            $archivosDistrib[] = LiqArchivoEntrada::create([
                'liquidacion_cliente_id' => $liquidacion->id,
                'tipo_archivo' => 'OCA_DISTRIBUIDOR',
                'nombre_original' => $distribFile->getClientOriginalName(),
                'nombre_interno' => $distribNombreInterno,
                'disk' => $disk,
                'ruta_storage' => $distribRuta,
                'tamano' => (int) ($distribFile->getSize() ?? 0),
                'sucursal' => $sucursal,
            ]);
        }

        try {
            $result = $this->ocaIngestService->procesar(
                liquidacion: $liquidacion,
                archivoPrincipal: $archivoPrincipal,
                archivosDistrib: $archivosDistrib,
                mainPdf: $mainFile,
                distribPdfs: $request->file('distrib_pdfs', []),
                sucursal: $sucursal,
            );

            return response()->json(['data' => $result, 'message' => 'PDFs OCA procesados correctamente'], 201);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Error al procesar PDFs OCA: ' . $e->getMessage()], 422);
        }
    }

    /**
     * POST /liq/oca/upload-ocr - Sube PDF OCA escaneado y procesa con OCR.
     *
     * Cuando el parser normal extrae 0 operaciones de un PDF-imagen,
     * el frontend llama a este endpoint para intentar OCR con Tesseract.
     */
    public function uploadOcr(Request $request): JsonResponse
    {
        $data = $request->validate([
            'liquidacion_cliente_id' => 'required|exists:liq_liquidaciones_cliente,id',
            'sucursal' => 'required|string|max:20',
            'main_pdf' => 'required|file|mimes:pdf',
            'distrib_pdfs' => 'required|array|min:1',
            'distrib_pdfs.*' => 'file|mimes:pdf',
        ]);

        $liquidacion = LiqLiquidacionCliente::with('cliente')->findOrFail($data['liquidacion_cliente_id']);
        $sucursal = strtoupper(trim($data['sucursal']));

        $mainFile = $request->file('main_pdf');
        $disk = 'local';
        $dir = "liq/{$liquidacion->cliente_id}/archivos";

        $mainNombreInterno = Str::uuid() . '.pdf';
        $mainRuta = $mainFile->storeAs($dir, $mainNombreInterno, $disk);

        $archivoPrincipal = LiqArchivoEntrada::create([
            'liquidacion_cliente_id' => $liquidacion->id,
            'tipo_archivo' => 'OCA_PRINCIPAL',
            'nombre_original' => $mainFile->getClientOriginalName(),
            'nombre_interno' => $mainNombreInterno,
            'disk' => $disk,
            'ruta_storage' => $mainRuta,
            'tamano' => (int) ($mainFile->getSize() ?? 0),
            'sucursal' => $sucursal,
        ]);

        $archivosDistrib = [];
        foreach ($request->file('distrib_pdfs', []) as $distribFile) {
            $distribNombreInterno = Str::uuid() . '.pdf';
            $distribRuta = $distribFile->storeAs($dir, $distribNombreInterno, $disk);
            $archivosDistrib[] = LiqArchivoEntrada::create([
                'liquidacion_cliente_id' => $liquidacion->id,
                'tipo_archivo' => 'OCA_DISTRIBUIDOR',
                'nombre_original' => $distribFile->getClientOriginalName(),
                'nombre_interno' => $distribNombreInterno,
                'disk' => $disk,
                'ruta_storage' => $distribRuta,
                'tamano' => (int) ($distribFile->getSize() ?? 0),
                'sucursal' => $sucursal,
            ]);
        }

        try {
            $result = $this->ocaIngestService->procesarConOcr(
                liquidacion: $liquidacion,
                archivoPrincipal: $archivoPrincipal,
                archivosDistrib: $archivosDistrib,
                mainPdf: $mainFile,
                distribPdfs: $request->file('distrib_pdfs', []),
                sucursal: $sucursal,
            );

            return response()->json(['data' => $result, 'message' => 'PDFs OCA procesados con OCR'], 201);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Error al procesar con OCR: ' . $e->getMessage()], 422);
        }
    }

    /**
     * POST /liq/oca/{liquidacionCliente}/operaciones-manuales
     *
     * Carga manual de operaciones OCA cuando OCR falla o el operador prefiere cargar a mano.
     * Crea vinculaciones en liq_vinculaciones_oca con origen manual.
     */
    public function cargarOperacionesManuales(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $data = $request->validate([
            'sucursal' => 'required|string|max:20',
            'operaciones' => 'required|array|min:1',
            'operaciones.*.fecha' => 'required|date',
            'operaciones.*.nro_planilla' => 'required|string|max:50',
            'operaciones.*.cod_contrato' => 'required|string|max:50',
            'operaciones.*.descripcion' => 'nullable|string|max:200',
            'operaciones.*.unidad_recorrido' => 'nullable|string|max:100',
            'operaciones.*.precio_unitario' => 'required|numeric|min:0',
            'operaciones.*.cantidad' => 'required|numeric|min:0',
        ]);

        $sucursal = strtoupper(trim($data['sucursal']));
        $creadas = 0;

        foreach ($data['operaciones'] as $op) {
            $precio = (float) $op['precio_unitario'];
            $cantidad = (float) $op['cantidad'];
            $importe = round($precio * $cantidad, 2);

            LiqVinculacionOca::create([
                'liquidacion_cliente_id' => $liquidacionCliente->id,
                'fecha' => $op['fecha'],
                'nro_planilla' => $op['nro_planilla'],
                'cod_contrato' => $op['cod_contrato'],
                'descripcion' => $op['descripcion'] ?? ($op['unidad_recorrido'] ?? null),
                'precio_original' => $precio,
                'cantidad' => $cantidad,
                'importe_original' => $importe,
                'estado' => 'SIN_ASIGNAR',
                'formato_origen' => 'MANUAL',
                'sucursal' => $sucursal,
            ]);
            $creadas++;
        }

        LiqHistorialMovimiento::registrar(
            'carga_manual',
            "Cargó manualmente {$creadas} operaciones OCA para sucursal {$sucursal}",
            $request->user()?->id,
            $liquidacionCliente->id,
            null,
            null,
            ['sucursal' => $sucursal, 'cantidad' => $creadas]
        );

        return response()->json([
            'data' => ['operaciones_creadas' => $creadas, 'sucursal' => $sucursal],
            'message' => "{$creadas} operaciones cargadas manualmente",
        ], 201);
    }

    /**
     * GET /liq/oca/{liquidacionCliente}/vinculaciones - Lista vinculaciones OCA.
     */
    public function vinculaciones(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $query = LiqVinculacionOca::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->with('distribuidor:id,apellidos,nombres,patente');

        if ($request->filled('estado')) {
            $query->where('estado', $request->string('estado'));
        }
        if ($request->filled('fecha')) {
            $query->whereDate('fecha', $request->string('fecha'));
        }
        if ($request->filled('distribuidor_nombre')) {
            $query->where('distribuidor_nombre', 'like', '%' . $request->string('distribuidor_nombre') . '%');
        }

        $vinculaciones = $query->orderBy('fecha')->orderBy('distribuidor_nombre')->paginate(100);

        return response()->json(['data' => $vinculaciones]);
    }

    /**
     * GET /liq/oca/{liquidacionCliente}/resumen - Resumen de vinculación OCA.
     */
    public function resumen(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $liqId = $liquidacionCliente->id;

        // Por estado
        $porEstado = LiqVinculacionOca::where('liquidacion_cliente_id', $liqId)
            ->selectRaw('estado, COUNT(*) as cantidad, SUM(importe_original) as total_importe')
            ->groupBy('estado')
            ->get();

        // Por distribuidor
        $porDistribuidor = LiqVinculacionOca::where('liquidacion_cliente_id', $liqId)
            ->where('estado', '!=', 'SIN_ASIGNAR')
            ->selectRaw('distribuidor_nombre, COUNT(*) as planillas, SUM(cantidad) as total_qty, SUM(importe_original) as total_importe')
            ->groupBy('distribuidor_nombre')
            ->orderByRaw('SUM(importe_original) DESC')
            ->get();

        // Por día
        $porDia = LiqVinculacionOca::where('liquidacion_cliente_id', $liqId)
            ->selectRaw('fecha, estado, COUNT(*) as planillas, SUM(importe_original) as total_importe')
            ->groupBy('fecha', 'estado')
            ->orderBy('fecha')
            ->get()
            ->groupBy('fecha');

        return response()->json([
            'por_estado' => $porEstado,
            'por_distribuidor' => $porDistribuidor,
            'por_dia' => $porDia,
        ]);
    }

    /**
     * GET /liq/oca/{liquidacionCliente}/tarifas-detectadas
     *
     * Agrupa vinculaciones por sucursal+contrato+distribuidor, compara contra liq_lineas_tarifa
     * y liq_mapeos_distribuidor, devuelve cuadro con estado OK/Nueva/Cambio/Sin vincular.
     */
    public function tarifasDetectadas(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $liqId = $liquidacionCliente->id;
        $clienteId = $liquidacionCliente->cliente_id;

        // Agrupar vinculaciones por sucursal + cod_contrato + distribuidor_nombre
        $grupos = LiqVinculacionOca::where('liquidacion_cliente_id', $liqId)
            ->where('estado', '!=', 'SIN_ASIGNAR')
            ->selectRaw('sucursal, cod_contrato, precio_original, distribuidor_nombre, distribuidor_id, COUNT(*) as cant_planillas, SUM(cantidad) as total_qty, SUM(importe_original) as total_importe')
            ->groupBy('sucursal', 'cod_contrato', 'precio_original', 'distribuidor_nombre', 'distribuidor_id')
            ->orderBy('sucursal')
            ->orderBy('cod_contrato')
            ->orderBy('distribuidor_nombre')
            ->get();

        $esquema = LiqEsquemaTarifario::where('cliente_id', $clienteId)
            ->where('activo', true)
            ->first();

        // Cargar mapeos distribuidor para pre-vincular
        $mapeos = LiqMapeoDistribuidor::where('cliente_id', $clienteId)
            ->get()
            ->keyBy(fn ($m) => strtoupper(trim($m->nombre_pdf)));

        $resultado = [];
        foreach ($grupos as $g) {
            $sucursal = $g->sucursal;
            $contrato = $g->cod_contrato;
            $precioRecibido = (float) $g->precio_original;
            $distribNombre = $g->distribuidor_nombre;
            $distribId = $g->distribuidor_id;

            // Pre-vincular via liq_mapeos_distribuidor si no tiene persona_id
            $proveedorNombre = null;
            $proveedorPatente = null;
            if (!$distribId && $distribNombre) {
                $key = strtoupper(trim($distribNombre));
                $mapeo = $mapeos->get($key);
                if ($mapeo) {
                    $distribId = $mapeo->persona_id;
                }
            }

            // Obtener datos del proveedor
            if ($distribId) {
                $persona = Persona::find($distribId);
                if ($persona) {
                    $proveedorNombre = trim($persona->apellidos . ' ' . $persona->nombres);
                    $proveedorPatente = $persona->patente;
                }
            }

            // Buscar línea de tarifa vigente
            $lineaTarifa = null;
            if ($esquema) {
                $lineaTarifa = LiqLineaTarifa::where('esquema_id', $esquema->id)
                    ->where('activo', true)
                    ->where('dimensiones_valores->sucursal', $sucursal)
                    ->where('dimensiones_valores->contrato', $contrato)
                    ->latest('vigencia_desde')
                    ->first();
            }

            $estado = 'nueva';
            $tarifaRegistrada = null;
            $precioDistribuidor = null;
            $lineaTarifaId = null;

            if ($lineaTarifa) {
                $lineaTarifaId = $lineaTarifa->id;
                $tarifaRegistrada = (float) $lineaTarifa->precio_original;
                $precioDistribuidor = (float) $lineaTarifa->precio_distribuidor;
                $diff = abs($precioRecibido - $tarifaRegistrada);
                $estado = $diff < 1.0 ? 'ok' : 'cambio';
            }

            // Si tarifa OK pero sin vincular → estado sin_vincular
            if ($estado === 'ok' && !$distribId) {
                $estado = 'sin_vincular';
            }

            $resultado[] = [
                'sucursal' => $sucursal,
                'cod_contrato' => $contrato,
                'precio_recibido' => $precioRecibido,
                'tarifa_registrada' => $tarifaRegistrada,
                'precio_distribuidor' => $precioDistribuidor,
                'linea_tarifa_id' => $lineaTarifaId,
                'estado' => $estado,
                'cant_planillas' => (int) $g->cant_planillas,
                'total_qty' => (float) $g->total_qty,
                'total_importe' => (float) $g->total_importe,
                'distribuidor_nombre' => $distribNombre,
                'distribuidor_id' => $distribId,
                'proveedor_nombre' => $proveedorNombre,
                'proveedor_patente' => $proveedorPatente,
            ];
        }

        return response()->json(['data' => $resultado]);
    }

    /**
     * POST /liq/oca/{liquidacionCliente}/mapear-tarifa
     *
     * Mapeo unificado: Sección A (tarifa OCA) + B (tarifa distribuidor) + C (vincular distribuidor).
     * Crea/actualiza liq_lineas_tarifa + liq_mapeos_distribuidor + liq_vinculaciones_oca atómicamente.
     */
    public function mapearTarifa(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $data = $request->validate([
            'sucursal' => 'required|string',
            'cod_contrato' => 'required|string',
            'precio_original' => 'required|numeric|min:0',
            'aceptar_tarifa' => 'required|boolean',
            'modo_calculo' => 'required|in:porcentaje,fijo',
            'valor_referencia' => 'required|numeric|min:0',
            'precio_distribuidor' => 'required|numeric|min:0',
            'vigencia_desde' => 'nullable|date',
            // Sección C: vinculación distribuidor
            'distribuidor_nombre' => 'nullable|string',
            'persona_id' => 'nullable|integer|exists:personas,id',
        ]);

        $clienteId = $liquidacionCliente->cliente_id;
        $esquema = LiqEsquemaTarifario::where('cliente_id', $clienteId)
            ->where('activo', true)
            ->firstOrFail();

        $sucursal = $data['sucursal'];
        $contrato = $data['cod_contrato'];
        $precioOriginal = (float) $data['precio_original'];
        $precioDistribuidor = (float) $data['precio_distribuidor'];
        $pctAgencia = $precioOriginal > 0
            ? round((1 - $precioDistribuidor / $precioOriginal) * 100, 4)
            : 0;
        $vigDesde = $data['vigencia_desde'] ?? $liquidacionCliente->periodo_desde;
        $personaId = $data['persona_id'] ?? null;
        $distribNombre = trim($data['distribuidor_nombre'] ?? '');

        DB::beginTransaction();
        try {
            // 1. Sección A: Crear/actualizar línea de tarifa (tarifa OCA original)
            $lineaTarifa = LiqLineaTarifa::where('esquema_id', $esquema->id)
                ->where('activo', true)
                ->where('dimensiones_valores->sucursal', $sucursal)
                ->where('dimensiones_valores->contrato', $contrato)
                ->first();

            if ($lineaTarifa && $data['aceptar_tarifa']) {
                $lineaTarifa->update([
                    'precio_original' => $precioOriginal,
                    'porcentaje_agencia' => $pctAgencia,
                    'precio_distribuidor' => $precioDistribuidor,
                ]);
            } elseif (!$lineaTarifa) {
                $lineaTarifa = LiqLineaTarifa::create([
                    'esquema_id' => $esquema->id,
                    'dimensiones_valores' => ['sucursal' => $sucursal, 'contrato' => $contrato],
                    'precio_original' => $precioOriginal,
                    'porcentaje_agencia' => $pctAgencia,
                    'precio_distribuidor' => $precioDistribuidor,
                    'vigencia_desde' => $vigDesde,
                    'vigencia_hasta' => null,
                    'creado_por' => $request->user()?->id,
                    'activo' => true,
                ]);
            }

            // 2. Sección C: Vincular distribuidor a proveedor
            if ($personaId && $distribNombre !== '') {
                // Guardar en liq_mapeos_distribuidor para futuros períodos
                LiqMapeoDistribuidor::updateOrCreate(
                    [
                        'cliente_id' => $clienteId,
                        'nombre_pdf' => $distribNombre,
                        'sucursal' => $sucursal,
                    ],
                    [
                        'persona_id' => $personaId,
                        'creado_por' => $request->user()?->id,
                    ]
                );

                // También guardar sin sucursal (mapeo global)
                LiqMapeoDistribuidor::updateOrCreate(
                    [
                        'cliente_id' => $clienteId,
                        'nombre_pdf' => $distribNombre,
                        'sucursal' => null,
                    ],
                    [
                        'persona_id' => $personaId,
                        'creado_por' => $request->user()?->id,
                    ]
                );

                // Actualizar vinculaciones OCA de este distribuidor en esta liquidación
                LiqVinculacionOca::where('liquidacion_cliente_id', $liquidacionCliente->id)
                    ->where('distribuidor_nombre', $distribNombre)
                    ->whereNull('distribuidor_id')
                    ->update(['distribuidor_id' => $personaId]);
            }

            // Historial
            $userId = $request->user()?->id;
            LiqHistorialMovimiento::registrar(
                'tarifa_mapeada',
                "Tarifa {$sucursal}/{$contrato}: OCA \${$precioOriginal} -> Distrib \${$precioDistribuidor} ({$data['modo_calculo']})",
                $userId, $liquidacionCliente->id, null, null,
                ['sucursal' => $sucursal, 'contrato' => $contrato, 'precio_oca' => $precioOriginal, 'precio_distrib' => $precioDistribuidor, 'modo' => $data['modo_calculo']]
            );
            if ($personaId && $distribNombre !== '') {
                LiqHistorialMovimiento::registrar(
                    'vinculado',
                    "Vinculó '{$distribNombre}' a proveedor #{$personaId}",
                    $userId, $liquidacionCliente->id, null, $personaId,
                    ['nombre_pdf' => $distribNombre]
                );
            }

            DB::commit();

            return response()->json([
                'message' => 'Tarifa mapeada correctamente',
                'data' => [
                    'linea_tarifa_id' => $lineaTarifa->id,
                    'sucursal' => $sucursal,
                    'contrato' => $contrato,
                    'precio_original' => $precioOriginal,
                    'precio_distribuidor' => $precioDistribuidor,
                    'porcentaje_agencia' => $pctAgencia,
                    'persona_id' => $personaId,
                ],
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'Error al mapear tarifa: ' . $e->getMessage()], 500);
        }
    }

    /**
     * GET /liq/oca/buscar-personas - Busca proveedores para el dropdown de vinculación.
     */
    public function buscarPersonas(Request $request): JsonResponse
    {
        $q = trim($request->string('q', ''));
        if (strlen($q) < 2) {
            return response()->json(['data' => []]);
        }

        $personas = Persona::where(function ($query) use ($q) {
                $query->where('apellidos', 'LIKE', "%{$q}%")
                    ->orWhere('nombres', 'LIKE', "%{$q}%")
                    ->orWhere('patente', 'LIKE', "%{$q}%")
                    ->orWhere('cuil', 'LIKE', "%{$q}%");
            })
            ->whereNull('deleted_at')
            ->select('id', 'apellidos', 'nombres', 'patente', 'cuil')
            ->orderBy('apellidos')
            ->limit(20)
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'label' => trim($p->apellidos . ' ' . $p->nombres) . ($p->patente ? " ({$p->patente})" : ''),
                'apellidos' => $p->apellidos,
                'nombres' => $p->nombres,
                'patente' => $p->patente,
                'cuil' => $p->cuil,
            ]);

        return response()->json(['data' => $personas]);
    }

    /**
     * POST /liq/oca/{liquidacionCliente}/generar-operaciones
     *
     * Convierte las vinculaciones OCA en liq_operaciones con lookup de tarifa.
     * Cada vinculación se convierte en una operación con:
     * - valor_cliente = importe con tarifa OCA (del PDF)
     * - valor_tarifa_distribuidor = cantidad x precio_distribuidor (de liq_lineas_tarifa o override)
     * - estado: ok / sin_tarifa / sin_distribuidor
     */
    public function generarOperaciones(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $liqId = $liquidacionCliente->id;
        $clienteId = $liquidacionCliente->cliente_id;

        $esquema = LiqEsquemaTarifario::where('cliente_id', $clienteId)
            ->where('activo', true)
            ->first();

        if (!$esquema) {
            return response()->json(['error' => 'No hay esquema tarifario activo para OCA'], 422);
        }

        // Verificar que no haya tarifas sin mapear
        $vinculaciones = LiqVinculacionOca::where('liquidacion_cliente_id', $liqId)
            ->where('estado', '!=', 'SIN_ASIGNAR')
            ->get();

        if ($vinculaciones->isEmpty()) {
            return response()->json(['error' => 'No hay vinculaciones para procesar'], 422);
        }

        // Obtener archivo principal para FK
        $archivoPrincipal = LiqArchivoEntrada::where('liquidacion_cliente_id', $liqId)
            ->where('tipo_archivo', 'OCA_PRINCIPAL')
            ->first();

        // Cargar mapeos distribuidor para pre-vincular
        $mapeosDistrib = LiqMapeoDistribuidor::where('cliente_id', $clienteId)
            ->get()
            ->keyBy(fn ($m) => strtoupper(trim($m->nombre_pdf)));

        // Limpiar operaciones previas de esta liquidación
        LiqOperacion::where('liquidacion_cliente_id', $liqId)->delete();

        $stats = ['ok' => 0, 'sin_tarifa' => 0, 'sin_distribuidor' => 0, 'total' => 0];

        foreach ($vinculaciones as $vinc) {
            $sucursal = $vinc->sucursal;
            $contrato = $vinc->cod_contrato;
            $cantidad = (float) $vinc->cantidad;
            $precioOca = (float) $vinc->precio_original;
            $importeOca = (float) $vinc->importe_original;
            $distribuidorId = $vinc->distribuidor_id;

            // Pre-vincular via liq_mapeos_distribuidor si no tiene persona_id
            if (!$distribuidorId && $vinc->distribuidor_nombre) {
                $key = strtoupper(trim($vinc->distribuidor_nombre));
                $mapeo = $mapeosDistrib->get($key);
                if ($mapeo) {
                    $distribuidorId = $mapeo->persona_id;
                }
            }

            // Fallback: mapeo sucursal-distribuidor (Feature C)
            if (!$distribuidorId && $sucursal) {
                $mapeoSucDist = \App\Models\LiqMapeoSucursalDistribuidor::where('cliente_id', $clienteId)
                    ->where('sucursal', $sucursal)
                    ->where('es_unico', true)
                    ->first();
                if ($mapeoSucDist) {
                    $distribuidorId = $mapeoSucDist->persona_id;
                }
            }

            // Buscar línea de tarifa para sucursal+contrato
            $lineaTarifa = LiqLineaTarifa::where('esquema_id', $esquema->id)
                ->where('activo', true)
                ->where('dimensiones_valores->sucursal', $sucursal)
                ->where('dimensiones_valores->contrato', $contrato)
                ->latest('vigencia_desde')
                ->first();

            $estado = 'ok';
            $lineaTarifaId = null;
            $valorTarifaOriginal = null;
            $valorTarifaDistribuidor = null;
            $porcentajeAgencia = null;
            $diferencia = null;
            $observaciones = null;
            $dimensionesValores = ['sucursal' => $sucursal, 'contrato' => $contrato];

            if (!$distribuidorId) {
                $estado = 'sin_distribuidor';
                $observaciones = 'Distribuidor no vinculado: ' . ($vinc->distribuidor_nombre ?? 'desconocido');
                $stats['sin_distribuidor']++;
            } elseif (!$lineaTarifa) {
                $estado = 'sin_tarifa';
                $observaciones = "Sin tarifa para {$sucursal}/{$contrato}. Usar botón Mapear en Tarifas Detectadas.";
                $stats['sin_tarifa']++;
            } else {
                $lineaTarifaId = $lineaTarifa->id;
                $valorTarifaOriginal = $precioOca;
                $porcentajeAgencia = (float) $lineaTarifa->porcentaje_agencia;

                // Buscar override por patente del distribuidor
                $distribuidor = Persona::find($distribuidorId);
                $patenteNorm = $distribuidor ? strtoupper(preg_replace('/[^A-Z0-9]/', '', $distribuidor->patente ?? '')) : '';
                $override = null;
                if ($patenteNorm !== '') {
                    $override = LiqTarifaPatente::where('esquema_id', $esquema->id)
                        ->where('patente_norm', $patenteNorm)
                        ->where('linea_tarifa_id', $lineaTarifa->id)
                        ->where('activo', true)
                        ->where(function ($q) use ($clienteId) {
                            $q->where('liq_cliente_id', $clienteId)->orWhereNull('liq_cliente_id');
                        })
                        ->first();
                }

                if ($override && $override->lineaTarifa) {
                    // Usar precio del override
                    $precioDistrib = (float) $override->lineaTarifa->precio_distribuidor;
                    $valorTarifaDistribuidor = round($cantidad * $precioDistrib, 2);
                    $observaciones = 'Tarifa por override de patente.';
                } else {
                    // Usar precio default de la línea
                    $precioDistrib = (float) $lineaTarifa->precio_distribuidor;
                    $valorTarifaDistribuidor = round($cantidad * $precioDistrib, 2);
                    $observaciones = $patenteNorm ? 'Sin override individual, usando tarifa default.' : null;
                }

                $diferencia = round($importeOca - $valorTarifaDistribuidor, 2);

                // Verificar si tarifa OCA cambió
                $tarifaRegistrada = (float) $lineaTarifa->precio_original;
                if (abs($precioOca - $tarifaRegistrada) > 1.0) {
                    $estado = 'diferencia';
                    $observaciones = "Tarifa OCA cambió: registrada \${$tarifaRegistrada}, recibida \${$precioOca}.";
                }

                $stats['ok']++;
            }

            LiqOperacion::create([
                'liquidacion_cliente_id' => $liqId,
                'archivo_entrada_id' => $archivoPrincipal?->id,
                'campos_originales' => [
                    'fecha' => $vinc->fecha?->format('Y-m-d'),
                    'nro_planilla' => $vinc->nro_planilla,
                    'cod_contrato' => $contrato,
                    'descripcion' => $vinc->descripcion,
                    'precio_unitario' => $precioOca,
                    'cantidad' => $cantidad,
                    'importe_total' => $importeOca,
                    'distribuidor_nombre' => $vinc->distribuidor_nombre,
                ],
                'dominio' => $distribuidor->patente ?? null,
                'concepto' => $vinc->descripcion ?? $contrato,
                'sucursal_tarifa' => $sucursal,
                'dimensiones_valores' => $dimensionesValores,
                'valor_cliente' => $importeOca,
                'linea_tarifa_id' => $lineaTarifaId,
                'valor_tarifa_original' => $valorTarifaOriginal,
                'valor_tarifa_distribuidor' => $valorTarifaDistribuidor,
                'porcentaje_agencia' => $porcentajeAgencia,
                'diferencia_cliente' => $diferencia,
                'estado' => $estado,
                'distribuidor_id' => $distribuidorId,
                'observaciones' => $observaciones,
            ]);

            $stats['total']++;
        }

        // Recalcular totales de la liquidación
        $liquidacionCliente->update([
            'total_operaciones' => $stats['total'],
            'total_importe_cliente' => $vinculaciones->sum('importe_original'),
            'estado' => 'en_proceso',
        ]);

        LiqHistorialMovimiento::registrar(
            'operaciones_generadas',
            "Generó {$stats['total']} operaciones: {$stats['ok']} OK, {$stats['sin_tarifa']} sin tarifa, {$stats['sin_distribuidor']} sin distrib.",
            $request->user()?->id, $liqId, null, null, $stats
        );

        return response()->json([
            'message' => "Operaciones generadas: {$stats['total']} total, {$stats['ok']} OK, {$stats['sin_tarifa']} sin tarifa, {$stats['sin_distribuidor']} sin distribuidor.",
            'data' => $stats,
        ]);
    }

    /**
     * GET /liq/oca/{liquidacionCliente}/historial
     */
    public function historial(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $query = LiqHistorialMovimiento::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->orderByDesc('created_at');

        if ($request->filled('persona_id')) {
            $query->where('persona_id', $request->integer('persona_id'));
        }
        if ($request->filled('evento')) {
            $query->where('evento', $request->string('evento'));
        }

        return response()->json(['data' => $query->limit(200)->get()]);
    }

    // ============ BUGFIX 19: Contratos OCA dinamicos + reproceso ============

    // GET /liq/oca/contratos
    public function listarContratos(Request $request): JsonResponse
    {
        $clienteId = $request->integer('cliente_id');
        if (!$clienteId) {
            $oca = \App\Models\LiqCliente::where('codigo_corto', 'OCA')->orWhere('nombre_corto', 'OCA')->first();
            $clienteId = $oca?->id;
        }
        if (!$clienteId) {
            return response()->json(['data' => []]);
        }

        $contratos = \App\Models\LiqContratoOca::where('cliente_id', $clienteId)
            ->orderBy('codigo')
            ->get();

        return response()->json(['data' => $contratos]);
    }

    // POST /liq/oca/contratos
    public function crearContrato(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cliente_id' => 'nullable|integer',
            'codigo' => 'required|string|max:10',
            'descripcion_cruda' => 'required|string|max:255',
            'descripcion_amigable' => 'required|string|max:100',
            'unidad_recorrido' => 'required|in:paquete,kilometros,horas,pickup,clearing,otro',
            'activo' => 'nullable|boolean',
        ]);

        $clienteId = $data['cliente_id'] ?? null;
        if (!$clienteId) {
            $oca = \App\Models\LiqCliente::where('codigo_corto', 'OCA')->orWhere('nombre_corto', 'OCA')->first();
            $clienteId = $oca?->id;
        }
        if (!$clienteId) {
            return response()->json(['error' => 'Cliente OCA no encontrado'], 422);
        }

        $contrato = \App\Models\LiqContratoOca::updateOrCreate(
            ['cliente_id' => $clienteId, 'codigo' => $data['codigo']],
            [
                'descripcion_cruda' => $data['descripcion_cruda'],
                'descripcion_amigable' => $data['descripcion_amigable'],
                'unidad_recorrido' => $data['unidad_recorrido'],
                'activo' => $data['activo'] ?? true,
            ]
        );

        return response()->json(['data' => $contrato, 'message' => 'Contrato guardado'], 201);
    }

    // PUT /liq/oca/contratos/{id}
    public function actualizarContrato(Request $request, int $id): JsonResponse
    {
        $contrato = \App\Models\LiqContratoOca::findOrFail($id);
        $data = $request->validate([
            'descripcion_amigable' => 'nullable|string|max:100',
            'unidad_recorrido' => 'nullable|in:paquete,kilometros,horas,pickup,clearing,otro',
            'activo' => 'nullable|boolean',
        ]);
        $contrato->update(array_filter($data, fn ($v) => $v !== null));
        return response()->json(['data' => $contrato]);
    }

    // DELETE /liq/oca/contratos/{id}
    public function eliminarContrato(int $id): JsonResponse
    {
        $contrato = \App\Models\LiqContratoOca::findOrFail($id);
        $contrato->delete();
        return response()->json(['message' => 'Contrato eliminado']);
    }

    // POST /liq/oca/{liquidacionCliente}/reprocesar
    // BUGFIX 19 Feature A3: reprocesa PDFs OCA ya subidos con los fixes nuevos
    public function reprocesar(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $archivos = LiqArchivoEntrada::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->whereIn('tipo_archivo', ['OCA_PRINCIPAL', 'OCA_DISTRIBUIDOR'])
            ->get();

        $main = $archivos->firstWhere('tipo_archivo', 'OCA_PRINCIPAL');
        $distribs = $archivos->where('tipo_archivo', 'OCA_DISTRIBUIDOR');

        if (!$main) {
            return response()->json(['error' => 'No se encontró PDF principal OCA en esta liquidación'], 422);
        }

        // Armar UploadedFile-like para reusar OcaClient
        $disk = $main->disk ?: 'local';
        $mainPath = \Storage::disk($disk)->path($main->ruta_storage);
        if (!file_exists($mainPath)) {
            return response()->json(['error' => 'Archivo PDF principal no existe en storage'], 422);
        }

        $mainUpload = new \Illuminate\Http\UploadedFile($mainPath, $main->nombre_original, 'application/pdf', null, true);
        $distribUploads = [];
        foreach ($distribs as $d) {
            $dp = \Storage::disk($d->disk ?: 'local')->path($d->ruta_storage);
            if (file_exists($dp)) {
                $distribUploads[] = new \Illuminate\Http\UploadedFile($dp, $d->nombre_original, 'application/pdf', null, true);
            }
        }

        $sucursal = $main->sucursal ?? '';

        try {
            // Borrar vinculaciones previas (reproceso)
            LiqVinculacionOca::where('liquidacion_cliente_id', $liquidacionCliente->id)->delete();

            $result = $this->ocaIngestService->procesar(
                liquidacion: $liquidacionCliente,
                archivoPrincipal: $main,
                archivosDistrib: $distribs->values()->all(),
                mainPdf: $mainUpload,
                distribPdfs: $distribUploads,
                sucursal: $sucursal,
            );

            LiqHistorialMovimiento::registrar(
                'reproceso_oca',
                'Reproceso tras fix de parser BUGFIX 19',
                $request->user()?->id, $liquidacionCliente->id, null, null, $result
            );

            return response()->json(['data' => $result, 'message' => 'Liquidación OCA reprocesada']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Error reprocesando: ' . $e->getMessage()], 500);
        }
    }

    /**
     * GET /liq/oca/health - Verifica estado del microservicio Python.
     */
    public function health(): JsonResponse
    {
        $available = $this->ocaClient->isAvailable();
        return response()->json([
            'available' => $available,
            'url' => config('services.oca.base_url'),
        ]);
    }
}

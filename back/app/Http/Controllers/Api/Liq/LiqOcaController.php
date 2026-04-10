<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqArchivoEntrada;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqLineaTarifa;
use App\Models\LiqLiquidacionCliente;
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

        $personas = Persona::where('tipo', 'transportista')
            ->where(function ($query) use ($q) {
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

        return response()->json([
            'message' => "Operaciones generadas: {$stats['total']} total, {$stats['ok']} OK, {$stats['sin_tarifa']} sin tarifa, {$stats['sin_distribuidor']} sin distribuidor.",
            'data' => $stats,
        ]);
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

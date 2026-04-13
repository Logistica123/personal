<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqConfigBanco;
use App\Models\LiqOrdenPago;
use App\Models\LiqOrdenPagoConcepto;
use App\Services\Liq\BeneficiarioResolver;
use App\Services\Liq\Banco\BancoTransferenciaService;
use App\Services\Liq\OrdenPagoService;
use App\Services\Liq\OrdenPagoPdfService;
use App\Services\Liq\PagosUnificadoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class LiqPagosController extends Controller
{
    public function __construct(
        private readonly OrdenPagoService $ordenPagoService,
        private readonly BeneficiarioResolver $beneficiarioResolver,
        private readonly BancoTransferenciaService $bancoService,
        private readonly OrdenPagoPdfService $pdfService,
        private readonly PagosUnificadoService $unificadoService,
    ) {
    }

    // =========================================================================
    // CONCEPTOS DE PAGO
    // =========================================================================

    // GET /api/liq/pagos/conceptos
    public function conceptos(): JsonResponse
    {
        $conceptos = LiqOrdenPagoConcepto::activo()
            ->orderBy('nombre')
            ->get(['id', 'nombre', 'codigo', 'ultimo_numero', 'activo']);

        return response()->json(['data' => $conceptos]);
    }

    // POST /api/liq/pagos/conceptos
    public function storeConcepto(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:100'],
            'codigo' => ['required', 'string', 'max:20', 'unique:liq_ordenes_pago_conceptos,codigo'],
        ]);

        $concepto = LiqOrdenPagoConcepto::create([
            'nombre'        => $validated['nombre'],
            'codigo'        => strtoupper($validated['codigo']),
            'ultimo_numero' => 0,
            'activo'        => true,
        ]);

        return response()->json([
            'message' => 'Concepto creado.',
            'data'    => $concepto,
        ], 201);
    }

    // PATCH /api/liq/pagos/conceptos/{concepto}
    public function updateConcepto(Request $request, LiqOrdenPagoConcepto $concepto): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => ['sometimes', 'string', 'max:100'],
            'activo' => ['sometimes', 'boolean'],
        ]);

        $concepto->update($validated);

        return response()->json(['data' => $concepto->fresh()]);
    }

    // GET /api/liq/pagos/conceptos/{concepto}/proximo-numero
    public function proximoNumero(LiqOrdenPagoConcepto $concepto): JsonResponse
    {
        return response()->json([
            'concepto_id'    => $concepto->id,
            'proximo_numero' => $concepto->proximoNumero(),
        ]);
    }

    // =========================================================================
    // LIQUIDACIONES DISPONIBLES PARA PAGO
    // =========================================================================

    // GET /api/liq/pagos/liquidaciones
    public function liquidaciones(Request $request): JsonResponse
    {
        $filtros = $request->only([
            'cliente_id', 'sucursal', 'distribuidor_id',
            'periodo_desde', 'periodo_hasta',
        ]);

        $items = $this->ordenPagoService->liquidacionesDisponibles($filtros);

        $data = $items->map(function ($liq) {
            $cliente = $liq->liquidacionCliente?->cliente;
            $dist = $liq->distribuidor;
            $opDetalle = $liq->ordenPagoDetalle;
            $op = $opDetalle?->ordenPago;

            return [
                'id'                  => $liq->id,
                'cliente_id'          => $liq->liquidacionCliente?->cliente_id,
                'cliente_nombre'      => $cliente?->nombre_corto ?? 'N/A',
                'sucursal'            => $liq->liquidacionCliente?->sucursal_tarifa ?? '',
                'periodo_desde'       => $liq->periodo_desde?->format('Y-m-d'),
                'periodo_hasta'       => $liq->periodo_hasta?->format('Y-m-d'),
                'distribuidor_id'     => $liq->distribuidor_id,
                'distribuidor_nombre' => $dist ? trim($dist->apellidos . ', ' . $dist->nombres) : 'N/A',
                'cobrador_nombre'     => $dist?->es_cobrador ? $dist->cobrador_nombre : null,
                'subtotal'            => $liq->subtotal,
                'gastos_administrativos' => $liq->gastos_administrativos,
                'total_a_pagar'       => $liq->total_a_pagar,
                'estado_liquidacion'  => $liq->estado,
                'estado_pago'         => $op ? $op->estado : null,
                'op_numero_display'   => $op ? $op->numero_display : null,
                'op_id'               => $op ? $op->id : null,
            ];
        });

        return response()->json(['data' => $data]);
    }

    // GET /api/liq/pagos/liquidaciones-unificado
    public function liquidacionesUnificado(Request $request): JsonResponse
    {
        $filtros = $request->only([
            'cliente_nombre', 'distribuidor', 'fuente', 'facturado', 'pagado', 'estado_liq',
            'mes', 'anio', 'quincena', 'medio_pago',
        ]);

        $data = $this->unificadoService->listarUnificado($filtros);

        // Extraer lista de clientes distintos para el dropdown
        $clientes = $data->pluck('cliente_nombre')->unique()->filter(fn ($c) => $c && $c !== 'N/A')->sort()->values();

        return response()->json([
            'data'     => $data,
            'clientes' => $clientes,
        ]);
    }

    // POST /api/liq/pagos/validar-beneficiarios
    public function validarBeneficiarios(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items'          => ['required', 'array', 'min:1'],
            'items.*.fuente' => ['required', Rule::in(['EXTRACTO', 'LEGACY'])],
            'items.*.fuente_id' => ['nullable', 'integer'],
            'items.*.archivo_id' => ['nullable', 'integer'],
            'items.*.persona_id' => ['required', 'integer'],
            'items.*.importe'    => ['required', 'numeric', 'min:0.01'],
        ]);

        $resultado = $this->beneficiarioResolver->validarUnificado($validated['items']);

        return response()->json($resultado);
    }

    // POST /api/liq/pagos/preview
    public function preview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'concepto_id'       => ['required', 'integer', 'exists:liq_ordenes_pago_conceptos,id'],
            'numero'            => ['nullable', 'integer', 'min:1'],
            'agrupacion'        => ['required', Rule::in(['INDIVIDUAL', 'GLOBAL'])],
            'liquidacion_ids'   => ['required', 'array', 'min:1'],
            'liquidacion_ids.*' => ['integer', 'exists:liq_liquidaciones_distribuidor,id'],
            'anio'              => ['nullable', 'integer', 'min:2020', 'max:2099'],
            'mes'               => ['nullable', 'integer', 'min:1', 'max:12'],
            'observaciones'     => ['nullable', 'string', 'max:5000'],
        ]);

        $concepto = LiqOrdenPagoConcepto::findOrFail($validated['concepto_id']);
        $resultado = $this->beneficiarioResolver->validar($validated['liquidacion_ids']);

        if (empty($resultado['validas'])) {
            return response()->json([
                'ordenes_preview' => [],
                'errores'         => $resultado['errores'],
            ]);
        }

        $agrupacion = $validated['agrupacion'];
        $numero = $validated['numero'] ?? $concepto->proximoNumero();
        $anio = $validated['anio'] ?? now()->year;
        $mes = $validated['mes'] ?? now()->month;

        $ordenesPreview = [];

        if ($agrupacion === 'INDIVIDUAL') {
            $grupos = $this->beneficiarioResolver->agruparPorBeneficiario($resultado['validas']);

            foreach ($grupos as $beneficiarioId => $liquidaciones) {
                $primerBenef = $liquidaciones->first();
                $detalles = $this->armarDetallesPreview($liquidaciones);
                $subtotal = collect($detalles)->sum('subtotal_liquidacion');
                $totalDescuentos = collect($detalles)->sum(fn ($d) => $d['gastos_admin'] + $d['descuento_combustible'] + $d['descuento_paquete'] + $d['descuento_ajuste'] + $d['otros_descuentos']);
                $totalAPagar = collect($detalles)->sum('importe_final');

                $ordenesPreview[] = [
                    'numero_display'    => LiqOrdenPago::formatNumeroDisplay($concepto->nombre, $numero),
                    'concepto'          => $concepto->nombre,
                    'anio'              => $anio,
                    'mes'               => $mes,
                    'beneficiario_tipo' => $primerBenef['beneficiario_tipo'],
                    'beneficiario_nombre' => $primerBenef['beneficiario_nombre'],
                    'beneficiario_cuil' => $primerBenef['beneficiario_cuil'],
                    'beneficiario_cbu'  => $primerBenef['beneficiario_cbu'],
                    'subtotal'          => round($subtotal, 2),
                    'total_descuentos'  => round($totalDescuentos, 2),
                    'total_a_pagar'     => round($totalAPagar, 2),
                    'cantidad_liquidaciones' => count($detalles),
                    'detalles'          => $detalles,
                ];

                $numero++;
            }
        } else {
            // GLOBAL
            $detalles = $this->armarDetallesPreview(collect($resultado['validas']));
            $primerBenef = $resultado['validas'][0];
            $subtotal = collect($detalles)->sum('subtotal_liquidacion');
            $totalDescuentos = collect($detalles)->sum(fn ($d) => $d['gastos_admin'] + $d['descuento_combustible'] + $d['descuento_paquete'] + $d['descuento_ajuste'] + $d['otros_descuentos']);
            $totalAPagar = collect($detalles)->sum('importe_final');

            $ordenesPreview[] = [
                'numero_display'    => LiqOrdenPago::formatNumeroDisplay($concepto->nombre, $numero),
                'concepto'          => $concepto->nombre,
                'anio'              => $anio,
                'mes'               => $mes,
                'beneficiario_tipo' => $primerBenef['beneficiario_tipo'],
                'beneficiario_nombre' => $primerBenef['beneficiario_nombre'],
                'beneficiario_cuil' => $primerBenef['beneficiario_cuil'],
                'beneficiario_cbu'  => $primerBenef['beneficiario_cbu'],
                'subtotal'          => round($subtotal, 2),
                'total_descuentos'  => round($totalDescuentos, 2),
                'total_a_pagar'     => round($totalAPagar, 2),
                'cantidad_liquidaciones' => count($detalles),
                'detalles'          => $detalles,
            ];
        }

        return response()->json([
            'ordenes_preview' => $ordenesPreview,
            'errores'         => $resultado['errores'],
        ]);
    }

    /**
     * Arma el desglose de cada liquidacion para el preview.
     */
    private function armarDetallesPreview(\Illuminate\Support\Collection $validas): array
    {
        $detalles = [];

        foreach ($validas as $v) {
            $liqDist = \App\Models\LiqLiquidacionDistribuidor::with([
                'liquidacionCliente.cliente:id,nombre_corto',
                'distribuidor:id,apellidos,nombres,es_cobrador,cobrador_nombre',
            ])->find($v['liquidacion_id']);

            if (!$liqDist) continue;

            $clienteNombre = $liqDist->liquidacionCliente?->cliente?->nombre_corto ?? 'N/A';
            $sucursal = $liqDist->liquidacionCliente?->sucursal_tarifa ?? 'N/A';
            $periodoDesde = $liqDist->periodo_desde?->format('Y-m');
            $periodoHasta = $liqDist->periodo_hasta?->format('Y-m');
            $periodo = $periodoDesde === $periodoHasta ? $periodoDesde : "{$periodoDesde} a {$periodoHasta}";

            $subtotalLiq = (float) $liqDist->subtotal;
            $gastosAdmin = (float) $liqDist->gastos_administrativos;
            $importeFinal = (float) $liqDist->total_a_pagar;

            // Buscar descuentos en archivos
            $descCombustible = $this->buscarDescuentoArchivo($liqDist->distribuidor_id, 'DESCUENTO_COMBUSTIBLE', $liqDist);
            $descPaquete = $this->buscarDescuentoArchivo($liqDist->distribuidor_id, 'DESCUENTO_PAQUETE', $liqDist);
            $descAjuste = $this->buscarDescuentoArchivo($liqDist->distribuidor_id, 'AJUSTE_LIQUIDACION', $liqDist);

            $cobradorNombre = $v['beneficiario_tipo'] === 'COBRADOR' ? $v['beneficiario_nombre'] : null;

            $detalles[] = [
                'liquidacion_id'     => $liqDist->id,
                'cliente_nombre'     => $clienteNombre,
                'sucursal'           => $sucursal,
                'periodo'            => $periodo,
                'distribuidor_nombre' => $v['distribuidor_nombre'],
                'cobrador_nombre'    => $cobradorNombre,
                'beneficiario_cuil'  => $v['beneficiario_cuil'],
                'beneficiario_cbu'   => $v['beneficiario_cbu'],
                'subtotal_liquidacion' => $subtotalLiq,
                'gastos_admin'       => $gastosAdmin,
                'descuento_combustible' => $descCombustible,
                'descuento_paquete'  => $descPaquete,
                'descuento_ajuste'   => $descAjuste,
                'otros_descuentos'   => 0,
                'importe_final'      => $importeFinal,
            ];
        }

        return $detalles;
    }

    /**
     * Busca importe de un descuento específico en la tabla archivos.
     */
    private function buscarDescuentoArchivo(int $personaId, string $tipoArchivo, \App\Models\LiqLiquidacionDistribuidor $liqDist): float
    {
        $archivo = \App\Models\Archivo::where('persona_id', $personaId)
            ->whereHas('tipo', fn ($q) => $q->where('nombre', $tipoArchivo))
            ->where(function ($q) use ($liqDist) {
                $q->where('liquidacion_id', $liqDist->id)
                  ->orWhere('fortnight_key', 'like', $liqDist->periodo_desde?->format('Y-m') . '%');
            })
            ->first();

        if ($archivo && $archivo->importe_facturar) {
            return (float) $archivo->importe_facturar;
        }

        return 0;
    }

    // =========================================================================
    // ORDENES DE PAGO
    // =========================================================================

    // GET /api/liq/pagos/ordenes
    public function ordenes(Request $request): JsonResponse
    {
        $query = LiqOrdenPago::with(['concepto:id,nombre,codigo', 'usuario:id,name'])
            ->orderByDesc('created_at');

        if ($request->filled('concepto_id')) {
            $query->byConcepto($request->integer('concepto_id'));
        }
        if ($request->filled('anio')) {
            $query->where('anio', $request->integer('anio'));
        }
        if ($request->filled('mes')) {
            $query->where('mes', $request->integer('mes'));
        }
        if ($request->filled('estado')) {
            $query->byEstado($request->input('estado'));
        }

        $ordenes = $query->get();

        return response()->json([
            'data' => $ordenes->map(fn (LiqOrdenPago $op) => [
                'id'                => $op->id,
                'concepto'          => $op->concepto?->nombre,
                'concepto_codigo'   => $op->concepto?->codigo,
                'numero'            => $op->numero,
                'numero_display'    => $op->numero_display,
                'anio'              => $op->anio,
                'mes'               => $op->mes,
                'fecha_emision'     => $op->fecha_emision?->format('d/m/Y'),
                'beneficiario_tipo' => $op->beneficiario_tipo,
                'beneficiario_nombre' => $op->beneficiario_nombre,
                'total_a_pagar'     => $op->total_a_pagar,
                'estado'            => $op->estado,
                'agrupacion'        => $op->agrupacion,
                'usuario'           => $op->usuario?->name,
                'created_at'        => $op->created_at?->format('d/m/Y H:i'),
            ]),
        ]);
    }

    // POST /api/liq/pagos/ordenes
    public function storeOrden(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'concepto_id'        => ['required', 'integer', 'exists:liq_ordenes_pago_conceptos,id'],
            'numero'             => ['nullable', 'integer', 'min:1'],
            'agrupacion'         => ['required', Rule::in(['INDIVIDUAL', 'GLOBAL'])],
            'items'              => ['required', 'array', 'min:1'],
            'items.*.fuente'     => ['required', Rule::in(['EXTRACTO', 'LEGACY'])],
            'items.*.fuente_id'  => ['nullable', 'integer'],
            'items.*.archivo_id' => ['nullable', 'integer'],
            'items.*.persona_id' => ['required', 'integer'],
            'items.*.importe'    => ['required', 'numeric', 'min:0.01'],
            'anio'               => ['nullable', 'integer', 'min:2020', 'max:2099'],
            'mes'                => ['nullable', 'integer', 'min:1', 'max:12'],
            'observaciones'      => ['nullable', 'string', 'max:5000'],
        ]);

        $validated['usuario_id'] = $request->user()?->id;

        try {
            $resultado = $this->ordenPagoService->crear($validated);

            $ordenes = collect($resultado['ordenes'])->map(fn (LiqOrdenPago $op) => [
                'id'              => $op->id,
                'numero_display'  => $op->numero_display,
                'total_a_pagar'   => $op->total_a_pagar,
                'estado'          => $op->estado,
                'cant_detalles'   => $op->detalles->count(),
            ]);

            return response()->json([
                'message'  => count($resultado['ordenes']) . ' orden(es) de pago creada(s).',
                'ordenes'  => $ordenes,
                'errores'  => $resultado['errores'],
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    // GET /api/liq/pagos/ordenes/{ordenPago}
    public function showOrden(LiqOrdenPago $ordenPago): JsonResponse
    {
        return response()->json([
            'data' => $this->ordenPagoService->resumen($ordenPago),
        ]);
    }

    // GET /api/liq/pagos/ordenes/{ordenPago}/resumen
    public function resumenOrden(LiqOrdenPago $ordenPago): JsonResponse
    {
        return response()->json([
            'data' => $this->ordenPagoService->resumen($ordenPago),
        ]);
    }

    // PATCH /api/liq/pagos/ordenes/{ordenPago}/estado
    public function cambiarEstado(Request $request, LiqOrdenPago $ordenPago): JsonResponse
    {
        $validated = $request->validate([
            'accion' => ['required', Rule::in(['confirmar', 'anular'])],
        ]);

        try {
            if ($validated['accion'] === 'confirmar') {
                $op = $this->ordenPagoService->confirmar($ordenPago);
            } else {
                $op = $this->ordenPagoService->anular($ordenPago);
            }

            return response()->json([
                'message' => 'Estado actualizado a ' . $op->estado,
                'data'    => ['id' => $op->id, 'estado' => $op->estado],
            ]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    // DELETE /api/liq/pagos/ordenes/{ordenPago}
    public function destroyOrden(LiqOrdenPago $ordenPago): JsonResponse
    {
        try {
            $this->ordenPagoService->eliminar($ordenPago);

            return response()->json(['message' => 'Orden de pago eliminada.']);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    // =========================================================================
    // TRANSFERENCIAS BANCARIAS
    // =========================================================================

    // POST /api/liq/pagos/ordenes/{ordenPago}/ejecutar-pago
    public function ejecutarPago(Request $request, LiqOrdenPago $ordenPago): JsonResponse
    {
        try {
            $transferencia = $this->bancoService->ejecutarPago(
                $ordenPago,
                $request->user()?->id ?? 0,
            );

            return response()->json([
                'message'       => 'Transferencia procesada.',
                'transferencia' => [
                    'id'               => $transferencia->id,
                    'estado_ws'        => $transferencia->estado_ws,
                    'banco_referencia'  => $transferencia->banco_referencia,
                    'mensaje_respuesta' => $transferencia->mensaje_respuesta,
                    'importe'          => $transferencia->importe,
                ],
                'op_estado' => $ordenPago->fresh()->estado,
            ]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    // GET /api/liq/pagos/ordenes/{ordenPago}/transferencias
    public function transferencias(LiqOrdenPago $ordenPago): JsonResponse
    {
        $transferencias = $ordenPago->transferencias()
            ->with('usuario:id,name')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($t) => [
                'id'                 => $t->id,
                'banco_referencia'   => $t->banco_referencia,
                'cbu_origen'         => $t->cbu_origen,
                'cbu_destino'        => $t->cbu_destino,
                'cuil_destino'       => $t->cuil_destino,
                'importe'            => $t->importe,
                'concepto_bancario'  => $t->concepto_bancario,
                'estado_ws'          => $t->estado_ws,
                'codigo_respuesta'   => $t->codigo_respuesta,
                'mensaje_respuesta'  => $t->mensaje_respuesta,
                'intentos'           => $t->intentos,
                'fecha_envio'        => $t->fecha_envio?->format('d/m/Y H:i'),
                'fecha_confirmacion' => $t->fecha_confirmacion?->format('d/m/Y H:i'),
                'usuario'            => $t->usuario?->name,
            ]);

        return response()->json(['data' => $transferencias]);
    }

    // POST /api/liq/pagos/ordenes/{ordenPago}/reintentar
    public function reintentar(Request $request, LiqOrdenPago $ordenPago): JsonResponse
    {
        try {
            $transferencia = $this->bancoService->reintentar(
                $ordenPago,
                $request->user()?->id ?? 0,
            );

            return response()->json([
                'message'       => 'Reintento procesado.',
                'transferencia' => [
                    'id'               => $transferencia->id,
                    'estado_ws'        => $transferencia->estado_ws,
                    'banco_referencia'  => $transferencia->banco_referencia,
                    'intentos'         => $transferencia->intentos,
                ],
                'op_estado' => $ordenPago->fresh()->estado,
            ]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    // =========================================================================
    // CONFIGURACION BANCARIA
    // =========================================================================

    // GET /api/liq/pagos/config-banco
    public function configBanco(): JsonResponse
    {
        $config = LiqConfigBanco::activa();

        if (!$config) {
            return response()->json(['data' => null]);
        }

        return response()->json([
            'data' => [
                'id'                => $config->id,
                'nombre_banco'      => $config->nombre_banco,
                'url_base'          => $config->url_base,
                'cbu_empresa'       => $config->cbu_empresa,
                'cuil_empresa'      => $config->cuil_empresa,
                'timeout_segundos'  => $config->timeout_segundos,
                'modo'              => $config->modo,
                'activo'            => $config->activo,
                'tiene_certificado' => !empty($config->certificado_path),
            ],
        ]);
    }

    // PUT /api/liq/pagos/config-banco
    public function updateConfigBanco(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre_banco'          => ['required', 'string', 'max:100'],
            'url_base'              => ['required', 'string', 'max:500'],
            'certificado_path'      => ['nullable', 'string', 'max:500'],
            'certificado_password'  => ['nullable', 'string', 'max:200'],
            'cbu_empresa'           => ['required', 'string', 'size:22'],
            'cuil_empresa'          => ['required', 'string', 'max:13'],
            'timeout_segundos'      => ['nullable', 'integer', 'min:5', 'max:120'],
            'modo'                  => ['required', Rule::in(['PRODUCCION', 'TESTING'])],
            'activo'                => ['required', 'boolean'],
        ]);

        // Desactivar cualquier config activa previa
        if ($validated['activo']) {
            LiqConfigBanco::where('activo', true)->update(['activo' => false]);
        }

        $config = LiqConfigBanco::first();

        if ($config) {
            $config->update($validated);
        } else {
            $config = LiqConfigBanco::create($validated);
        }

        return response()->json([
            'message' => 'Configuración bancaria actualizada.',
            'data'    => ['id' => $config->id, 'modo' => $config->modo, 'activo' => $config->activo],
        ]);
    }

    // POST /api/liq/pagos/config-banco/test
    public function testConfigBanco(): JsonResponse
    {
        try {
            $ok = $this->bancoService->testConexion();

            return response()->json([
                'ok'      => $ok,
                'message' => $ok ? 'Conexión exitosa al WS del banco.' : 'No se pudo conectar.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'ok'      => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    // =========================================================================
    // FACTURA DEL DISTRIBUIDOR
    // =========================================================================

    // GET /api/liq/pagos/factura-distribuidor/{personaId}
    // Query params: ?liquidacion_id=XX (archivo_id de la liquidación padre)
    public function facturaDistribuidor(Request $request, int $personaId)
    {
        \App\Models\Persona::findOrFail($personaId);
        $liquidacionArchivoId = $request->integer('liquidacion_id');

        if (!$liquidacionArchivoId) {
            return response()->json(['message' => 'Se requiere liquidacion_id para buscar la factura del periodo.'], 422);
        }

        // Tipos a excluir (documentos internos de la agencia, no facturas del distribuidor)
        $tiposExcluir = \App\Models\FileType::whereIn('nombre', [
            'DESCUENTO_COMBUSTIBLE', 'AJUSTE_LIQUIDACION', 'Factura combustible',
        ])->pluck('id')->all();

        // ESTRATEGIA 1: Buscar documento HIJO de ESTA liquidación específica
        $facturaHijo = \App\Models\Archivo::where('parent_document_id', $liquidacionArchivoId)
            ->whereNotIn('tipo_archivo_id', $tiposExcluir)
            ->orderByDesc('created_at')
            ->first();

        if ($facturaHijo) {
            return $this->servirArchivoInline($facturaHijo);
        }

        // ESTRATEGIA 2: Buscar factura IA APROBADA vinculada a ESTA liquidación específica
        $facturaIa = \App\Models\Factura::where('liquidacion_id', $liquidacionArchivoId)
            ->where('estado', 'aprobada')
            ->orderByDesc('created_at')
            ->first();

        if ($facturaIa && $facturaIa->archivo_path) {
            $disk = $facturaIa->archivo_disk ?: 'public';
            $path = $facturaIa->archivo_path;

            if ($path && \Illuminate\Support\Facades\Storage::disk($disk)->exists($path)) {
                $filename = 'factura_' . ($facturaIa->numero_factura ?? $facturaIa->id) . '.pdf';
                return response(\Illuminate\Support\Facades\Storage::disk($disk)->get($path), 200, [
                    'Content-Type'        => 'application/pdf',
                    'Content-Disposition' => "inline; filename=\"{$filename}\"",
                ]);
            }
        }

        // NUNCA devolver el padre. 404 si no hay factura para este periodo.
        return response()->json([
            'message'        => 'No existe factura del distribuidor para esta liquidacion.',
            'liquidacion_id' => $liquidacionArchivoId,
        ], 404);
    }

    /**
     * Sirve un Archivo con Content-Disposition: inline para visualizar en el navegador.
     */
    private function servirArchivoInline(\App\Models\Archivo $archivo)
    {
        $disk = $archivo->disk ?: 'local';
        $path = $archivo->ruta;

        if (!$path || !\Illuminate\Support\Facades\Storage::disk($disk)->exists($path)) {
            if ($archivo->download_url) {
                return redirect($archivo->download_url);
            }
            return response()->json(['message' => 'Archivo no encontrado en storage.'], 404);
        }

        $mime = $archivo->mime ?: 'application/pdf';
        $filename = $archivo->nombre_original ?: 'factura.pdf';

        return response(\Illuminate\Support\Facades\Storage::disk($disk)->get($path), 200, [
            'Content-Type'        => $mime,
            'Content-Disposition' => "inline; filename=\"{$filename}\"",
        ]);
    }

    // =========================================================================
    // EXPORTAR
    // =========================================================================

    // GET /api/liq/pagos/liquidaciones/exportar
    public function exportarLiquidaciones(Request $request)
    {
        $filtros = $request->only(['cliente_id', 'sucursal', 'distribuidor_id', 'periodo_desde', 'periodo_hasta']);
        $items = $this->ordenPagoService->liquidacionesDisponibles($filtros);

        $fmtNum = fn ($v) => number_format((float) $v, 2, ',', '.');

        $header = implode(';', [
            'Cliente', 'Sucursal', 'Periodo', 'Distribuidor', 'Cobrador',
            'Subtotal', 'Gastos Admin', 'A Pagar', 'Estado Liq.', 'Estado Pago', 'OP',
        ]);
        $lines = [$header];

        foreach ($items as $liq) {
            $dist = $liq->distribuidor;
            $opDetalle = $liq->ordenPagoDetalle;
            $op = $opDetalle?->ordenPago;

            $lines[] = implode(';', [
                $liq->liquidacionCliente?->cliente?->nombre_corto ?? '',
                $liq->liquidacionCliente?->sucursal_tarifa ?? '',
                $liq->periodo_desde?->format('Y-m') ?? '',
                $dist ? trim($dist->apellidos . ', ' . $dist->nombres) : '',
                $dist?->es_cobrador ? ($dist->cobrador_nombre ?? '') : '',
                $fmtNum($liq->subtotal),
                $fmtNum($liq->gastos_administrativos),
                $fmtNum($liq->total_a_pagar),
                $liq->estado,
                $op?->estado ?? 'Sin OP',
                $op?->numero_display ?? '',
            ]);
        }

        return response(implode("\r\n", $lines), 200, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="liquidaciones_pagos_' . now()->format('Ymd_His') . '.csv"',
        ]);
    }

    // GET /api/liq/pagos/ordenes/exportar
    public function exportarOrdenes(Request $request)
    {
        $query = LiqOrdenPago::with(['concepto:id,nombre', 'usuario:id,name'])
            ->orderByDesc('created_at');

        if ($request->filled('concepto_id')) {
            $query->byConcepto($request->integer('concepto_id'));
        }
        if ($request->filled('estado')) {
            $query->byEstado($request->input('estado'));
        }

        $ordenes = $query->get();

        $fmtNum = fn ($v) => number_format((float) $v, 2, ',', '.');
        $meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        $header = implode(';', [
            'Numero', 'Concepto', 'Periodo', 'Beneficiario', 'Tipo', 'CUIL', 'CBU',
            'Subtotal', 'Descuentos', 'Total a Pagar', 'Estado', 'Agrupacion', 'Usuario', 'Fecha',
        ]);
        $lines = [$header];

        foreach ($ordenes as $op) {
            $lines[] = implode(';', [
                $op->numero_display,
                $op->concepto?->nombre ?? '',
                ($meses[$op->mes] ?? '') . ' ' . $op->anio,
                str_replace(';', ',', $op->beneficiario_nombre),
                $op->beneficiario_tipo,
                $op->beneficiario_cuil,
                $op->beneficiario_cbu,
                $fmtNum($op->subtotal),
                $fmtNum($op->total_descuentos),
                $fmtNum($op->total_a_pagar),
                $op->estado,
                $op->agrupacion,
                $op->usuario?->name ?? '',
                $op->created_at?->format('d/m/Y H:i') ?? '',
            ]);
        }

        return response(implode("\r\n", $lines), 200, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="ordenes_pago_' . now()->format('Ymd_His') . '.csv"',
        ]);
    }

    // =========================================================================
    // PDF
    // =========================================================================

    // GET /api/liq/pagos/ordenes/{ordenPago}/pdf
    public function descargarPdf(LiqOrdenPago $ordenPago): Response
    {
        $pdfContent = $this->pdfService->renderPdf($ordenPago);

        $filename = str_replace(' ', '_', $ordenPago->numero_display) . '.pdf';

        return response($pdfContent, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => "inline; filename=\"{$filename}\"",
        ]);
    }
}

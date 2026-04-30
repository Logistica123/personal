<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\FacturaCabecera;
use App\Models\LiqCliente;
use App\Models\LiqEstadoCuentaCliente;
use App\Models\LiqJurisdiccionSucursal;
use App\Models\Sucursal;
use App\Services\Facturacion\FacturaDraftService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class LiqEstadoCuentaController extends Controller
{
    public function __construct(
        private readonly FacturaDraftService $draftService,
    ) {
    }

    // -------------------------------------------------------------------------
    // GET /api/liq/estado-cuenta
    // -------------------------------------------------------------------------

    public function index(Request $request): JsonResponse
    {
        $query = LiqEstadoCuentaCliente::query()
            ->with(['cliente:id,nombre_corto,razon_social,cuit', 'usuario:id,name']);

        if ($request->filled('cliente_id')) {
            $query->where('cliente_id', $request->integer('cliente_id'));
        }
        if ($request->filled('sucursal')) {
            $query->where('sucursal', $request->input('sucursal'));
        }
        if ($request->filled('periodo')) {
            $query->where('periodo', $request->input('periodo'));
        }
        if ($request->filled('estado')) {
            $query->where('estado', $request->input('estado'));
        }
        if ($request->filled('tipo_comprobante')) {
            $query->where('tipo_comprobante', $request->input('tipo_comprobante'));
        }

        $rows = $query->orderByDesc('created_at')->get();

        return response()->json([
            'data' => $rows->map(fn (LiqEstadoCuentaCliente $row) => $this->serializeRow($row)),
        ]);
    }

    // -------------------------------------------------------------------------
    // POST /api/liq/estado-cuenta  (manual: NC / ND)
    // -------------------------------------------------------------------------

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cliente_id'       => ['required', 'integer', 'exists:liq_clientes,id'],
            'sucursal'         => ['required', 'string', 'max:100'],
            'jurisdiccion_id'  => ['nullable', 'integer', 'between:901,924'],
            'periodo'          => ['required', 'string', 'max:10'],
            'quincena'         => ['required', Rule::in(['MC', 'Q1', 'Q2'])],
            'neto_gravado'     => ['required', 'numeric'],
            'no_gravado'       => ['nullable', 'numeric'],
            'observaciones'    => ['nullable', 'string', 'max:5000'],
            'tipo_comprobante' => ['required', Rule::in(['FA', 'NC', 'ND'])],
        ]);

        $netoGravado = (float) $validated['neto_gravado'];
        $noGravado = (float) ($validated['no_gravado'] ?? 0);
        $iva = round($netoGravado * 0.21, 2);
        $importeACobrar = round($netoGravado + $noGravado + $iva, 2);

        $row = LiqEstadoCuentaCliente::create([
            ...$validated,
            'no_gravado'       => $noGravado,
            'iva'              => $iva,
            'importe_a_cobrar' => $importeACobrar,
            'estado'           => LiqEstadoCuentaCliente::ESTADO_PENDIENTE,
            'usuario_id'       => $request->user()?->id,
        ]);

        return response()->json([
            'message' => 'Fila creada correctamente.',
            'data'    => $this->serializeRow($row),
        ], 201);
    }

    // -------------------------------------------------------------------------
    // GET /api/liq/estado-cuenta/{id}
    // -------------------------------------------------------------------------

    public function show(LiqEstadoCuentaCliente $estadoCuenta): JsonResponse
    {
        $estadoCuenta->load(['cliente:id,nombre_corto,razon_social,cuit', 'factura', 'usuario:id,name']);

        return response()->json(['data' => $this->serializeRow($estadoCuenta)]);
    }

    // -------------------------------------------------------------------------
    // PATCH /api/liq/estado-cuenta/{id}  (solo PENDIENTE)
    // -------------------------------------------------------------------------

    public function update(Request $request, LiqEstadoCuentaCliente $estadoCuenta): JsonResponse
    {
        if (! $estadoCuenta->esPendiente()) {
            return response()->json(['message' => 'Solo se pueden editar filas en estado PENDIENTE.'], 422);
        }

        $validated = $request->validate([
            'jurisdiccion_id'  => ['nullable', 'integer', 'between:901,924'],
            'neto_gravado'     => ['nullable', 'numeric'],
            'no_gravado'       => ['nullable', 'numeric'],
            'observaciones'    => ['nullable', 'string', 'max:5000'],
            'tipo_comprobante' => ['nullable', Rule::in(['FA', 'NC', 'ND'])],
        ]);

        if (isset($validated['neto_gravado'])) {
            $netoGravado = (float) $validated['neto_gravado'];
            $noGravado = (float) ($validated['no_gravado'] ?? $estadoCuenta->no_gravado);
            $validated['iva'] = round($netoGravado * 0.21, 2);
            $validated['importe_a_cobrar'] = round($netoGravado + $noGravado + $validated['iva'], 2);
        }

        if (isset($validated['jurisdiccion_id'])) {
            LiqJurisdiccionSucursal::updateOrCreate(
                ['cliente_id' => $estadoCuenta->cliente_id, 'sucursal' => $estadoCuenta->sucursal],
                [
                    'jurisdiccion_id'     => $validated['jurisdiccion_id'],
                    'jurisdiccion_nombre' => LiqJurisdiccionSucursal::nombreJurisdiccion($validated['jurisdiccion_id']) ?? '',
                ]
            );
        }

        $estadoCuenta->update($validated);

        return response()->json([
            'message' => 'Fila actualizada.',
            'data'    => $this->serializeRow($estadoCuenta->fresh()),
        ]);
    }

    // -------------------------------------------------------------------------
    // DELETE /api/liq/estado-cuenta/{id}  (solo PENDIENTE, sin factura)
    // -------------------------------------------------------------------------

    public function destroy(LiqEstadoCuentaCliente $estadoCuenta): JsonResponse
    {
        if (! $estadoCuenta->esPendiente()) {
            return response()->json(['message' => 'Solo se pueden eliminar filas PENDIENTES.'], 422);
        }

        if ($estadoCuenta->factura_id) {
            return response()->json(['message' => 'No se puede eliminar una fila con factura asociada.'], 422);
        }

        $estadoCuenta->delete();

        return response()->json(['message' => 'Fila eliminada.']);
    }

    // -------------------------------------------------------------------------
    // POST /api/liq/estado-cuenta/{id}/facturar
    // Crea borrador de factura precargado y devuelve la factura.
    // -------------------------------------------------------------------------

    public function facturar(Request $request, LiqEstadoCuentaCliente $estadoCuenta): JsonResponse
    {
        if (! $estadoCuenta->esPendiente()) {
            return response()->json(['message' => 'Esta fila ya fue facturada.'], 422);
        }

        if (! $estadoCuenta->jurisdiccion_id) {
            return response()->json([
                'message' => 'Debe asignar una jurisdiccion a la sucursal antes de facturar.',
                'require_jurisdiccion' => true,
            ], 422);
        }

        $liqCliente = LiqCliente::find($estadoCuenta->cliente_id);
        if (! $liqCliente || ! $liqCliente->distriapp_cliente_id) {
            return response()->json(['message' => 'No se encontro el cliente de facturacion.'], 422);
        }

        $cliente = Cliente::find($liqCliente->distriapp_cliente_id);
        if (! $cliente) {
            return response()->json(['message' => 'Cliente no encontrado en DistriApp.'], 422);
        }

        // BUGFIX: usar la sucursal cuyo nombre coincida con el Estado de Cuenta;
        //   si no hay match (cliente DistriApp sin esa sucursal), fallback a la primera.
        //   Antes siempre tomaba la primera → mostraba "Mendoza" en facturas de Posadas.
        $sucursal = Sucursal::where('cliente_id', $cliente->id)
            ->where('nombre', $estadoCuenta->sucursal)
            ->first()
            ?? Sucursal::where('cliente_id', $cliente->id)
                ->whereRaw('LOWER(nombre) = ?', [mb_strtolower($estadoCuenta->sucursal)])
                ->first()
            ?? Sucursal::where('cliente_id', $cliente->id)->first();

        // Resolver fechas del periodo
        [$periodoDesde, $periodoHasta] = $this->parsePeriodo($estadoCuenta->periodo, $estadoCuenta->quincena);
        [$anio, $mes] = $this->parseAnioMes($estadoCuenta->periodo);
        $periodoFacturado = match ($estadoCuenta->quincena) {
            'Q1'    => 'PRIMERA_QUINCENA',
            'Q2'    => 'SEGUNDA_QUINCENA',
            default => 'MES_COMPLETO',
        };

        $netoGravado = (float) $estadoCuenta->neto_gravado;
        $noGravado = (float) $estadoCuenta->no_gravado;
        $iva = (float) $estadoCuenta->iva;
        $total = (float) $estadoCuenta->importe_a_cobrar;

        $jurisdiccionNombre = LiqJurisdiccionSucursal::nombreJurisdiccion((int) $estadoCuenta->jurisdiccion_id) ?? '';

        // Formato OCASA: "Por servicios prestados en {Mes} {Año} {Sucursal} . Acreedor 102008890.-"
        // (ID SAP del cliente OCASA en sus PDFs originales = 102008890)
        $mesesEs = [
            1 => 'Enero', 2 => 'Febrero', 3 => 'Marzo', 4 => 'Abril',
            5 => 'Mayo', 6 => 'Junio', 7 => 'Julio', 8 => 'Agosto',
            9 => 'Septiembre', 10 => 'Octubre', 11 => 'Noviembre', 12 => 'Diciembre',
        ];
        $mesNombre = $mesesEs[(int) $mes] ?? $mes;
        $descripcionGravado = "Por servicios prestados en {$mesNombre} {$anio} {$estadoCuenta->sucursal} . Acreedor 102008890.-";
        $descripcionNoGravado = 'Imp no gravado';
        // Mantengo $descripcion (IIBB ...) para `observaciones_cobranza` en cabecera ARCA;
        // el detalle_pdf usa siempre el formato nuevo OCASA.
        $descripcion = "IIBB {$estadoCuenta->jurisdiccion_id} - {$estadoCuenta->sucursal} - {$estadoCuenta->periodo}";

        $emisor = \App\Models\ArcaEmisor::where('activo', true)->first();
        if (! $emisor) {
            return response()->json(['message' => 'No hay un emisor ARCA activo configurado.'], 422);
        }

        $ptoVta = config('services.arca.pto_venta_default', 11);

        // BUGFIX OCASA gravado/no gravado:
        //   - detalle_pdf con 2 items cuando noGravado > 0 (item gravado 21% + item no gravado 0%)
        //   - bloque `iva` solo lleva alícuotas > 0 (ARCA WSFE rechaza filas con importe=0;
        //     el no_gravado se transmite por imp_tot_conc en la cabecera)
        $detallePdf = [[
            'orden'            => 1,
            'descripcion'      => $descripcionGravado,
            'cantidad'         => 1,
            'unidad_medida'    => 'Otras unidades',
            'precio_unitario'  => $netoGravado,
            'bonificacion_pct' => 0,
            'subtotal'         => $netoGravado,
            'alicuota_iva_pct' => 21,
            'subtotal_con_iva' => round($netoGravado + $iva, 2),
        ]];

        if ($noGravado > 0) {
            $detallePdf[] = [
                'orden'            => 2,
                'descripcion'      => $descripcionNoGravado,
                'cantidad'         => 1,
                'unidad_medida'    => 'Otras unidades',
                'precio_unitario'  => $noGravado,
                'bonificacion_pct' => 0,
                'subtotal'         => $noGravado,
                'alicuota_iva_pct' => 0,
                'subtotal_con_iva' => $noGravado,
            ];
        }

        $payload = [
            'emisor_id'         => $emisor->id,
            'ambiente'          => 'PROD',
            'pto_vta'           => $ptoVta,
            'cbte_tipo'         => $estadoCuenta->mapCbteTipo(),
            'concepto'          => 2,
            'doc_tipo'          => 80,
            'doc_nro'           => $cliente->documento_fiscal ?? $liqCliente->cuit,
            'cliente_id'        => $cliente->id,
            'sucursal_id'       => $sucursal?->id ?? $cliente->id,
            'cliente_nombre'    => $cliente->nombre ?? $liqCliente->razon_social,
            'fecha_cbte'        => now()->format('Y-m-d'),
            'fecha_serv_desde'  => $periodoDesde?->format('Y-m-d'),
            'fecha_serv_hasta'  => $periodoHasta?->format('Y-m-d'),
            'fecha_vto_pago'    => now()->addDays(30)->format('Y-m-d'),
            'condiciones_venta' => ['CUENTA_CORRIENTE'],
            'moneda_id'         => 'PES',
            'moneda_cotiz'      => 1,
            'imp_total'         => $total,
            'imp_tot_conc'      => $noGravado,
            'imp_neto'          => $netoGravado,
            'imp_op_ex'         => 0,
            'imp_iva'           => $iva,
            'imp_trib'          => 0,
            'anio_facturado'    => $anio,
            'mes_facturado'     => $mes,
            'periodo_facturado' => $periodoFacturado,
            'fecha_aprox_cobro' => now()->addDays(30)->format('Y-m-d'),
            'observaciones_cobranza' => $descripcion,
            'detalle_pdf'       => $detallePdf,
            'iva' => [
                [
                    'iva_id'   => 5,
                    'base_imp' => $netoGravado,
                    'importe'  => $iva,
                ],
            ],
        ];

        // NC/ND requieren comprobante asociado
        if ($estadoCuenta->tipo_comprobante !== LiqEstadoCuentaCliente::TIPO_FA) {
            $request->validate([
                'cbte_asoc_tipo'    => ['required', 'integer'],
                'cbte_asoc_pto_vta' => ['required', 'integer'],
                'cbte_asoc_numero'  => ['required', 'integer'],
                'cbte_asoc_fecha'   => ['nullable', 'date'],
            ]);

            $payload['cbtes_asoc'] = [[
                'cbte_tipo'      => $request->integer('cbte_asoc_tipo'),
                'pto_vta'        => $request->integer('cbte_asoc_pto_vta'),
                'cbte_numero'    => $request->integer('cbte_asoc_numero'),
                'fecha_emision'  => $request->input('cbte_asoc_fecha'),
            ]];
        }

        // Devolver los datos precargados para que el frontend redirija a /facturacion/nueva
        // Ya NO crea borrador directamente — el usuario lo crea/emite desde la pantalla de facturación
        return response()->json([
            'message'            => 'Datos de factura preparados. Redirigiendo al facturador.',
            'redirect'           => '/facturacion/nueva',
            'estado_cuenta_id'   => $estadoCuenta->id,
            'prefill'            => $payload,
            'data'               => $this->serializeRow($estadoCuenta->fresh()),
        ]);
    }

    // -------------------------------------------------------------------------
    // POST /api/liq/estado-cuenta/{id}/cobrar
    // -------------------------------------------------------------------------

    public function cobrar(Request $request, LiqEstadoCuentaCliente $estadoCuenta): JsonResponse
    {
        if (! $estadoCuenta->esFacturada()) {
            return response()->json(['message' => 'Solo se puede registrar cobranza en filas FACTURADAS.'], 422);
        }

        $validated = $request->validate([
            'fecha_cobro'       => ['required', 'date'],
            'importe_cobrado'   => ['required', 'numeric'],
            'retenciones_gcias' => ['nullable', 'numeric'],
            'otras_retenciones' => ['nullable', 'numeric'],
            'numero_op_cobro'   => ['nullable', 'string', 'max:50'],
            'forma_cobro'       => ['nullable', 'string', 'max:50'],
        ]);

        $validated['retenciones_gcias'] = (float) ($validated['retenciones_gcias'] ?? 0);
        $validated['otras_retenciones'] = (float) ($validated['otras_retenciones'] ?? 0);
        $validated['diferencia'] = round(
            (float) $estadoCuenta->importe_a_cobrar
            - (float) $validated['importe_cobrado']
            - $validated['retenciones_gcias']
            - $validated['otras_retenciones'],
            2
        );
        $validated['estado'] = LiqEstadoCuentaCliente::ESTADO_COBRADA;

        $estadoCuenta->update($validated);

        // Sincronizar cobranza con factura_cabecera si existe
        if ($estadoCuenta->factura_id) {
            FacturaCabecera::where('id', $estadoCuenta->factura_id)->update([
                'fecha_pago_manual'        => $validated['fecha_cobro'],
                'monto_pagado_manual'      => $validated['importe_cobrado'],
                'retenciones_gcias_manual' => $validated['retenciones_gcias'],
                'otras_retenciones_manual' => $validated['otras_retenciones'],
                'op_cobro_recibo_manual'   => $validated['numero_op_cobro'] ?? null,
                'forma_cobro_manual'       => $validated['forma_cobro'] ?? null,
                'estado_cobranza'          => 'COBRADA',
            ]);
        }

        return response()->json([
            'message' => 'Cobranza registrada.',
            'data'    => $this->serializeRow($estadoCuenta->fresh()),
        ]);
    }

    // -------------------------------------------------------------------------
    // GET /api/liq/estado-cuenta/exportar
    // -------------------------------------------------------------------------

    public function exportar(Request $request)
    {
        $query = LiqEstadoCuentaCliente::query()
            ->with(['cliente:id,nombre_corto,razon_social']);

        if ($request->filled('cliente_id')) {
            $query->where('cliente_id', $request->integer('cliente_id'));
        }
        if ($request->filled('sucursal')) {
            $query->where('sucursal', $request->input('sucursal'));
        }
        if ($request->filled('estado')) {
            $query->where('estado', $request->input('estado'));
        }

        $rows = $query->orderByDesc('created_at')->get();

        $csvHeader = implode(';', [
            'Jurisd.', 'Sucursal', 'Periodo', 'Quincena', 'Tipo',
            'Neto Gravado', 'No Grav.', 'IVA', 'Importe a Cobrar', 'Obs.',
            'N° Factura', 'Fecha Fact.', 'Fecha Cobro', 'Imp. Cobrado',
            'Ret. GCIAS', 'Otras Ret.', 'N° OP/Recibo', 'Forma Cobro', 'Diferencia', 'Estado',
        ]);

        $csvLines = [$csvHeader];

        foreach ($rows as $row) {
            $csvLines[] = implode(';', [
                $row->jurisdiccion_id ?? '',
                $row->sucursal,
                $row->periodo,
                $row->quincena,
                $row->tipo_comprobante,
                number_format((float) $row->neto_gravado, 2, ',', '.'),
                number_format((float) $row->no_gravado, 2, ',', '.'),
                number_format((float) $row->iva, 2, ',', '.'),
                number_format((float) $row->importe_a_cobrar, 2, ',', '.'),
                str_replace(';', ',', $row->observaciones ?? ''),
                $row->numero_factura ?? '',
                optional($row->fecha_factura)?->format('d/m/Y') ?? '',
                optional($row->fecha_cobro)?->format('d/m/Y') ?? '',
                $row->importe_cobrado !== null ? number_format((float) $row->importe_cobrado, 2, ',', '.') : '',
                number_format((float) $row->retenciones_gcias, 2, ',', '.'),
                number_format((float) $row->otras_retenciones, 2, ',', '.'),
                $row->numero_op_cobro ?? '',
                $row->forma_cobro ?? '',
                number_format((float) $row->diferencia, 2, ',', '.'),
                $row->estado,
            ]);
        }

        $content = implode("\r\n", $csvLines);

        return response($content, 200, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="estado_cuenta_' . now()->format('Ymd_His') . '.csv"',
        ]);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private function serializeRow(LiqEstadoCuentaCliente $row): array
    {
        return [
            'id'                    => $row->id,
            'cliente_id'            => $row->cliente_id,
            'cliente_nombre'        => $row->cliente?->nombre_corto ?? $row->cliente?->razon_social,
            'sucursal'              => $row->sucursal,
            'jurisdiccion_id'       => $row->jurisdiccion_id,
            'jurisdiccion_nombre'   => $row->jurisdiccionNombre(),
            'periodo'               => $row->periodo,
            'quincena'              => $row->quincena,
            'neto_gravado'          => $row->neto_gravado,
            'no_gravado'            => $row->no_gravado,
            'iva'                   => $row->iva,
            'importe_a_cobrar'      => $row->importe_a_cobrar,
            'observaciones'         => $row->observaciones,
            'tipo_comprobante'      => $row->tipo_comprobante,
            'liquidacion_cliente_id' => $row->liquidacion_cliente_id,
            'factura_id'            => $row->factura_id,
            'numero_factura'        => $row->numero_factura,
            'cae'                   => $row->cae,
            'fecha_factura'         => optional($row->fecha_factura)?->format('Y-m-d'),
            'vencimiento_pago'      => optional($row->vencimiento_pago)?->format('Y-m-d'),
            'fecha_cobro'           => optional($row->fecha_cobro)?->format('Y-m-d'),
            'importe_cobrado'       => $row->importe_cobrado,
            'retenciones_gcias'     => $row->retenciones_gcias,
            'otras_retenciones'     => $row->otras_retenciones,
            'numero_op_cobro'       => $row->numero_op_cobro,
            'forma_cobro'           => $row->forma_cobro,
            'diferencia'            => $row->diferencia,
            'estado'                => $row->estado,
            'usuario'               => $row->usuario?->name,
            'created_at'            => $row->created_at?->toISOString(),
            'updated_at'            => $row->updated_at?->toISOString(),
        ];
    }

    private function parsePeriodo(string $periodo, string $quincena): array
    {
        [$anio, $mes] = $this->parseAnioMes($periodo);

        if (! $anio || ! $mes) {
            return [null, null];
        }

        $desde = Carbon::createFromDate($anio, $mes, 1);

        return match ($quincena) {
            'Q1'    => [$desde, $desde->copy()->day(15)],
            'Q2'    => [$desde->copy()->day(16), $desde->copy()->endOfMonth()],
            default => [$desde, $desde->copy()->endOfMonth()],
        };
    }

    private function parseAnioMes(string $periodo): array
    {
        $meses = [
            'ene' => 1, 'feb' => 2, 'mar' => 3, 'abr' => 4,
            'may' => 5, 'jun' => 6, 'jul' => 7, 'ago' => 8,
            'sep' => 9, 'oct' => 10, 'nov' => 11, 'dic' => 12,
        ];

        // Formato: "mar-26" o "2026-03"
        if (preg_match('/^(\d{4})-(\d{2})$/', $periodo, $m)) {
            return [(int) $m[1], (int) $m[2]];
        }

        if (preg_match('/^([a-z]{3})-(\d{2})$/i', $periodo, $m)) {
            $mes = $meses[strtolower($m[1])] ?? null;
            $anio = 2000 + (int) $m[2];
            return [$anio, $mes];
        }

        return [null, null];
    }

    /**
     * Llamado desde generarLiquidaciones para crear filas automaticas.
     */
    public static function crearFilasDesdeOperaciones(
        int $liquidacionClienteId,
        int $clienteId,
        string $periodoDesde,
        string $periodoHasta,
        ?int $usuarioId = null
    ): array {
        $operaciones = \App\Models\LiqOperacion::where('liquidacion_cliente_id', $liquidacionClienteId)
            ->whereIn('estado', ['ok', 'diferencia'])
            ->where('excluida', false)
            ->get(['sucursal_tarifa', 'valor_cliente']);

        $porSucursal = $operaciones->groupBy('sucursal_tarifa');
        $created = [];

        $desde = Carbon::parse($periodoDesde);
        $hasta = Carbon::parse($periodoHasta);
        $mesesAbrev = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        $periodo = $mesesAbrev[$desde->month] . '-' . $desde->format('y');

        // Determinar quincena
        $dias = $desde->diffInDays($hasta) + 1;
        if ($desde->day === 1 && $hasta->day <= 15) {
            $quincena = 'Q1';
        } elseif ($desde->day >= 16) {
            $quincena = 'Q2';
        } else {
            $quincena = 'MC';
        }

        foreach ($porSucursal as $sucursal => $ops) {
            if (! $sucursal) {
                continue;
            }

            $netoGravado = round($ops->sum(fn ($op) => (float) $op->valor_cliente), 2);
            $iva = round($netoGravado * 0.21, 2);
            $importeACobrar = round($netoGravado + $iva, 2);

            // Buscar jurisdiccion guardada
            $jurisdiccion = LiqJurisdiccionSucursal::where('cliente_id', $clienteId)
                ->where('sucursal', $sucursal)
                ->first();

            $row = LiqEstadoCuentaCliente::create([
                'cliente_id'             => $clienteId,
                'sucursal'               => $sucursal,
                'jurisdiccion_id'        => $jurisdiccion?->jurisdiccion_id,
                'periodo'                => $periodo,
                'quincena'               => $quincena,
                'neto_gravado'           => $netoGravado,
                'no_gravado'             => 0,
                'iva'                    => $iva,
                'importe_a_cobrar'       => $importeACobrar,
                'tipo_comprobante'       => LiqEstadoCuentaCliente::TIPO_FA,
                'liquidacion_cliente_id' => $liquidacionClienteId,
                'estado'                 => LiqEstadoCuentaCliente::ESTADO_PENDIENTE,
                'usuario_id'             => $usuarioId,
            ]);

            $created[] = $row->id;
        }

        return $created;
    }
}

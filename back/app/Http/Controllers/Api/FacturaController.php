<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\FacturaCabecera;
use App\Models\AuditoriaFacturacion;
use App\Models\Sucursal;
use App\Services\Arca\Exceptions\ArcaException;
use App\Services\Facturacion\Exceptions\FacturaValidationException;
use App\Services\Facturacion\FacturaDraftService;
use App\Services\Facturacion\FacturaEmissionService;
use App\Services\Facturacion\FacturaValidator;
use App\Support\Facturacion\FacturaEstado;
use App\Support\Facturacion\PeriodoFacturado;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use RuntimeException;
use Throwable;

class FacturaController extends Controller
{
    public function __construct(
        private readonly FacturaDraftService $draftService,
        private readonly FacturaValidator $validator,
        private readonly FacturaEmissionService $emissionService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        $query = FacturaCabecera::query()
            ->with(['cliente', 'sucursal', 'emisor'])
            ->orderByDesc('fecha_cbte')
            ->orderByDesc('id');

        $this->applyFilters($query, $request);

        $facturas = $query->get()
            ->map(fn (FacturaCabecera $factura) => $this->serializeFacturaSummary($factura))
            ->values();

        return response()->json(['data' => $facturas]);
    }

    public function show(Request $request, FacturaCabecera $factura): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        $factura->load(['emisor', 'certificado', 'cliente', 'sucursal', 'ivaItems', 'tributos', 'detallePdf', 'cbtesAsoc', 'historialCobranza.usuario']);

        return response()->json(['data' => $this->serializeFacturaDetail($factura)]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para crear facturas.'], 403);
        }

        $payload = $this->validateDraftPayload($request);
        $payload = $this->hydrateClienteSnapshot($payload);

        try {
            $factura = $this->draftService->createDraft($payload);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }

        return response()->json([
            'message' => 'Factura borrador creada correctamente.',
            'data' => $this->serializeFacturaDetail($factura),
        ], 201);
    }

    public function updateDraft(Request $request, FacturaCabecera $factura): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para editar facturas.'], 403);
        }

        $payload = $this->validateDraftPayload($request);
        $payload = $this->hydrateClienteSnapshot($payload);

        try {
            $factura = $this->draftService->updateDraft($factura, $payload);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }

        return response()->json([
            'message' => 'Factura borrador actualizada correctamente.',
            'data' => $this->serializeFacturaDetail($factura),
        ]);
    }

    public function validar(Request $request, FacturaCabecera $factura): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para validar facturas.'], 403);
        }

        try {
            $this->validator->validateOrFail($factura);
        } catch (FacturaValidationException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'errors' => $exception->errors(),
            ], 422);
        }

        if ($factura->canEditFiscalFields()) {
            $factura->estado = FacturaEstado::VALIDADA_LOCAL;
            $factura->save();
        }

        return response()->json([
            'message' => 'Factura validada localmente.',
            'data' => $this->serializeFacturaDetail($factura->fresh()),
        ]);
    }

    public function emitir(Request $request, FacturaCabecera $factura): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para emitir facturas.'], 403);
        }

        try {
            $result = $this->emissionService->emit($factura, $request->user()?->id, $request->ip());
        } catch (FacturaValidationException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'errors' => $exception->errors(),
            ], 422);
        } catch (ArcaException $exception) {
            return response()->json([
                'message' => 'ARCA respondio con error.',
                'error' => $exception->getMessage(),
            ], 502);
        } catch (Throwable $exception) {
            return response()->json([
                'message' => 'No se pudo emitir la factura.',
                'error' => $exception->getMessage(),
            ], 500);
        }

        $message = $result['reused'] ?? false
            ? 'Factura ya autorizada. Se reutilizo la emision existente.'
            : 'Factura emitida correctamente.';

        return response()->json([
            'message' => $message,
            'data' => $this->serializeFacturaDetail($result['factura']),
        ]);
    }

    public function destroy(Request $request, FacturaCabecera $factura): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para eliminar facturas.'], 403);
        }

        $estado = $factura->estado instanceof FacturaEstado
            ? $factura->estado->value
            : (string) ($factura->estado ?? '');

        if (in_array($estado, [FacturaEstado::AUTORIZADA->value, FacturaEstado::PDF_GENERADO->value, FacturaEstado::ENVIANDO_ARCA->value], true)) {
            return response()->json([
                'message' => 'No se puede eliminar una factura autorizada/enviada. Solo se permite borrar borradores o facturas rechazadas.',
            ], 409);
        }

        $disk = (string) config('services.arca.storage_disk', 'local');

        DB::transaction(function () use ($factura, $disk) {
            foreach (['pdf_path', 'request_xml_path', 'response_xml_path'] as $field) {
                $path = (string) ($factura->{$field} ?? '');
                if ($path !== '' && Storage::disk($disk)->exists($path)) {
                    Storage::disk($disk)->delete($path);
                }
            }

            $factura->ivaItems()->delete();
            $factura->tributos()->delete();
            $factura->detallePdf()->delete();
            $factura->cbtesAsoc()->delete();
            $factura->historialCobranza()->delete();

            $factura->delete();
        });

        return response()->json(['message' => 'Factura eliminada correctamente.']);
    }

    public function downloadPdf(Request $request, FacturaCabecera $factura)
    {
        if (! $this->canAccessFacturacion($request->user())) {
            abort(403, 'No tenes permisos para descargar el PDF.');
        }

        $path = $factura->pdf_path;
        if (! $path) {
            abort(404, 'La factura no tiene PDF generado.');
        }

        $disk = (string) config('services.arca.storage_disk', 'local');
        if (! Storage::disk($disk)->exists($path)) {
            abort(404, 'El PDF solicitado no esta disponible.');
        }

        return Storage::disk($disk)->download($path, sprintf('factura-%d.pdf', $factura->id));
    }

    public function downloadXmlRequest(Request $request, FacturaCabecera $factura)
    {
        if (! $this->canAccessFacturacion($request->user())) {
            abort(403, 'No tenes permisos para descargar el XML.');
        }

        $path = $factura->request_xml_path;
        if (! $path) {
            abort(404, 'La factura no tiene XML request.');
        }

        $disk = (string) config('services.arca.storage_disk', 'local');
        if (! Storage::disk($disk)->exists($path)) {
            abort(404, 'El XML request no esta disponible.');
        }

        return Storage::disk($disk)->download($path, sprintf('factura-%d-request.xml', $factura->id));
    }

    public function downloadXmlResponse(Request $request, FacturaCabecera $factura)
    {
        if (! $this->canAccessFacturacion($request->user())) {
            abort(403, 'No tenes permisos para descargar el XML.');
        }

        $path = $factura->response_xml_path;
        if (! $path) {
            abort(404, 'La factura no tiene XML response.');
        }

        $disk = (string) config('services.arca.storage_disk', 'local');
        if (! Storage::disk($disk)->exists($path)) {
            abort(404, 'El XML response no esta disponible.');
        }

        return Storage::disk($disk)->download($path, sprintf('factura-%d-response.xml', $factura->id));
    }

    public function auditoria(Request $request, FacturaCabecera $factura): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para ver la auditoria.'], 403);
        }

        $auditoria = AuditoriaFacturacion::query()
            ->with(['usuario:id,name,email'])
            ->where('entidad', 'factura_cabecera')
            ->where('entidad_id', $factura->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'evento' => $item->evento,
                'created_at' => optional($item->created_at)->toISOString(),
                'ip' => $item->ip,
                'usuario' => $item->usuario
                    ? [
                        'id' => $item->usuario->id,
                        'name' => $item->usuario->name,
                        'email' => $item->usuario->email,
                    ]
                    : null,
                'payload_before' => $item->payload_before_json,
                'payload_after' => $item->payload_after_json,
            ]);

        return response()->json(['data' => $auditoria]);
    }

    private function applyFilters(Builder $query, Request $request): void
    {
        if ($request->filled('cliente_id')) {
            $query->where('cliente_id', (int) $request->input('cliente_id'));
        }
        if ($request->filled('sucursal_id')) {
            $query->where('sucursal_id', (int) $request->input('sucursal_id'));
        }
        if ($request->filled('estado')) {
            $query->where('estado', (string) $request->input('estado'));
        }
        if ($request->filled('estado_cobranza')) {
            $query->where('estado_cobranza', (string) $request->input('estado_cobranza'));
        }
        if ($request->filled('anio')) {
            $query->where('anio_facturado', (int) $request->input('anio'));
        }
        if ($request->filled('mes')) {
            $query->where('mes_facturado', (int) $request->input('mes'));
        }
        if ($request->filled('periodo')) {
            $query->where('periodo_facturado', (string) $request->input('periodo'));
        }
        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha_cbte', '>=', (string) $request->input('fecha_desde'));
        }
        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha_cbte', '<=', (string) $request->input('fecha_hasta'));
        }
        if ($request->filled('fecha_aprox_desde')) {
            $query->whereDate('fecha_aprox_cobro', '>=', (string) $request->input('fecha_aprox_desde'));
        }
        if ($request->filled('fecha_aprox_hasta')) {
            $query->whereDate('fecha_aprox_cobro', '<=', (string) $request->input('fecha_aprox_hasta'));
        }
        if ($request->filled('buscar')) {
            $term = trim((string) $request->input('buscar'));
            $query->where(function (Builder $sub) use ($term) {
                $sub->where('cliente_nombre', 'like', '%' . $term . '%')
                    ->orWhere('cae', 'like', '%' . $term . '%')
                    ->orWhere('doc_nro', 'like', '%' . preg_replace('/\D+/', '', $term) . '%')
                    ->orWhere('cbte_numero', $term);
            });
        }
    }

    private function validateDraftPayload(Request $request): array
    {
        $periodos = array_column(PeriodoFacturado::cases(), 'value');
        $condicionesVenta = [
            'CONTADO',
            'TARJETA_DEBITO',
            'TARJETA_CREDITO',
            'CUENTA_CORRIENTE',
            'CHEQUE',
            'TRANSFERENCIA_BANCARIA',
            'OTRA',
            'OTROS_MEDIOS_PAGO_ELECTRONICO',
        ];

        $cbteTipo = (int) $request->input('cbte_tipo');
        $requiereAsociacion = in_array($cbteTipo, [2, 3, 7, 8, 12, 13, 20, 21, 202, 203, 207, 208, 212, 213], true);
        $cbtesAsocRules = $requiereAsociacion
            ? ['required', 'array', 'min:1']
            : ['nullable', 'array'];

        $validated = $request->validate([
            'emisor_id' => ['required', 'integer', Rule::exists('arca_emisor', 'id')],
            'ambiente' => ['required', Rule::in(['PROD'])],
            'pto_vta' => ['required', 'integer', Rule::in([config('services.arca.pto_venta_default', 11)])],
            'cbte_tipo' => ['required', 'integer'],
            'concepto' => ['required', 'integer', Rule::in([1, 2, 3])],
            'doc_tipo' => ['required', 'integer'],
            'doc_nro' => ['required', 'regex:/\\d+/'],
            'cliente_id' => ['required', 'integer', Rule::exists('clientes', 'id')],
            'sucursal_id' => [
                'required',
                'integer',
                Rule::exists('sucursals', 'id')->where(function ($query) use ($request) {
                    $clienteId = (int) $request->input('cliente_id');
                    if ($clienteId > 0) {
                        $query->where('cliente_id', $clienteId);
                    }
                }),
            ],
            'cliente_nombre' => ['nullable', 'string', 'max:255'],
            'cliente_domicilio' => ['nullable', 'string', 'max:500'],
            'fecha_cbte' => ['required', 'date'],
            'fecha_serv_desde' => ['nullable', 'date'],
            'fecha_serv_hasta' => ['nullable', 'date'],
            'fecha_vto_pago' => ['nullable', 'date'],
            'condiciones_venta' => ['nullable', 'array'],
            'condiciones_venta.*' => ['string', Rule::in($condicionesVenta)],
            'moneda_id' => ['required', 'string', 'max:10'],
            'moneda_cotiz' => ['required', 'numeric'],
            'imp_total' => ['required', 'numeric'],
            'imp_tot_conc' => ['required', 'numeric'],
            'imp_neto' => ['required', 'numeric'],
            'imp_op_ex' => ['required', 'numeric'],
            'imp_iva' => ['required', 'numeric'],
            'imp_trib' => ['required', 'numeric'],
            'anio_facturado' => ['required', 'integer'],
            'mes_facturado' => ['required', 'integer', 'between:1,12'],
            'periodo_facturado' => ['required', Rule::in($periodos)],
            'fecha_aprox_cobro' => ['required', 'date'],
            'fecha_pago_manual' => ['nullable', 'date', 'after_or_equal:fecha_aprox_cobro'],
            'monto_pagado_manual' => ['nullable', 'numeric'],
            'observaciones_cobranza' => ['nullable', 'string', 'max:5000'],
            'iva' => ['nullable', 'array'],
            'iva.*.iva_id' => ['required_with:iva', 'integer'],
            'iva.*.base_imp' => ['required_with:iva', 'numeric'],
            'iva.*.importe' => ['required_with:iva', 'numeric'],
            'tributos' => ['nullable', 'array'],
            'tributos.*.tributo_id' => ['required_with:tributos', 'integer'],
            'tributos.*.descr' => ['nullable', 'string'],
            'tributos.*.base_imp' => ['nullable', 'numeric'],
            'tributos.*.alic' => ['nullable', 'numeric'],
            'tributos.*.importe' => ['required_with:tributos', 'numeric'],
            'detalle_pdf' => ['required', 'array', 'min:1'],
            'detalle_pdf.*.orden' => ['required', 'integer'],
            'detalle_pdf.*.descripcion' => ['required', 'string'],
            'detalle_pdf.*.cantidad' => ['required', 'numeric'],
            'detalle_pdf.*.unidad_medida' => ['nullable', 'string'],
            'detalle_pdf.*.precio_unitario' => ['required', 'numeric'],
            'detalle_pdf.*.bonificacion_pct' => ['nullable', 'numeric'],
            'detalle_pdf.*.subtotal' => ['required', 'numeric'],
            'detalle_pdf.*.alicuota_iva_pct' => ['nullable', 'numeric'],
            'detalle_pdf.*.subtotal_con_iva' => ['required', 'numeric'],
            'cbtes_asoc' => $cbtesAsocRules,
            'cbtes_asoc.*.cbte_tipo' => ['required_with:cbtes_asoc', 'integer'],
            'cbtes_asoc.*.pto_vta' => ['required_with:cbtes_asoc', 'integer'],
            'cbtes_asoc.*.cbte_numero' => ['required_with:cbtes_asoc', 'integer'],
            'cbtes_asoc.*.fecha_emision' => ['nullable', 'date'],
        ]);

        $validated['doc_nro'] = (int) preg_replace('/\D+/', '', (string) $validated['doc_nro']);
        $validated['moneda_id'] = strtoupper(trim((string) $validated['moneda_id']));

        return $validated;
    }

    private function hydrateClienteSnapshot(array $payload): array
    {
        if (! empty($payload['cliente_nombre']) && ! empty($payload['cliente_domicilio'])) {
            return $payload;
        }

        $cliente = Cliente::query()->find($payload['cliente_id']);
        $sucursal = Sucursal::query()->find($payload['sucursal_id']);

        if ($cliente) {
            $payload['cliente_nombre'] = $payload['cliente_nombre'] ?? $cliente->nombre;
        }
        if ($sucursal) {
            $payload['cliente_domicilio'] = $payload['cliente_domicilio'] ?? $sucursal->direccion;
        }

        if (empty($payload['cliente_domicilio']) && $cliente) {
            $payload['cliente_domicilio'] = $cliente->direccion;
        }

        return $payload;
    }

    private function serializeFacturaSummary(FacturaCabecera $factura): array
    {
        return [
            'id' => $factura->id,
            'cliente_id' => $factura->cliente_id,
            'sucursal_id' => $factura->sucursal_id,
            'cliente_nombre' => $factura->cliente_nombre,
            'sucursal_nombre' => $factura->sucursal?->nombre,
            'pto_vta' => $factura->pto_vta,
            'cbte_tipo' => $factura->cbte_tipo,
            'cbte_numero' => $factura->cbte_numero,
            'fecha_cbte' => optional($factura->fecha_cbte)?->format('Y-m-d'),
            'imp_neto' => $factura->imp_neto,
            'imp_iva' => $factura->imp_iva,
            'imp_tot_conc' => $factura->imp_tot_conc,
            'imp_op_ex' => $factura->imp_op_ex,
            'imp_total' => $factura->imp_total,
            'fecha_aprox_cobro' => optional($factura->fecha_aprox_cobro)?->format('Y-m-d'),
            'fecha_pago_manual' => optional($factura->fecha_pago_manual)?->format('Y-m-d'),
            'estado_cobranza' => $factura->estado_cobranza?->value ?? $factura->estado_cobranza,
            'estado' => $factura->estado?->value ?? $factura->estado,
            'cae' => $factura->cae,
            'anio_facturado' => $factura->anio_facturado,
            'mes_facturado' => $factura->mes_facturado,
            'periodo_facturado' => $factura->periodo_facturado?->value ?? $factura->periodo_facturado,
            'pdf_url' => $factura->pdf_path ? sprintf('/api/facturas/%d/pdf', $factura->id) : null,
        ];
    }

    private function serializeFacturaDetail(FacturaCabecera $factura): array
    {
        return [
            'id' => $factura->id,
            'emisor_id' => $factura->emisor_id,
            'certificado_id' => $factura->certificado_id,
            'ambiente' => $factura->ambiente?->value ?? $factura->ambiente,
            'pto_vta' => $factura->pto_vta,
            'cbte_tipo' => $factura->cbte_tipo,
            'cbte_numero' => $factura->cbte_numero,
            'concepto' => $factura->concepto,
            'doc_tipo' => $factura->doc_tipo,
            'doc_nro' => $factura->doc_nro,
            'cliente_id' => $factura->cliente_id,
            'sucursal_id' => $factura->sucursal_id,
            'cliente_nombre' => $factura->cliente_nombre,
            'cliente_domicilio' => $factura->cliente_domicilio,
            'fecha_cbte' => optional($factura->fecha_cbte)?->format('Y-m-d'),
            'fecha_serv_desde' => optional($factura->fecha_serv_desde)?->format('Y-m-d'),
            'fecha_serv_hasta' => optional($factura->fecha_serv_hasta)?->format('Y-m-d'),
            'fecha_vto_pago' => optional($factura->fecha_vto_pago)?->format('Y-m-d'),
            'condiciones_venta' => $factura->condiciones_venta ?? [],
            'moneda_id' => $factura->moneda_id,
            'moneda_cotiz' => $factura->moneda_cotiz,
            'imp_total' => $factura->imp_total,
            'imp_tot_conc' => $factura->imp_tot_conc,
            'imp_neto' => $factura->imp_neto,
            'imp_op_ex' => $factura->imp_op_ex,
            'imp_iva' => $factura->imp_iva,
            'imp_trib' => $factura->imp_trib,
            'resultado_arca' => $factura->resultado_arca,
            'reproceso' => $factura->reproceso,
            'cae' => $factura->cae,
            'cae_vto' => optional($factura->cae_vto)?->format('Y-m-d'),
            'observaciones_arca' => $factura->observaciones_arca_json,
            'errores_arca' => $factura->errores_arca_json,
            'estado' => $factura->estado?->value ?? $factura->estado,
            'hash_idempotencia' => $factura->hash_idempotencia,
            'anio_facturado' => $factura->anio_facturado,
            'mes_facturado' => $factura->mes_facturado,
            'periodo_facturado' => $factura->periodo_facturado?->value ?? $factura->periodo_facturado,
            'fecha_aprox_cobro' => optional($factura->fecha_aprox_cobro)?->format('Y-m-d'),
            'fecha_pago_manual' => optional($factura->fecha_pago_manual)?->format('Y-m-d'),
            'monto_pagado_manual' => $factura->monto_pagado_manual,
            'estado_cobranza' => $factura->estado_cobranza?->value ?? $factura->estado_cobranza,
            'observaciones_cobranza' => $factura->observaciones_cobranza,
            'pdf_url' => $factura->pdf_path ? sprintf('/api/facturas/%d/pdf', $factura->id) : null,
            'xml_request_url' => $factura->request_xml_path ? sprintf('/api/facturas/%d/xml-request', $factura->id) : null,
            'xml_response_url' => $factura->response_xml_path ? sprintf('/api/facturas/%d/xml-response', $factura->id) : null,
            'created_at' => optional($factura->created_at)?->toIso8601String(),
            'updated_at' => optional($factura->updated_at)?->toIso8601String(),
            'iva' => $factura->ivaItems->map(fn ($item) => [
                'id' => $item->id,
                'iva_id' => $item->iva_id,
                'base_imp' => $item->base_imp,
                'importe' => $item->importe,
            ])->values(),
            'tributos' => $factura->tributos->map(fn ($item) => [
                'id' => $item->id,
                'tributo_id' => $item->tributo_id,
                'descr' => $item->descr,
                'base_imp' => $item->base_imp,
                'alic' => $item->alic,
                'importe' => $item->importe,
            ])->values(),
            'detalle_pdf' => $factura->detallePdf->map(fn ($item) => [
                'id' => $item->id,
                'orden' => $item->orden,
                'descripcion' => $item->descripcion,
                'cantidad' => $item->cantidad,
                'unidad_medida' => $item->unidad_medida,
                'precio_unitario' => $item->precio_unitario,
                'bonificacion_pct' => $item->bonificacion_pct,
                'subtotal' => $item->subtotal,
                'alicuota_iva_pct' => $item->alicuota_iva_pct,
                'subtotal_con_iva' => $item->subtotal_con_iva,
            ])->values(),
            'cbtes_asoc' => $factura->cbtesAsoc->map(fn ($item) => [
                'id' => $item->id,
                'cbte_tipo' => $item->cbte_tipo,
                'pto_vta' => $item->pto_vta,
                'cbte_numero' => $item->cbte_numero,
                'fecha_emision' => optional($item->fecha_emision)?->format('Y-m-d'),
            ])->values(),
            'historial_cobranza' => $factura->historialCobranza->map(fn ($item) => [
                'id' => $item->id,
                'fecha_evento' => optional($item->fecha_evento)?->toIso8601String(),
                'estado_anterior' => $item->estado_anterior,
                'estado_nuevo' => $item->estado_nuevo,
                'fecha_aprox_cobro_anterior' => optional($item->fecha_aprox_cobro_anterior)?->format('Y-m-d'),
                'fecha_aprox_cobro_nueva' => optional($item->fecha_aprox_cobro_nueva)?->format('Y-m-d'),
                'fecha_pago_anterior' => optional($item->fecha_pago_anterior)?->format('Y-m-d'),
                'fecha_pago_nueva' => optional($item->fecha_pago_nueva)?->format('Y-m-d'),
                'monto_pagado_anterior' => $item->monto_pagado_anterior,
                'monto_pagado_nuevo' => $item->monto_pagado_nuevo,
                'observaciones' => $item->observaciones,
                'usuario' => $item->usuario ? [
                    'id' => $item->usuario->id,
                    'name' => $item->usuario->name ?? $item->usuario->email,
                    'email' => $item->usuario->email,
                ] : null,
            ])->values(),
        ];
    }

    private function canAccessFacturacion($user): bool
    {
        if (! $user) {
            return false;
        }

        $role = strtolower(trim((string) ($user->role ?? '')));
        if ($role !== '' && (str_contains($role, 'admin') || $role === 'encargado')) {
            return true;
        }

        $permissions = $user->permissions ?? null;
        if (! is_array($permissions)) {
            return false;
        }

        return in_array('facturacion', $permissions, true)
            || in_array('liquidaciones', $permissions, true)
            || in_array('pagos', $permissions, true);
    }
}

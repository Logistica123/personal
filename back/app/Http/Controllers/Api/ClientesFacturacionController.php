<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\ClienteEstadoCuentaManualRow;
use App\Models\ClientesFacturacionConsolidado;
use App\Models\FacturaCabecera;
use App\Models\LiquidacionRecibo;
use App\Services\Facturacion\ClientesFacturacionQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;

class ClientesFacturacionController extends Controller
{
    public function __construct(private readonly ClientesFacturacionQueryService $queryService)
    {
    }

    public function resumen(Request $request): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        $filters = $this->extractFilters($request);
        $rows = $this->queryService->summary($filters);

        $data = $rows->map(function (ClientesFacturacionConsolidado $row) {
            return $this->serializeConsolidado($row);
        })->values();

        return response()->json(['data' => $data]);
    }

    public function detalle(Request $request): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        $validated = $request->validate([
            'group_id' => ['nullable', 'string'],
            'cliente_id' => ['nullable', 'integer'],
            'sucursal_id' => ['nullable', 'integer'],
            'anio' => ['nullable', 'integer'],
            'mes' => ['nullable', 'integer'],
            'periodo' => ['nullable', 'string'],
        ]);

        if (! empty($validated['group_id'])) {
            try {
                $facturas = $this->queryService->groupByEncodedId($validated['group_id']);
            } catch (InvalidArgumentException $exception) {
                return response()->json(['message' => $exception->getMessage()], 422);
            }

            $data = $facturas->map(fn (FacturaCabecera $factura) => $this->serializeFactura($factura))->values();

            return response()->json(['data' => $data]);
        }

        foreach (['cliente_id', 'sucursal_id', 'anio', 'mes', 'periodo'] as $key) {
            if (empty($validated[$key])) {
                return response()->json(['message' => 'Faltan filtros obligatorios para el detalle.'], 422);
            }
        }

        $facturas = FacturaCabecera::query()
            ->with(['cliente', 'sucursal'])
            ->where('cliente_id', (int) $validated['cliente_id'])
            ->where('sucursal_id', (int) $validated['sucursal_id'])
            ->where('anio_facturado', (int) $validated['anio'])
            ->where('mes_facturado', (int) $validated['mes'])
            ->where('periodo_facturado', (string) $validated['periodo'])
            ->orderByDesc('fecha_cbte')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $facturas->map(fn (FacturaCabecera $factura) => $this->serializeFactura($factura))->values(),
        ]);
    }

    public function estadoCuenta(Request $request): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        $validated = $request->validate([
            'cliente_id' => ['required', 'integer'],
            'sucursal_id' => ['nullable', 'integer'],
            'anio' => ['nullable', 'integer'],
            'mes' => ['nullable', 'integer'],
            'periodo' => ['nullable', 'string'],
            'estado_cobranza' => ['nullable', 'string'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'include_recibos' => ['nullable', 'boolean'],
            'include_manual' => ['nullable', 'boolean'],
        ]);

        $limit = (int) ($validated['limit'] ?? 300);
        $includeRecibos = array_key_exists('include_recibos', $validated) ? (bool) $validated['include_recibos'] : true;
        $includeManual = array_key_exists('include_manual', $validated) ? (bool) $validated['include_manual'] : true;

        $query = FacturaCabecera::query()
            ->with(['cliente', 'sucursal'])
            ->where('cliente_id', (int) $validated['cliente_id'])
            ->orderByDesc('fecha_cbte')
            ->orderByDesc('id');

        if (! empty($validated['sucursal_id'])) {
            $query->where('sucursal_id', (int) $validated['sucursal_id']);
        }
        if (! empty($validated['anio'])) {
            $query->where('anio_facturado', (int) $validated['anio']);
        }
        if (! empty($validated['mes'])) {
            $query->where('mes_facturado', (int) $validated['mes']);
        }
        if (! empty($validated['periodo'])) {
            $query->where('periodo_facturado', (string) $validated['periodo']);
        }
        if (! empty($validated['estado_cobranza'])) {
            $query->where('estado_cobranza', (string) $validated['estado_cobranza']);
        }

        $facturas = $query->limit($limit)->get();

        $cobrosPorFactura = $includeRecibos ? $this->mapRecibosToFacturas($facturas) : [];

        $data = $facturas->map(function (FacturaCabecera $factura) use ($cobrosPorFactura) {
            $cobro = $cobrosPorFactura[$factura->id] ?? null;
            $manualFecha = optional($factura->fecha_pago_manual)?->format('Y-m-d');
            $manualMonto = $factura->monto_pagado_manual !== null ? (float) $factura->monto_pagado_manual : null;

            $importeCobrado = $manualMonto ?? ($cobro['importe_cobrado'] ?? 0.0);
            $fechaCobro = $manualFecha ?? ($cobro['fecha_cobro'] ?? null);

            $retGcias = $factura->retenciones_gcias_manual !== null
                ? (float) $factura->retenciones_gcias_manual
                : ($cobro['retenciones_gcias'] ?? null);
            $otrasRet = $factura->otras_retenciones_manual !== null
                ? (float) $factura->otras_retenciones_manual
                : ($cobro['otras_retenciones'] ?? null);
            $opCobro = $factura->op_cobro_recibo_manual ?: ($cobro['op_cobro_recibo'] ?? null);
            $formaCobro = $factura->forma_cobro_manual ?: ($cobro['forma_cobro'] ?? null);

            $noGravado = (float) ($factura->imp_tot_conc ?? 0) + (float) ($factura->imp_op_ex ?? 0);
            $diferencia = round(((float) ($factura->imp_total ?? 0)) - (float) ($importeCobrado ?? 0), 2);
            $opArchivoUrl = $factura->op_cobro_archivo_path ? Storage::disk('public')->url($factura->op_cobro_archivo_path) : null;

            return [
                'row_type' => 'factura',
                'manual_id' => null,
                'factura_id' => $factura->id,
                'cliente_id' => $factura->cliente_id,
                'cliente_nombre' => $factura->cliente_nombre,
                'sucursal_id' => $factura->sucursal_id,
                'sucursal_nombre' => $factura->sucursal?->nombre,
                'anio_facturado' => $factura->anio_facturado,
                'mes_facturado' => $factura->mes_facturado,
                'periodo_facturado' => $factura->periodo_facturado?->value ?? $factura->periodo_facturado,
                'quincena_label' => $this->toQuincenaLabel((string) ($factura->periodo_facturado?->value ?? $factura->periodo_facturado)),
                'neto_gravado' => (float) ($factura->imp_neto ?? 0),
                'no_gravado' => $noGravado,
                'iva' => (float) ($factura->imp_iva ?? 0),
                'importe_a_cobrar' => (float) ($factura->imp_total ?? 0),
                'observaciones' => $factura->observaciones_cobranza,
                'numero_factura' => $this->buildFacturaNumero($factura),
                'fecha_fact' => optional($factura->fecha_cbte)?->format('Y-m-d'),
                'fecha_cobro' => $fechaCobro,
                'importe_cobrado' => round((float) ($importeCobrado ?? 0), 2),
                'retenciones_gcias' => $retGcias,
                'otras_retenciones' => $otrasRet,
                'op_cobro_recibo' => $opCobro,
                'op_cobro_archivo_nombre' => $factura->op_cobro_archivo_nombre,
                'op_cobro_archivo_url' => $opArchivoUrl,
                'forma_cobro' => $formaCobro,
                'diferencia' => $diferencia,
                'observaciones_cobranza' => $factura->observaciones_cobranza,
                'op_cobro_recibo_manual' => $factura->op_cobro_recibo_manual,
                'forma_cobro_manual' => $factura->forma_cobro_manual,
                'retenciones_gcias_manual' => $factura->retenciones_gcias_manual,
                'otras_retenciones_manual' => $factura->otras_retenciones_manual,
                'estado_cobranza' => $factura->estado_cobranza?->value ?? $factura->estado_cobranza,
                'estado' => $factura->estado?->value ?? $factura->estado,
            ];
        })->values();

        if ($includeManual) {
            $manualQuery = ClienteEstadoCuentaManualRow::query()
                ->with(['sucursal'])
                ->where('cliente_id', (int) $validated['cliente_id'])
                ->orderByDesc('fecha_fact')
                ->orderByDesc('id');

            if (! empty($validated['sucursal_id'])) {
                $manualQuery->where('sucursal_id', (int) $validated['sucursal_id']);
            }
            if (! empty($validated['anio'])) {
                $manualQuery->where('anio_facturado', (int) $validated['anio']);
            }
            if (! empty($validated['mes'])) {
                $manualQuery->where('mes_facturado', (int) $validated['mes']);
            }
            if (! empty($validated['periodo'])) {
                $manualQuery->where('periodo_facturado', (string) $validated['periodo']);
            }
            if (! empty($validated['estado_cobranza'])) {
                $manualQuery->where('estado_cobranza', (string) $validated['estado_cobranza']);
            }

            $manualRows = $manualQuery->limit(min(1000, $limit))->get();
            $manualData = $manualRows->map(fn (ClienteEstadoCuentaManualRow $row) => $this->serializeManualRow($row))->values();

            $data = $data
                ->concat($manualData)
                ->sortByDesc(fn ($row) => (string) ($row['fecha_fact'] ?? '0000-00-00'))
                ->values();
        }

        return response()->json(['data' => $data]);
    }

    public function storeManualRow(Request $request): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        $validated = $this->validateManualRowPayload($request, requireClienteId: true);

        $row = ClienteEstadoCuentaManualRow::query()->create($validated);

        $file = $this->validateOpCobroArchivo($request);
        if ($file) {
            $stored = $this->storeManualOpCobroArchivo($file, (int) $row->id, $row->op_cobro_archivo_path);
            $row->op_cobro_archivo_path = $stored['path'];
            $row->op_cobro_archivo_nombre = $stored['original'];
            $row->save();
        }

        $row->load(['sucursal']);

        return response()->json([
            'message' => 'Fila manual creada.',
            'data' => $this->serializeManualRow($row),
        ], 201);
    }

    public function updateManualRow(Request $request, ClienteEstadoCuentaManualRow $manualRow): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        $validated = $this->validateManualRowPayload($request, requireClienteId: false);

        if (array_key_exists('cliente_id', $validated) && (int) $validated['cliente_id'] !== (int) $manualRow->cliente_id) {
            return response()->json(['message' => 'No se puede cambiar el cliente de la fila manual.'], 422);
        }

        unset($validated['cliente_id']);

        $manualRow->fill($validated);
        $manualRow->save();

        $file = $this->validateOpCobroArchivo($request);
        if ($file) {
            $stored = $this->storeManualOpCobroArchivo($file, (int) $manualRow->id, $manualRow->op_cobro_archivo_path);
            $manualRow->op_cobro_archivo_path = $stored['path'];
            $manualRow->op_cobro_archivo_nombre = $stored['original'];
            $manualRow->save();
        }

        $manualRow->load(['sucursal']);

        return response()->json([
            'message' => 'Fila manual actualizada.',
            'data' => $this->serializeManualRow($manualRow),
        ]);
    }

    public function destroyManualRow(Request $request, ClienteEstadoCuentaManualRow $manualRow): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        if ($manualRow->op_cobro_archivo_path) {
            Storage::disk('public')->delete($manualRow->op_cobro_archivo_path);
        }
        $manualRow->delete();

        return response()->json(['message' => 'Fila manual eliminada.']);
    }

    public function sucursales(Request $request, Cliente $cliente): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        $sucursales = $cliente->sucursales()->orderBy('nombre')->get()->map(function ($sucursal) {
            return [
                'id' => $sucursal->id,
                'nombre' => $sucursal->nombre,
                'direccion' => $sucursal->direccion,
            ];
        })->values();

        return response()->json(['data' => $sucursales]);
    }

    public function grupo(Request $request, string $grupoId): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        try {
            $facturas = $this->queryService->groupByEncodedId($grupoId);
        } catch (InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $data = $facturas->map(fn (FacturaCabecera $factura) => $this->serializeFactura($factura))->values();

        return response()->json(['data' => $data]);
    }

    public function facturasCliente(Request $request, Cliente $cliente): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        $validated = $request->validate([
            'sucursal_id' => ['nullable', 'integer'],
            'anio' => ['nullable', 'integer'],
            'mes' => ['nullable', 'integer'],
            'periodo' => ['nullable', 'string'],
            'estado' => ['nullable', 'string'],
            'estado_cobranza' => ['nullable', 'string'],
        ]);

        $query = FacturaCabecera::query()
            ->with(['cliente', 'sucursal'])
            ->where('cliente_id', $cliente->id)
            ->orderByDesc('fecha_cbte')
            ->orderByDesc('id');

        if (! empty($validated['sucursal_id'])) {
            $query->where('sucursal_id', (int) $validated['sucursal_id']);
        }
        if (! empty($validated['anio'])) {
            $query->where('anio_facturado', (int) $validated['anio']);
        }
        if (! empty($validated['mes'])) {
            $query->where('mes_facturado', (int) $validated['mes']);
        }
        if (! empty($validated['periodo'])) {
            $query->where('periodo_facturado', (string) $validated['periodo']);
        }
        if (! empty($validated['estado'])) {
            $query->where('estado', (string) $validated['estado']);
        }
        if (! empty($validated['estado_cobranza'])) {
            $query->where('estado_cobranza', (string) $validated['estado_cobranza']);
        }

        $facturas = $query->get()->map(fn (FacturaCabecera $factura) => $this->serializeFactura($factura))->values();

        return response()->json(['data' => $facturas]);
    }

    private function extractFilters(Request $request): array
    {
        $validated = $request->validate([
            'cliente_id' => ['nullable', 'integer'],
            'sucursal_id' => ['nullable', 'integer'],
            'anio' => ['nullable', 'integer'],
            'mes' => ['nullable', 'integer'],
            'periodo' => ['nullable', 'string'],
            'estado_cobranza' => ['nullable', 'string'],
        ]);

        return array_filter($validated, fn ($value) => $value !== null && $value !== '');
    }

    private function serializeConsolidado(ClientesFacturacionConsolidado $row): array
    {
        $groupId = $this->queryService->encodeGroupId(
            (int) $row->cliente_id,
            (int) $row->sucursal_id,
            (int) $row->anio_facturado,
            (int) $row->mes_facturado,
            (string) $row->periodo_facturado
        );

        return [
            'group_id' => $groupId,
            'cliente_id' => $row->cliente_id,
            'cliente_nombre' => $row->cliente_nombre,
            'sucursal_id' => $row->sucursal_id,
            'sucursal_nombre' => $row->sucursal_nombre,
            'anio_facturado' => $row->anio_facturado,
            'mes_facturado' => $row->mes_facturado,
            'periodo_facturado' => $row->periodo_facturado,
            'cantidad_facturas' => (int) $row->cantidad_facturas,
            'total_neto_gravado' => $row->total_neto_gravado,
            'total_no_gravado' => $row->total_no_gravado,
            'total_iva' => $row->total_iva,
            'total_final' => $row->total_final,
            'facturas_cobradas' => (int) $row->facturas_cobradas,
            'facturas_pendientes' => (int) $row->facturas_pendientes,
            'facturas_vencidas' => (int) $row->facturas_vencidas,
            'primera_fecha_aprox_cobro' => optional($row->primera_fecha_aprox_cobro)?->format('Y-m-d'),
            'ultima_fecha_aprox_cobro' => optional($row->ultima_fecha_aprox_cobro)?->format('Y-m-d'),
            'ultima_fecha_pago' => optional($row->ultima_fecha_pago)?->format('Y-m-d'),
        ];
    }

    private function serializeFactura(FacturaCabecera $factura): array
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

    private function validateManualRowPayload(Request $request, bool $requireClienteId): array
    {
        $rules = [
            'sucursal_id' => ['nullable', 'integer'],
            'anio_facturado' => ['required', 'integer', 'min:2000', 'max:2100'],
            'mes_facturado' => ['required', 'integer', 'min:1', 'max:12'],
            'periodo_facturado' => ['required', 'string', 'in:PRIMERA_QUINCENA,SEGUNDA_QUINCENA,MES_COMPLETO'],
            'neto_gravado' => ['nullable', 'numeric'],
            'no_gravado' => ['nullable', 'numeric'],
            'iva' => ['nullable', 'numeric'],
            'importe_a_cobrar' => ['nullable', 'numeric'],
            'observaciones' => ['nullable', 'string', 'max:5000'],
            'numero_factura' => ['nullable', 'string', 'max:40'],
            'fecha_fact' => ['nullable', 'date'],
            'fecha_cobro' => ['nullable', 'date'],
            'importe_cobrado' => ['nullable', 'numeric'],
            'retenciones_gcias' => ['nullable', 'numeric'],
            'otras_retenciones' => ['nullable', 'numeric'],
            'op_cobro_recibo' => ['nullable', 'string', 'max:40'],
            'forma_cobro' => ['nullable', 'string', 'max:255'],
            'estado_cobranza' => ['nullable', 'string', 'in:PENDIENTE,A_VENCER,VENCIDA,COBRADA,PARCIAL'],
        ];

        if ($requireClienteId) {
            $rules['cliente_id'] = ['required', 'integer', 'exists:clientes,id'];
        } else {
            $rules['cliente_id'] = ['sometimes', 'integer', 'exists:clientes,id'];
        }

        $validated = $request->validate($rules);

        $validated['neto_gravado'] = $validated['neto_gravado'] ?? 0;
        $validated['no_gravado'] = $validated['no_gravado'] ?? 0;
        $validated['iva'] = $validated['iva'] ?? 0;
        $validated['importe_a_cobrar'] = $validated['importe_a_cobrar'] ?? 0;

        if (! array_key_exists('estado_cobranza', $validated) || $validated['estado_cobranza'] === null || $validated['estado_cobranza'] === '') {
            $validated['estado_cobranza'] = 'PENDIENTE';
        }

        return $validated;
    }

    private function serializeManualRow(ClienteEstadoCuentaManualRow $row): array
    {
        $importeCobrado = $row->importe_cobrado !== null ? (float) $row->importe_cobrado : 0.0;
        $diferencia = round(((float) ($row->importe_a_cobrar ?? 0)) - $importeCobrado, 2);
        $opArchivoUrl = $row->op_cobro_archivo_path ? Storage::disk('public')->url($row->op_cobro_archivo_path) : null;

        return [
            'row_type' => 'manual',
            'manual_id' => $row->id,
            'factura_id' => null,
            'cliente_id' => $row->cliente_id,
            'cliente_nombre' => null,
            'sucursal_id' => $row->sucursal_id,
            'sucursal_nombre' => $row->sucursal?->nombre,
            'anio_facturado' => $row->anio_facturado,
            'mes_facturado' => $row->mes_facturado,
            'periodo_facturado' => $row->periodo_facturado,
            'quincena_label' => $this->toQuincenaLabel((string) $row->periodo_facturado),
            'neto_gravado' => (float) ($row->neto_gravado ?? 0),
            'no_gravado' => (float) ($row->no_gravado ?? 0),
            'iva' => (float) ($row->iva ?? 0),
            'importe_a_cobrar' => (float) ($row->importe_a_cobrar ?? 0),
            'observaciones' => $row->observaciones,
            'observaciones_cobranza' => $row->observaciones,
            'numero_factura' => $row->numero_factura ?: 'MANUAL',
            'fecha_fact' => optional($row->fecha_fact)?->format('Y-m-d'),
            'fecha_cobro' => optional($row->fecha_cobro)?->format('Y-m-d'),
            'importe_cobrado' => $row->importe_cobrado !== null ? (float) $row->importe_cobrado : null,
            'retenciones_gcias' => $row->retenciones_gcias !== null ? (float) $row->retenciones_gcias : null,
            'otras_retenciones' => $row->otras_retenciones !== null ? (float) $row->otras_retenciones : null,
            'op_cobro_recibo' => $row->op_cobro_recibo,
            'op_cobro_archivo_nombre' => $row->op_cobro_archivo_nombre,
            'op_cobro_archivo_url' => $opArchivoUrl,
            'forma_cobro' => $row->forma_cobro,
            'diferencia' => $diferencia,
            'estado_cobranza' => $row->estado_cobranza,
            'estado' => 'MANUAL',
        ];
    }

    private function validateOpCobroArchivo(Request $request): ?UploadedFile
    {
        $validated = $request->validate([
            'op_cobro_archivo' => ['nullable', 'file', 'max:20480', 'mimes:pdf,jpg,jpeg,png,webp'],
        ]);

        return ($validated['op_cobro_archivo'] ?? null) instanceof UploadedFile ? $validated['op_cobro_archivo'] : null;
    }

    /**
     * @return array{path: string, original: string}
     */
    private function storeManualOpCobroArchivo(UploadedFile $file, int $rowId, ?string $previousPath = null): array
    {
        $original = trim((string) $file->getClientOriginalName());
        if ($original === '') {
            $original = 'adjunto';
        }
        $original = Str::limit($original, 255, '');

        $extension = trim((string) ($file->getClientOriginalExtension() ?: $file->guessExtension() ?: ''));
        $extension = $extension !== '' ? '.' . strtolower($extension) : '';
        $filename = (string) Str::uuid() . $extension;

        $path = $file->storeAs("cobranzas/manual/{$rowId}", $filename, 'public');

        if ($previousPath) {
            Storage::disk('public')->delete($previousPath);
        }

        return ['path' => $path, 'original' => $original];
    }

    /**
     * @param \Illuminate\Support\Collection<int, FacturaCabecera> $facturas
     * @return array<int, array{importe_cobrado: float, fecha_cobro: string|null, retenciones_gcias: float|null, otras_retenciones: float|null, op_cobro_recibo: string|null, forma_cobro: string|null}>
     */
    private function mapRecibosToFacturas($facturas): array
    {
        $facturaIds = $facturas->pluck('id')->filter()->values();
        if ($facturaIds->isEmpty()) {
            return [];
        }

        // Evitar queries gigantes: si vienen demasiadas facturas, no intentamos mapear recibos.
        if ($facturaIds->count() > 250) {
            return [];
        }

        $allowedIds = array_fill_keys($facturaIds->all(), true);
        $ids = $facturaIds->map(fn ($id) => (string) $id)->all();

        $recibosQuery = LiquidacionRecibo::query()
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->where(function ($builder) use ($ids) {
                foreach ($ids as $id) {
                    $builder->orWhereRaw(
                        "JSON_SEARCH(draft, 'one', ?, NULL, '$.comprobantes[*].id') IS NOT NULL",
                        [$id]
                    );
                }
            });

        $recibos = $recibosQuery->get();

        $result = [];
        $latestKey = [];

        foreach ($recibos as $recibo) {
            $draft = is_array($recibo->draft) ? $recibo->draft : [];
            $comprobantes = $draft['comprobantes'] ?? [];
            if (! is_array($comprobantes) || $comprobantes === []) {
                continue;
            }

            $serial = $this->buildReciboSerial($recibo);
            $fechaCobro = $this->normalizeDateString($draft['fechaCobro'] ?? null)
                ?? optional($recibo->fecha)?->format('Y-m-d')
                ?? optional($recibo->created_at)?->format('Y-m-d');

            $retGcias = $this->parseDecimal($draft['retencionesGanancias'] ?? null);
            $retIva = $this->parseDecimal($draft['retencionesIva'] ?? null);
            $retIibb = $this->parseDecimal($draft['retencionesIibb'] ?? null);
            $otras = null;
            if ($retIva !== null || $retIibb !== null) {
                $otras = round((float) ($retIva ?? 0) + (float) ($retIibb ?? 0), 2);
            }
            $formaCobro = $this->normalizeString($draft['detalleCobro'] ?? null);

            $reciboSortKey = ($fechaCobro ?? '0000-00-00') . ' ' . (optional($recibo->created_at)?->format('Y-m-d H:i:s') ?? '0000-00-00 00:00:00');

            foreach ($comprobantes as $item) {
                if (! is_array($item)) {
                    continue;
                }
                $facturaId = (int) ($item['id'] ?? 0);
                if ($facturaId <= 0) {
                    continue;
                }
                if (! isset($allowedIds[$facturaId])) {
                    continue;
                }

                $imputado = $this->parseDecimal($item['imputado'] ?? null);
                if (! isset($result[$facturaId])) {
                    $result[$facturaId] = [
                        'importe_cobrado' => 0.0,
                        'fecha_cobro' => null,
                        'retenciones_gcias' => null,
                        'otras_retenciones' => null,
                        'op_cobro_recibo' => null,
                        'forma_cobro' => null,
                    ];
                    $latestKey[$facturaId] = '';
                }

                if ($imputado !== null) {
                    $result[$facturaId]['importe_cobrado'] = round($result[$facturaId]['importe_cobrado'] + $imputado, 2);
                }

                if ($reciboSortKey >= ($latestKey[$facturaId] ?? '')) {
                    $latestKey[$facturaId] = $reciboSortKey;
                    $result[$facturaId]['fecha_cobro'] = $fechaCobro;
                    $result[$facturaId]['retenciones_gcias'] = $retGcias;
                    $result[$facturaId]['otras_retenciones'] = $otras;
                    $result[$facturaId]['op_cobro_recibo'] = $serial;
                    $result[$facturaId]['forma_cobro'] = $formaCobro;
                }
            }
        }

        return $result;
    }

    private function buildReciboSerial(LiquidacionRecibo $recibo): string
    {
        return sprintf(
            '%s-%s',
            $this->formatSerial((string) $recibo->punto_venta, 4),
            $this->formatSerial((string) $recibo->numero_recibo, 8)
        );
    }

    private function buildFacturaNumero(FacturaCabecera $factura): string
    {
        $pto = $this->formatSerial((string) $factura->pto_vta, 4);
        $cbte = $factura->cbte_numero ? $this->formatSerial((string) $factura->cbte_numero, 8) : 'SIN_NUM';

        return sprintf('%s-%s', $pto, $cbte);
    }

    private function formatSerial(string $value, int $size): string
    {
        $digits = preg_replace('/\D+/', '', $value);
        $digits = $digits !== '' ? $digits : '0';

        return str_pad(substr($digits, -$size), $size, '0', STR_PAD_LEFT);
    }

    private function toQuincenaLabel(string $periodo): string
    {
        return match ($periodo) {
            'PRIMERA_QUINCENA' => '1Q',
            'SEGUNDA_QUINCENA' => '2Q',
            'MES_COMPLETO' => 'MC',
            default => $periodo,
        };
    }

    private function normalizeString($value): ?string
    {
        $trimmed = trim((string) ($value ?? ''));

        return $trimmed !== '' ? $trimmed : null;
    }

    private function normalizeDateString($value): ?string
    {
        $trimmed = $this->normalizeString($value);
        if ($trimmed === null) {
            return null;
        }

        // Esperamos YYYY-MM-DD; si viene otra cosa, devolvemos lo crudo.
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed) === 1) {
            return $trimmed;
        }

        return $trimmed;
    }

    private function parseDecimal($value): ?float
    {
        if ($value === null) {
            return null;
        }

        $raw = trim((string) $value);
        if ($raw === '') {
            return null;
        }

        $normalized = str_replace(' ', '', $raw);

        // Si termina en ",dd" asumimos formato AR con coma decimal: 1.234,56 -> 1234.56
        if (preg_match('/,\\d{1,}$/', $normalized) === 1) {
            $normalized = str_replace('.', '', $normalized);
            $normalized = str_replace(',', '.', $normalized);
        } else {
            // Caso US/ISO con punto decimal y coma de miles: 1,234.56 -> 1234.56
            $normalized = str_replace(',', '', $normalized);
        }

        $numeric = (float) $normalized;

        return is_finite($numeric) ? round($numeric, 2) : null;
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\ClientesFacturacionConsolidado;
use App\Models\FacturaCabecera;
use App\Services\Facturacion\ClientesFacturacionQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
}

<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqLiquidacionDistribuidor;
use App\Models\LiqPago;
use App\Models\LiqPagoItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LiqPagoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize($request);

        $query = LiqPago::query()
            ->with('cliente:id,nombre_corto')
            ->with('usuario:id,name')
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

        $items = collect($paginator->items())->map(fn (LiqPago $p) => [
            ...$p->toArray(),
            'cliente_nombre' => $p->cliente?->nombre_corto,
            'usuario_nombre' => $p->usuario?->name,
        ]);

        return response()->json([
            'data' => $items,
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(Request $request, LiqPago $pago): JsonResponse
    {
        $this->authorize($request);

        $pago->load('cliente:id,nombre_corto', 'usuario:id,name');

        return response()->json([
            'data' => [
                ...$pago->toArray(),
                'cliente_nombre' => $pago->cliente?->nombre_corto,
                'usuario_nombre' => $pago->usuario?->name,
            ],
        ]);
    }

    public function items(Request $request, LiqPago $pago): JsonResponse
    {
        $this->authorize($request);

        $items = $pago->items()
            ->with([
                'liquidacionDistribuidor:id,liquidacion_cliente_id,distribuidor_id,periodo_desde,periodo_hasta,total_a_pagar,estado,pdf_path,pago_id,fecha_pago,pagado_por,pago_referencia',
                'distribuidor:id,nombres,apellidos,patente,cuil,cbu_alias',
            ])
            ->orderBy('id')
            ->get()
            ->map(function (LiqPagoItem $i) {
                $dist = $i->distribuidor;

                return [
                    ...$i->toArray(),
                    'distribuidor_nombre' => $dist ? trim("{$dist->apellidos} {$dist->nombres}") : null,
                    'distribuidor_patente' => $dist?->patente,
                    'distribuidor_cuit' => $dist?->cuil,
                ];
            });

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize($request);

        $validated = $request->validate([
            'cliente_id' => ['required', 'integer', 'exists:liq_clientes,id'],
            'periodo_desde' => ['required', 'date'],
            'periodo_hasta' => ['required', 'date', 'after_or_equal:periodo_desde'],
            'liquidacion_distribuidor_ids' => ['nullable', 'array', 'min:1'],
            'liquidacion_distribuidor_ids.*' => ['integer'],
            'dry_run' => ['sometimes', 'boolean'],
        ]);

        $dryRun = (bool) ($validated['dry_run'] ?? false);

        if ($dryRun) {
            $eligibleQuery = LiqLiquidacionDistribuidor::query()
                ->with('distribuidor:id,nombres,apellidos,patente,cuil,cbu_alias')
                ->where('estado', 'aprobada')
                ->whereNull('pago_id')
                ->where('total_a_pagar', '>', 0)
                ->where('periodo_desde', '>=', $validated['periodo_desde'])
                ->where('periodo_hasta', '<=', $validated['periodo_hasta'])
                ->whereHas('liquidacionCliente', fn ($q) => $q->where('cliente_id', $validated['cliente_id']));

            if (! empty($validated['liquidacion_distribuidor_ids'])) {
                $eligibleQuery->whereIn('id', $validated['liquidacion_distribuidor_ids']);
            }

            $liquidaciones = $eligibleQuery->get();

            $missingCbu = $liquidaciones->filter(function (LiqLiquidacionDistribuidor $l) {
                return ! $l->distribuidor || ! $l->distribuidor->cbu_alias;
            })->values();

            if ($missingCbu->isNotEmpty()) {
                return response()->json([
                    'message' => 'Hay liquidaciones sin CBU/Alias cargado para el distribuidor.',
                    'missing_cbu' => $missingCbu->map(function (LiqLiquidacionDistribuidor $l) {
                        $dist = $l->distribuidor;
                        return [
                            'liquidacion_distribuidor_id' => $l->id,
                            'distribuidor_id' => $l->distribuidor_id,
                            'distribuidor_nombre' => $dist ? trim("{$dist->apellidos} {$dist->nombres}") : null,
                            'distribuidor_patente' => $dist?->patente,
                        ];
                    }),
                ], 422);
            }

            if ($liquidaciones->isEmpty()) {
                return response()->json([
                    'message' => 'No hay liquidaciones aprobadas elegibles para generar pagos con los filtros indicados. Tip: generá liquidaciones desde un extracto aprobado y aprobá esas liquidaciones en la pestaña Distribuidores.',
                ], 422);
            }

            $totalMonto = (float) $liquidaciones->sum('total_a_pagar');
            $cantidad = (int) $liquidaciones->count();

            return response()->json([
                'data' => [
                    'cliente_id' => (int) $validated['cliente_id'],
                    'periodo_desde' => $validated['periodo_desde'],
                    'periodo_hasta' => $validated['periodo_hasta'],
                    'cantidad_items' => $cantidad,
                    'total_monto' => $totalMonto,
                ],
            ]);
        }

        /** @var LiqPago $pago */
        $pago = DB::transaction(function () use ($validated, $request) {
            $eligibleQuery = LiqLiquidacionDistribuidor::query()
                ->with('distribuidor:id,nombres,apellidos,patente,cuil,cbu_alias')
                ->where('estado', 'aprobada')
                ->whereNull('pago_id')
                ->where('total_a_pagar', '>', 0)
                ->where('periodo_desde', '>=', $validated['periodo_desde'])
                ->where('periodo_hasta', '<=', $validated['periodo_hasta'])
                ->whereHas('liquidacionCliente', fn ($q) => $q->where('cliente_id', $validated['cliente_id']))
                ->lockForUpdate();

            if (! empty($validated['liquidacion_distribuidor_ids'])) {
                $eligibleQuery->whereIn('id', $validated['liquidacion_distribuidor_ids']);
            }

            $liquidaciones = $eligibleQuery->get();

            if ($liquidaciones->isEmpty()) {
                abort(response()->json([
                    'message' => 'No hay liquidaciones aprobadas elegibles para generar pagos con los filtros indicados. Tip: generá liquidaciones desde un extracto aprobado y aprobá esas liquidaciones en la pestaña Distribuidores.',
                ], 422));
            }

            $missingCbu = $liquidaciones->filter(function (LiqLiquidacionDistribuidor $l) {
                return ! $l->distribuidor || ! $l->distribuidor->cbu_alias;
            })->values();

            if ($missingCbu->isNotEmpty()) {
                abort(response()->json([
                    'message' => 'Hay liquidaciones sin CBU/Alias cargado para el distribuidor.',
                    'missing_cbu' => $missingCbu->map(function (LiqLiquidacionDistribuidor $l) {
                        $dist = $l->distribuidor;
                        return [
                            'liquidacion_distribuidor_id' => $l->id,
                            'distribuidor_id' => $l->distribuidor_id,
                            'distribuidor_nombre' => $dist ? trim("{$dist->apellidos} {$dist->nombres}") : null,
                            'distribuidor_patente' => $dist?->patente,
                        ];
                    }),
                ], 422));
            }

            $totalMonto = (float) $liquidaciones->sum('total_a_pagar');
            $cantidad = (int) $liquidaciones->count();

            $p = LiqPago::query()->create([
                'cliente_id' => (int) $validated['cliente_id'],
                'periodo_desde' => $validated['periodo_desde'],
                'periodo_hasta' => $validated['periodo_hasta'],
                'usuario_id' => $request->user()?->id,
                'estado' => 'generado',
                'cantidad_items' => $cantidad,
                'total_monto' => $totalMonto,
            ]);

            foreach ($liquidaciones as $l) {
                LiqPagoItem::query()->create([
                    'pago_id' => $p->id,
                    'liquidacion_distribuidor_id' => $l->id,
                    'distribuidor_id' => $l->distribuidor_id,
                    'monto' => $l->total_a_pagar,
                    'cbu_alias' => $l->distribuidor?->cbu_alias,
                ]);
            }

            LiqLiquidacionDistribuidor::query()
                ->whereIn('id', $liquidaciones->pluck('id')->all())
                ->update(['pago_id' => $p->id]);

            return $p;
        });

        $pago->load('cliente:id,nombre_corto', 'usuario:id,name');

        return response()->json([
            'data' => [
                ...$pago->toArray(),
                'cliente_nombre' => $pago->cliente?->nombre_corto,
                'usuario_nombre' => $pago->usuario?->name,
            ],
        ], 201);
    }

    public function marcarPagado(Request $request, LiqPago $pago): JsonResponse
    {
        $this->authorize($request);

        if ($pago->estado !== 'generado') {
            return response()->json([
                'message' => "Solo se pueden marcar como pagados los lotes en estado 'generado'.",
            ], 422);
        }

        $validated = $request->validate([
            'fecha_pago' => ['nullable', 'date'],
            'referencia' => ['nullable', 'string', 'max:255'],
        ]);

        $fechaPago = $validated['fecha_pago'] ?? now();
        $referencia = $validated['referencia'] ?? null;
        $userId = $request->user()?->id;

        DB::transaction(function () use ($pago, $fechaPago, $referencia, $userId) {
            $pago->update([
                'estado' => 'pagado',
                'fecha_pago' => $fechaPago,
                'referencia' => $referencia,
            ]);

            LiqLiquidacionDistribuidor::query()
                ->where('pago_id', $pago->id)
                ->where('estado', 'aprobada')
                ->update([
                    'estado' => 'pagada',
                    'fecha_pago' => $fechaPago,
                    'pagado_por' => $userId,
                    'pago_referencia' => $referencia,
                ]);
        });

        return response()->json(['data' => $pago->fresh()]);
    }

    public function exportCsv(Request $request, LiqPago $pago): StreamedResponse
    {
        $this->authorize($request);

        $pago->load('cliente:id,nombre_corto');

        $items = $pago->items()
            ->with(['distribuidor:id,nombres,apellidos,patente,cuil'])
            ->orderBy('id')
            ->get();

        $filename = sprintf(
            'liq_pagos_%s_%s_%s.csv',
            $pago->cliente?->nombre_corto ?? ('cliente_' . $pago->cliente_id),
            $pago->periodo_desde->format('Ymd'),
            $pago->periodo_hasta->format('Ymd')
        );

        return response()->streamDownload(function () use ($items, $pago) {
            $out = fopen('php://output', 'w');
            if (! $out) {
                return;
            }

            // Separador ';' típico AR para Excel
            fputcsv($out, [
                'pago_id',
                'liquidacion_distribuidor_id',
                'distribuidor_id',
                'distribuidor_nombre',
                'distribuidor_patente',
                'distribuidor_cuit',
                'cbu_alias',
                'monto',
                'periodo_desde',
                'periodo_hasta',
            ], ';');

            foreach ($items as $i) {
                $dist = $i->distribuidor;
                $nombre = $dist ? trim("{$dist->apellidos} {$dist->nombres}") : '';

                fputcsv($out, [
                    $pago->id,
                    $i->liquidacion_distribuidor_id,
                    $i->distribuidor_id,
                    $nombre,
                    $dist?->patente ?? '',
                    $dist?->cuil ?? '',
                    $i->cbu_alias ?? '',
                    (string) $i->monto,
                    $pago->periodo_desde->format('Y-m-d'),
                    $pago->periodo_hasta->format('Y-m-d'),
                ], ';');
            }

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function authorize(Request $request): void
    {
        $user = $request->user();
        $role = strtolower(trim((string) ($user?->role ?? '')));
        $perms = is_array($user?->permissions) ? $user->permissions : [];

        $allowed = in_array($role, ['admin', 'admin2', 'encargado'], true)
            || in_array('liquidaciones', $perms, true);

        if (! $allowed) {
            abort(response()->json(['message' => 'Sin permisos para liquidaciones.'], 403));
        }
    }
}

<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqLiquidacionDistribuidor;
use App\Models\LiqOperacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class LiqDistribuidorController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize($request);

        $query = LiqLiquidacionDistribuidor::query()
            ->with(['distribuidor:id,nombres,apellidos,patente,cuit_cuil', 'liquidacionCliente:id,cliente_id,archivo_origen,periodo_desde,periodo_hasta'])
            ->with('liquidacionCliente.cliente:id,nombre_corto')
            ->orderByDesc('id');

        if ($clienteId = $request->integer('cliente_id')) {
            $query->whereHas('liquidacionCliente', fn ($q) => $q->where('cliente_id', $clienteId));
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
        $buscar = trim((string) $request->input('buscar', ''));
        if ($buscar !== '') {
            $query->whereHas('distribuidor', function ($q) use ($buscar) {
                $q->where('apellidos', 'like', "%{$buscar}%")
                    ->orWhere('nombres', 'like', "%{$buscar}%")
                    ->orWhere('patente', 'like', "%{$buscar}%");
            });
        }

        $paginator = $query->paginate($request->integer('per_page', 100));

        $items = collect($paginator->items())->map(fn (LiqLiquidacionDistribuidor $l) => $this->format($l));

        return response()->json([
            'data' => $items,
            'meta' => [
                'total'        => $paginator->total(),
                'per_page'     => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
            ],
        ]);
    }

    public function operaciones(Request $request, LiqLiquidacionDistribuidor $liqDistribuidor): JsonResponse
    {
        $this->authorize($request);

        $ops = LiqOperacion::query()
            ->where('liquidacion_cliente_id', $liqDistribuidor->liquidacion_cliente_id)
            ->where('distribuidor_id', $liqDistribuidor->distribuidor_id)
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $ops]);
    }

    public function aprobar(Request $request, LiqLiquidacionDistribuidor $liqDistribuidor): JsonResponse
    {
        $this->authorize($request);

        if ($liqDistribuidor->estado !== 'generada') {
            return response()->json([
                'message' => "Solo se pueden aprobar liquidaciones en estado 'generada'.",
            ], 422);
        }

        $liqDistribuidor->update(['estado' => 'aprobada']);

        return response()->json(['data' => $this->format($liqDistribuidor->fresh())]);
    }

    public function pdf(Request $request, LiqLiquidacionDistribuidor $liqDistribuidor): JsonResponse
    {
        $this->authorize($request);

        if (! $liqDistribuidor->pdf_path || ! Storage::disk('public')->exists($liqDistribuidor->pdf_path)) {
            return response()->json(['message' => 'PDF no disponible todavía.'], 404);
        }

        return response()->json(['data' => ['url' => $liqDistribuidor->pdf_url]]);
    }

    private function format(LiqLiquidacionDistribuidor $l): array
    {
        $dist = $l->distribuidor;
        $nombre = $dist
            ? trim("{$dist->apellidos} {$dist->nombres}")
            : null;

        return [
            ...$l->toArray(),
            'distribuidor_nombre'  => $nombre,
            'distribuidor_patente' => $dist?->patente,
            'distribuidor_cuit'    => $dist?->cuit_cuil,
            'pdf_url'              => $l->pdf_url,
        ];
    }

    private function authorize(Request $request): void
    {
        $user  = $request->user();
        $role  = strtolower(trim((string) ($user?->role ?? '')));
        $perms = is_array($user?->permissions) ? $user->permissions : [];

        $allowed = in_array($role, ['admin', 'admin2', 'encargado'], true)
            || in_array('liquidaciones', $perms, true);

        if (! $allowed) {
            abort(response()->json(['message' => 'Sin permisos para liquidaciones.'], 403));
        }
    }
}

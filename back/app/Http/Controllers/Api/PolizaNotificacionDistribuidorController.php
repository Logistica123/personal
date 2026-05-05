<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Poliza;
use App\Models\PolizaNotificacionDistribuidor;
use App\Services\Polizas\NotifDistribuidorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PolizaNotificacionDistribuidorController extends Controller
{
    public function __construct(private readonly NotifDistribuidorService $service)
    {
    }

    public function preview(Request $request, Poliza $poliza): JsonResponse
    {
        $admin = $request->user();
        if (!$admin) return response()->json(['message' => 'No autenticado.'], 401);

        return response()->json(['data' => $this->service->preview($poliza, $admin)]);
    }

    public function enviar(Request $request, Poliza $poliza): JsonResponse
    {
        $data = $request->validate([
            'asegurados_ids'   => ['nullable', 'array'],
            'asegurados_ids.*' => ['integer', 'exists:polizas_asegurados,id'],
        ]);
        $admin = $request->user();
        if (!$admin) return response()->json(['message' => 'No autenticado.'], 401);

        return response()->json([
            'data' => $this->service->enviar($poliza, $data['asegurados_ids'] ?? [], $admin),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = PolizaNotificacionDistribuidor::query()
            ->with([
                'poliza:id,nombre_descriptivo,numero_poliza,aseguradora_id',
                'poliza.aseguradora:id,nombre',
                'persona:id,apellidos,nombres,cuil,email',
            ])
            ->orderByDesc('id');

        if ($estado = $request->query('estado'))    $query->where('estado', $estado);
        if ($pid    = $request->query('poliza_id')) $query->where('poliza_id', $pid);

        return response()->json(['data' => $query->paginate(100)->items()]);
    }

    public function reenviar(Request $request, PolizaNotificacionDistribuidor $notificacion): JsonResponse
    {
        $admin = $request->user();
        if (!$admin) return response()->json(['message' => 'No autenticado.'], 401);
        return response()->json(['data' => $this->service->reenviar($notificacion, $admin)]);
    }
}

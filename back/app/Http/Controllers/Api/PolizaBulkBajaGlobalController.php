<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PolizaBulkBajaGlobal;
use App\Services\Polizas\BulkBajaGlobalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ADDENDUM 14 Parte C — endpoints del flow "Baja masiva global".
 *
 *   POST /api/polizas/bulk-bajas-global/buscar       body: { lineas: [...] }
 *   POST /api/polizas/bulk-bajas-global/crear        body: { input_raw, seleccion, totales }
 *   GET  /api/polizas/bulk-bajas-global/{bulk}/preview
 *   POST /api/polizas/bulk-bajas-global/{bulk}/ejecutar
 *   GET  /api/polizas/bulk-bajas-global/{bulk}
 *   GET  /api/polizas/bulk-bajas-global                       (historial del admin)
 *
 * Permiso: `puede_bulk_bajas_global` (default false). Requerido para `crear`
 * y `ejecutar` — los endpoints de lectura permiten ver el resultado a otros
 * admins con `puede_ver_auditoria`.
 */
class PolizaBulkBajaGlobalController extends Controller
{
    public function __construct(private readonly BulkBajaGlobalService $service)
    {
    }

    public function buscar(Request $request): JsonResponse
    {
        $data = $request->validate([
            'lineas'   => ['required', 'array', 'min:1', 'max:1000'],
            'lineas.*' => ['nullable', 'string', 'max:50'],
        ]);
        $resultado = $this->service->buscar($data['lineas']);
        return response()->json(['data' => $resultado]);
    }

    public function crear(Request $request): JsonResponse
    {
        $data = $request->validate([
            'input_raw'         => ['required', 'string'],
            'seleccion'         => ['required', 'array', 'min:1'],
            'seleccion.*'       => ['required', 'array', 'min:1'],
            'seleccion.*.*'     => ['integer'],
            'totales_busqueda'  => ['nullable', 'array'],
        ]);
        $admin = $request->user();
        $bulk = $this->service->crearSolicitudes(
            $admin,
            $data['input_raw'],
            $data['seleccion'],
            $data['totales_busqueda'] ?? [],
        );
        return response()->json(['data' => [
            'bulk_id' => $bulk->id,
            'cantidad_solicitudes_creadas' => $bulk->cantidad_solicitudes_creadas,
        ]], 201);
    }

    public function preview(PolizaBulkBajaGlobal $bulk): JsonResponse
    {
        return response()->json(['data' => $this->service->preview($bulk)]);
    }

    public function ejecutar(Request $request, PolizaBulkBajaGlobal $bulk): JsonResponse
    {
        // El envío secuencial de N correos puede demorar — extiendo timeout.
        @set_time_limit(180);
        $resultado = $this->service->ejecutar($bulk);
        return response()->json(['data' => $resultado]);
    }

    public function show(PolizaBulkBajaGlobal $bulk): JsonResponse
    {
        $bulk->load([
            'administrativo:id,name,email',
            'solicitudes:id,bulk_baja_global_id,poliza_id,estado,enviado_en,email_message_id',
            'solicitudes.poliza:id,nombre_descriptivo,aseguradora_id',
            'solicitudes.poliza.aseguradora:id,nombre',
        ]);
        return response()->json(['data' => [
            'id'                          => $bulk->id,
            'fecha_ejecucion'             => $bulk->fecha_ejecucion?->toIso8601String(),
            'completado_en'               => $bulk->completado_en?->toIso8601String(),
            'estado'                      => $bulk->estado,
            'administrativo'              => $bulk->administrativo?->only(['id', 'name', 'email']),
            'input_raw'                   => $bulk->input_raw,
            'cantidad_identificadores'    => $bulk->cantidad_identificadores,
            'cantidad_encontrados'        => $bulk->cantidad_encontrados,
            'cantidad_no_encontrados'     => $bulk->cantidad_no_encontrados,
            'cantidad_solicitudes_creadas'=> $bulk->cantidad_solicitudes_creadas,
            'cantidad_correos_enviados'   => $bulk->cantidad_correos_enviados,
            'cantidad_correos_fallidos'   => $bulk->cantidad_correos_fallidos,
            'solicitudes' => $bulk->solicitudes->map(fn ($s) => [
                'id'           => $s->id,
                'poliza_id'    => $s->poliza_id,
                'poliza_nombre'=> $s->poliza?->nombre_descriptivo,
                'aseguradora'  => $s->poliza?->aseguradora?->nombre,
                'estado'       => $s->estado,
                'enviado_en'   => $s->enviado_en?->toIso8601String(),
                'message_id'   => $s->email_message_id,
            ])->values()->all(),
        ]]);
    }

    public function index(Request $request): JsonResponse
    {
        $admin = $request->user();
        $rows = PolizaBulkBajaGlobal::query()
            ->where('administrativo_user_id', $admin->id)
            ->orderByDesc('fecha_ejecucion')
            ->limit((int) min($request->query('limit', 50), 200))
            ->get(['id', 'fecha_ejecucion', 'estado', 'cantidad_identificadores',
                   'cantidad_encontrados', 'cantidad_solicitudes_creadas',
                   'cantidad_correos_enviados', 'cantidad_correos_fallidos', 'completado_en']);
        return response()->json(['data' => $rows]);
    }
}

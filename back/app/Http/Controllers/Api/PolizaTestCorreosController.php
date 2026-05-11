<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PolizaTestCorreo;
use App\Services\Polizas\TestCorreosService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ADDENDUM 14 Parte A — endpoints para los tests E2E del flujo de correos.
 *
 *   POST /api/polizas/test-correos/envio-basico   body: { destinatario? }
 *   POST /api/polizas/test-correos/loop-completo
 *   POST /api/polizas/test-correos/con-adjunto
 *   GET  /api/polizas/test-correos/ultimos
 *
 * Cada usuario solo ve y ejecuta tests sobre SU propia cuenta OAuth.
 */
class PolizaTestCorreosController extends Controller
{
    public function __construct(private readonly TestCorreosService $service)
    {
    }

    public function envioBasico(Request $request): JsonResponse
    {
        $data = $request->validate([
            'destinatario' => 'nullable|email',
        ]);
        $admin = $request->user();
        $destinatario = $data['destinatario']
            ?? optional($admin->polizasOAuthAccount ?? null)->ms_account_email
            ?? $admin->email;

        $log = $this->service->envioBasico($admin, $destinatario);
        return response()->json(['data' => $this->serializar($log)]);
    }

    public function loopCompleto(Request $request): JsonResponse
    {
        // Test 2 hace polling hasta 60s; el HTTP request va a esperar lo mismo.
        @set_time_limit(120);
        $log = $this->service->loopCompleto($request->user());
        return response()->json(['data' => $this->serializar($log)]);
    }

    public function conAdjunto(Request $request): JsonResponse
    {
        @set_time_limit(60);
        $log = $this->service->conAdjunto($request->user());
        return response()->json(['data' => $this->serializar($log)]);
    }

    public function ultimos(Request $request): JsonResponse
    {
        $admin = $request->user();
        $rows = $this->service->ultimosDelAdmin($admin, (int) $request->query('limit', 10));
        return response()->json(['data' => $rows]);
    }

    private function serializar(PolizaTestCorreo $t): array
    {
        return [
            'id'            => $t->id,
            'tipo_test'     => $t->tipo_test,
            'fecha_inicio'  => $t->fecha_inicio?->toIso8601String(),
            'fecha_fin'     => $t->fecha_fin?->toIso8601String(),
            'duracion_ms'   => $t->fecha_fin && $t->fecha_inicio
                ? (int) round($t->fecha_inicio->diffInMilliseconds($t->fecha_fin))
                : null,
            'estado'        => $t->estado,
            'paso_fallo'    => $t->paso_fallo,
            'detalle_error' => $t->detalle_error,
            'metadata'      => $t->metadata,
        ];
    }
}

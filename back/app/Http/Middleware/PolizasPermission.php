<?php

namespace App\Http\Middleware;

use App\Models\PolizaAdminPermiso;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Bloque B — middleware que valida un flag de `polizas_admin_permisos` para
 * el user actual.
 *
 *     Route::post('/polizas/{poliza}/cargar-pdf', ...)->middleware('polizas.permission:puede_cargar_pdf');
 *
 * Reglas:
 *  - Si el user tiene `role='admin'`: pasa siempre (super admin del sistema).
 *  - Si tiene fila en `polizas_admin_permisos` y el flag = true: pasa.
 *  - Caso contrario: 403.
 */
class PolizasPermission
{
    public function handle(Request $request, Closure $next, string $flag): Response
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        if (!in_array($flag, PolizaAdminPermiso::FLAGS, true)) {
            return response()->json(['message' => "Flag desconocido: {$flag}."], 500);
        }

        // Super-admin del sistema: pasa todos los flags.
        if (($user->role ?? null) === 'admin') {
            return $next($request);
        }

        $perm = PolizaAdminPermiso::query()->where('user_id', $user->id)->first();
        if (!$perm || !($perm->{$flag} ?? false)) {
            return response()->json([
                'message' => "No tenés permiso `{$flag}` en el módulo Pólizas. " .
                             'Pedí al admin del sistema que te lo asigne en /polizas/admins.',
            ], 403);
        }

        return $next($request);
    }
}

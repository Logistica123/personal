<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireAdminRole
{
    /**
     * Solo permite acceso a usuarios con rol admin o admin2.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        $role = strtolower($user->role ?? '');

        if (!in_array($role, ['admin', 'admin2'])) {
            return response()->json(['message' => 'No autorizado. Se requiere rol Admin.'], 403);
        }

        return $next($request);
    }
}

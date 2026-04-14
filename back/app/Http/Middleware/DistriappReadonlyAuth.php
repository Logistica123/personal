<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DistriappReadonlyAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $configuredKey = trim((string) config('services.distriapp_readonly.api_key', ''));

        if ($configuredKey === '') {
            return response()->json([
                'message' => 'API read-only no configurada. Falta DISTRIAPP_READONLY_API_KEY en el servidor.',
            ], 503);
        }

        $providedKey = $request->header('X-Distriapp-Key')
            ?: $request->query('api_key')
            ?: $request->bearerToken();

        if (! $providedKey || ! hash_equals($configuredKey, (string) $providedKey)) {
            return response()->json([
                'message' => 'API key inválida o no proporcionada.',
            ], 401);
        }

        return $next($request);
    }
}

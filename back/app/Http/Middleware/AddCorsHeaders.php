<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AddCorsHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $origin = $request->headers->get('Origin');
        $allowedOrigins = [
            'https://personal.distriapp.com.ar',
            'https://app.distriapp.com.ar',
            'capacitor://localhost',
            'ionic://localhost',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:4200',
            'http://127.0.0.1:4200',
            'http://localhost:4201',
            'http://127.0.0.1:4201',
            'http://localhost:4202',
            'http://127.0.0.1:4202',
            'http://localhost:8100',
            'http://127.0.0.1:8100',
        ];

        $normalizedOrigin = is_string($origin) ? trim($origin) : null;
        $isLocalhost = $normalizedOrigin && preg_match('#^https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?$#', $normalizedOrigin);
        $allowedOrigin = in_array($normalizedOrigin, $allowedOrigins, true)
            ? $normalizedOrigin
            : ($isLocalhost ? $normalizedOrigin : null);

        if (! $allowedOrigin && $normalizedOrigin) {
            // Origin no permitido pero explícito: devolvemos 403 sin comodines para que el navegador lo bloquee.
            return response()
                ->json(['message' => 'Origen no permitido.'], 403, [
                    'Access-Control-Allow-Origin' => 'null',
                    'Vary' => 'Origin',
                ]);
        }

        // Sin header Origin (peticiones directas), permitimos el primero de la lista para evitar wildcard.
        if (! $allowedOrigin) {
            $allowedOrigin = $allowedOrigins[0];
        }

        $headers = [
            'Access-Control-Allow-Origin' => $allowedOrigin,
            'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Api-Token',
            'Access-Control-Allow-Credentials' => 'true',
            'Vary' => 'Origin',
        ];

        if ($request->getMethod() === 'OPTIONS') {
            $response = response()->noContent(204);
            foreach ($headers as $key => $value) {
                $response->headers->remove($key);
                $response->headers->set($key, $value);
            }

            return $response;
        }

        $response = $next($request);

        foreach ($headers as $key => $value) {
            $response->headers->remove($key);
            $response->headers->set($key, $value);
        }

        return $response;
    }
}

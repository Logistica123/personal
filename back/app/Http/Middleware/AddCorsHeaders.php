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
            'http://localhost:3000',
            'http://127.0.0.1:3000',
        ];

        $allowedOrigin = in_array($origin, $allowedOrigins, true) ? $origin : $allowedOrigins[0];

        $headers = [
            'Access-Control-Allow-Origin' => $allowedOrigin,
            'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
            'Access-Control-Allow-Credentials' => 'true',
        ];

        if ($request->getMethod() === 'OPTIONS') {
            return response()->noContent(204, $headers);
        }

        $response = $next($request);

        foreach ($headers as $key => $value) {
            $response->headers->set($key, $value);
        }

        return $response;
    }
}

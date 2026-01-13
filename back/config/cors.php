<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Ajustamos orígenes explícitos y permitimos credenciales para evitar
    | respuestas con "*" cuando el navegador envía cookies/Authorization.
    |
    */
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => [
        'https://personal.distriapp.com.ar',
        'https://app.distriapp.com.ar',
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
    ],

    'allowed_origins_patterns' => [
        '^https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?$',
    ],

    'allowed_headers' => ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Api-Token'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,
];

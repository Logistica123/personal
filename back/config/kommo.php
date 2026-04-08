<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Kommo CRM - API Configuration
    |--------------------------------------------------------------------------
    |
    | Token de larga duración generado desde la integración privada en Kommo.
    | api_domain viene del JWT (campo "api_domain").
    |
    */

    'subdomain' => env('KOMMO_SUBDOMAIN', ''),

    'access_token' => env('KOMMO_ACCESS_TOKEN', ''),

    'client_id' => env('KOMMO_CLIENT_ID', ''),
    'client_secret' => env('KOMMO_CLIENT_SECRET', ''),

    /*
    |--------------------------------------------------------------------------
    | Pipeline ID (Embudo)
    |--------------------------------------------------------------------------
    |
    | Si querés filtrar leads de un embudo específico, poné el pipeline_id.
    | Dejalo vacío para traer todos los leads.
    |
    */

    'pipeline_ids' => env('KOMMO_PIPELINE_IDS', ''),

    /*
    |--------------------------------------------------------------------------
    | Custom Field IDs
    |--------------------------------------------------------------------------
    |
    | Los campos personalizados en Kommo tienen IDs numéricos.
    | Ejecutá `php artisan kommo:list-fields` para descubrirlos.
    |
    */

    'fields' => [
        'sucursal' => env('KOMMO_FIELD_SUCURSAL', null),
        'vehiculo' => env('KOMMO_FIELD_VEHICULO', null),
        'empresa' => env('KOMMO_FIELD_EMPRESA', null),
        'nombre_distribuidor' => env('KOMMO_FIELD_NOMBRE_DISTRIBUIDOR', null),
    ],
];

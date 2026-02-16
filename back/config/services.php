<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],
    'openai' => [
        'key' => env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),
    ],

    'distriapp_mobile' => [
        'base_url' => env('DISTRIAPP_MOBILE_API_URL', 'https://api.distriapp.com.ar/api'),
        'token' => env('DISTRIAPP_MOBILE_API_TOKEN'),
        'timeout' => env('DISTRIAPP_MOBILE_API_TIMEOUT', 12),
        'live_endpoint' => env('DISTRIAPP_MOBILE_LIVE_ENDPOINT', 'v1/app/driver-geopositions/live'),
    ],

    'distriapp_admin' => [
        'base_url' => env('DISTRIAPP_ADMIN_API_URL', 'https://api.distriapp.com.ar/api'),
        'token' => env('DISTRIAPP_ADMIN_API_TOKEN'),
        'timeout' => env('DISTRIAPP_ADMIN_API_TIMEOUT', 12),
    ],

];

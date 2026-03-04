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

    'erp' => [
        'enabled' => env('ERP_INTEGRATION_ENABLED', false),
        'mock_mode' => env('ERP_MOCK_MODE', false),
        'mock_latency_ms' => env('ERP_MOCK_LATENCY_MS', 0),
        'base_url' => env('ERP_API_BASE_URL'),
        'token' => env('ERP_API_TOKEN'),
        'timeout' => env('ERP_API_TIMEOUT', 15),
        'distributor_endpoint' => env('ERP_DISTRIBUTOR_ENDPOINT', '/liquidaciones/distribuidor'),
        'billing_endpoint' => env('ERP_BILLING_ENDPOINT', '/liquidaciones/facturacion'),
        'queue_enabled' => env('ERP_PUBLISH_QUEUE_ENABLED', true),
        'publish_queue' => env('ERP_PUBLISH_QUEUE', 'erp-publish'),
        'publish_tries' => env('ERP_PUBLISH_TRIES', 3),
        'publish_backoff' => env('ERP_PUBLISH_BACKOFF', '10,30,90'),
    ],

    'voice' => [
        'driver' => env('VOICE_DRIVER', 'mock'),
        'token_ttl' => env('VOICE_TOKEN_TTL', 3600),
        'webhook_signature_validation' => env('VOICE_WEBHOOK_SIGNATURE_VALIDATION', true),
        'default_caller_id' => env('VOICE_DEFAULT_CALLER_ID'),
        'webrtc' => [
            'enabled' => env('WEBRTC_ENABLED', true),
            'ice_servers' => env('WEBRTC_ICE_SERVERS', 'stun:stun.l.google.com:19302'),
            'turn_username' => env('WEBRTC_TURN_USERNAME'),
            'turn_credential' => env('WEBRTC_TURN_CREDENTIAL'),
        ],
        'twilio' => [
            'enabled' => env('TWILIO_ENABLED', false),
            'account_sid' => env('TWILIO_ACCOUNT_SID'),
            'api_key_sid' => env('TWILIO_API_KEY_SID'),
            'api_key_secret' => env('TWILIO_API_KEY_SECRET'),
            'auth_token' => env('TWILIO_AUTH_TOKEN'),
            'twiml_app_sid' => env('TWILIO_TWIML_APP_SID'),
            'status_callback_url' => env('TWILIO_STATUS_CALLBACK_URL'),
            'outbound_twiml_url' => env('TWILIO_OUTBOUND_TWIML_URL'),
            'signature_url' => env('TWILIO_SIGNATURE_URL'),
        ],
    ],

    'whatsapp' => [
        'base_url' => env('WHATSAPP_BASE_URL', 'https://wa.me'),
    ],

];

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

    'arca' => [
        'cuit_emisor_default' => env('ARCA_DEFAULT_CUIT', '30717060985'),
        'emisor_razon_social' => env('ARCA_EMISOR_RAZON_SOCIAL', 'LOGISTICA ARGENTINA S.R.L.'),
        'emisor_condicion_iva' => env('ARCA_EMISOR_CONDICION_IVA', 'IVA Responsable Inscripto'),
        'emisor_domicilio' => env('ARCA_EMISOR_DOMICILIO', 'SAN CAYETANO 3470 - SAN CAYETANO'),
        'pto_venta_default' => (int) env('ARCA_PTO_VENTA_DEFAULT', 11),
        'ambiente_default' => env('ARCA_AMBIENTE_DEFAULT', 'PROD'),
        'cert_alias_default' => env('ARCA_CERT_ALIAS_DEFAULT', 'logarg-erp-wsfe-pv00011'),
        'service_name' => env('ARCA_WSAA_SERVICE', 'wsfe'),
        'ws_timeout' => (int) env('ARCA_WS_TIMEOUT', 30),
        'ca_bundle' => env('ARCA_CA_BUNDLE'),
        'ssl_ciphers' => env('ARCA_SSL_CIPHERS', 'DEFAULT:@SECLEVEL=1'),
        'certificate_cipher_key' => env('ARCA_CERTIFICATE_CIPHER_KEY'),
        'storage_disk' => env('ARCA_STORAGE_DISK', 'local'),
        'tmp_dir' => env('ARCA_TMP_DIR', storage_path('app/private/tmp')),
        'wsaa' => [
            'prod_wsdl' => env('ARCA_WSAA_PROD_WSDL', 'https://wsaa.afip.gov.ar/ws/services/LoginCms?WSDL'),
            'homo_wsdl' => env('ARCA_WSAA_HOMO_WSDL', 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?WSDL'),
        ],
        'wsfe' => [
            'prod_wsdl' => env('ARCA_WSFE_PROD_WSDL', 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL'),
            'homo_wsdl' => env('ARCA_WSFE_HOMO_WSDL', 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL'),
        ],
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
        'anura' => [
            'enabled' => env('ANURA_ENABLED', false),
            'api_base_url' => env('ANURA_API_BASE_URL', 'https://api.anura.com.ar'),
            'click2dial_endpoint' => env('ANURA_CLICK2DIAL_ENDPOINT'),
            'click2dial_token' => env('ANURA_CLICK2DIAL_TOKEN'),
            'webhook_token' => env('ANURA_WEBHOOK_TOKEN'),
            'timeout' => env('ANURA_TIMEOUT', 15),
        ],
    ],

    'whatsapp' => [
        'base_url' => env('WHATSAPP_BASE_URL', 'https://wa.me'),
    ],

    'transportista_qr' => [
        'landing_url' => env('TRANSPORTISTA_QR_LANDING_URL', 'https://www.logisticaargentinasrl.com.ar/'),
        'qr_service_base_url' => env('TRANSPORTISTA_QR_IMAGE_SERVICE_URL', 'https://api.qrserver.com/v1/create-qr-code/'),
        'redirect_base_url' => env('TRANSPORTISTA_QR_REDIRECT_BASE_URL'),
    ],

    'reclamos_adelantos' => [
        'approver_emails' => env('RECLAMOS_ADELANTOS_APPROVER_EMAILS', ''),
    ],

];

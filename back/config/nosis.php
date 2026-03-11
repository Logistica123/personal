<?php

$validationBaseUrl = env('NOSIS_BASE_URL', 'https://ws02.nosis.com/api/validacion');
$username = env('NOSIS_USERNAME');
$token = env('NOSIS_TOKEN');

return [
    'base_url' => $validationBaseUrl,
    'username' => $username,
    'token' => $token,
    'group_id' => env('NOSIS_GROUP_ID'),
    'timeout' => (int) env('NOSIS_TIMEOUT', 10),
    'cost_per_query' => (float) env('NOSIS_COST_PER_QUERY', 0),
    'validation' => [
        'base_url' => $validationBaseUrl,
        'username' => $username,
        'token' => $token,
    ],
    'variables' => [
        'base_url' => env('NOSIS_VARIABLES_BASE_URL', 'https://ws01.nosis.com/api'),
        'api_key' => env('NOSIS_API_KEY', $token),
        'username' => env('NOSIS_VARIABLES_USERNAME', $username),
        'token' => env('NOSIS_VARIABLES_TOKEN', $token),
        'format' => env('NOSIS_VARIABLES_FORMAT', 'XML'),
        'fex' => env('NOSIS_VARIABLES_FEX'),
        'fallback_to_validation' => filter_var(
            env('NOSIS_VARIABLES_FALLBACK_TO_VALIDATION', true),
            FILTER_VALIDATE_BOOL
        ),
    ],
];

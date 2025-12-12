<?php

return [
    'base_url' => env('NOSIS_BASE_URL', 'https://ws02.nosis.com/api/validacion'),
    'username' => env('NOSIS_USERNAME'),
    'token' => env('NOSIS_TOKEN'),
    'group_id' => env('NOSIS_GROUP_ID'),
    'timeout' => (int) env('NOSIS_TIMEOUT', 10),
];

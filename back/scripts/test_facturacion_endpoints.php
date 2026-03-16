<?php

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;

putenv('DB_HOST=localhost');
putenv('DB_SOCKET=/run/mysqld/mysqld.sock');
$_ENV['DB_HOST'] = 'localhost';
$_ENV['DB_SOCKET'] = '/run/mysqld/mysqld.sock';
$_SERVER['DB_HOST'] = 'localhost';
$_SERVER['DB_SOCKET'] = '/run/mysqld/mysqld.sock';

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';

/** @var Kernel $kernel */
$kernel = $app->make(Kernel::class);

$token = 'devtoken';

/**
 * @param array<string, mixed>|null $payload
 */
function callApi(Kernel $kernel, string $method, string $uri, ?array $payload = null, string $token = ''): array
{
    $server = [
        'HTTP_ACCEPT' => 'application/json',
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_API_TOKEN' => $token,
    ];

    $body = $payload ? json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;
    $request = Request::create($uri, $method, [], [], [], $server, $body);
    $response = $kernel->handle($request);
    $kernel->terminate($request, $response);

    $content = (string) $response->getContent();
    $decoded = json_decode($content, true);

    return [
        'status' => $response->getStatusCode(),
        'body' => $decoded ?? $content,
    ];
}

function printStep(string $title, array $result): void
{
    echo "=== {$title} ===\n";
    echo "Status: {$result['status']}\n";
    if (is_array($result['body'])) {
        echo json_encode($result['body'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    } else {
        echo $result['body'] . "\n";
    }
    echo "\n";
}

// 1) Emisores
$emisores = callApi($kernel, 'GET', '/api/arca/emisores?with_relations=1', null, $token);
printStep('GET /api/arca/emisores?with_relations=1', $emisores);

$emisorId = null;
if (is_array($emisores['body']) && isset($emisores['body']['data']) && is_array($emisores['body']['data'])) {
    $first = $emisores['body']['data'][0] ?? null;
    if (is_array($first) && isset($first['id'])) {
        $emisorId = (int) $first['id'];
    }
}

if (! $emisorId) {
    $createEmisor = callApi($kernel, 'POST', '/api/arca/emisores', [
        'razon_social' => 'LOGISTICA ARGENTINA S.R.L.',
        'cuit' => 30717060985,
        'condicion_iva' => 'Responsable Inscripto',
        'ambiente_default' => 'PROD',
        'activo' => true,
    ], $token);
    printStep('POST /api/arca/emisores', $createEmisor);
    if (is_array($createEmisor['body']) && isset($createEmisor['body']['data']['id'])) {
        $emisorId = (int) $createEmisor['body']['data']['id'];
    }
}

// 2) Clientes selector
$clientes = callApi($kernel, 'GET', '/api/clientes/select?limit=10', null, $token);
printStep('GET /api/clientes/select?limit=10', $clientes);

$clienteId = null;
$clienteNombre = 'Cliente';
$clienteDoc = '';
$sucursales = null;
$sucursalId = null;
$sucursalDireccion = '';

if (is_array($clientes['body']) && isset($clientes['body']['data']) && is_array($clientes['body']['data'])) {
    foreach ($clientes['body']['data'] as $candidate) {
        if (! is_array($candidate) || ! isset($candidate['id'])) {
            continue;
        }
        $candidateId = (int) $candidate['id'];
        $candidateNombre = (string) ($candidate['nombre'] ?? 'Cliente');
        $candidateDoc = (string) ($candidate['documento_fiscal'] ?? '');

        $candidateSucursales = callApi($kernel, 'GET', "/api/clientes/{$candidateId}/sucursales", null, $token);
        if (is_array($candidateSucursales['body'])
            && isset($candidateSucursales['body']['data'])
            && is_array($candidateSucursales['body']['data'])
            && count($candidateSucursales['body']['data']) > 0
        ) {
            $clienteId = $candidateId;
            $clienteNombre = $candidateNombre;
            $clienteDoc = $candidateDoc;
            $sucursales = $candidateSucursales;
            break;
        }
    }
}

if (! $clienteId || ! $sucursales) {
    echo "No hay clientes con sucursales disponibles para probar facturas.\n";
    exit(0);
}

// 3) Sucursales del cliente seleccionado
printStep("GET /api/clientes/{$clienteId}/sucursales", $sucursales);

if (is_array($sucursales['body']) && isset($sucursales['body']['data']) && is_array($sucursales['body']['data'])) {
    $firstSucursal = $sucursales['body']['data'][0] ?? null;
    if (is_array($firstSucursal) && isset($firstSucursal['id'])) {
        $sucursalId = (int) $firstSucursal['id'];
        $sucursalDireccion = (string) ($firstSucursal['direccion'] ?? '');
    }
}

if (! $sucursalId) {
    echo "El cliente {$clienteId} no tiene sucursales para probar facturas.\n";
    exit(0);
}

// 4) Crear borrador
$docDigits = preg_replace('/\D+/', '', $clienteDoc);
$docNro = strlen($docDigits) === 11 ? (int) $docDigits : 20123456789;

$draftPayload = [
    'emisor_id' => $emisorId ?: 1,
    'ambiente' => 'PROD',
    'pto_vta' => 11,
    'cbte_tipo' => 1,
    'concepto' => 2,
    'doc_tipo' => 80,
    'doc_nro' => $docNro,
    'cliente_id' => $clienteId,
    'sucursal_id' => $sucursalId,
    'cliente_nombre' => $clienteNombre,
    'cliente_domicilio' => $sucursalDireccion ?: 'Sin domicilio',
    'fecha_cbte' => date('Y-m-d'),
    'fecha_serv_desde' => date('Y-m-01'),
    'fecha_serv_hasta' => date('Y-m-t'),
    'fecha_vto_pago' => date('Y-m-d', strtotime('+30 days')),
    'moneda_id' => 'PES',
    'moneda_cotiz' => 1,
    'imp_total' => 23405.37,
    'imp_tot_conc' => 0,
    'imp_neto' => 19343.28,
    'imp_op_ex' => 0,
    'imp_iva' => 4062.09,
    'imp_trib' => 0,
    'anio_facturado' => (int) date('Y'),
    'mes_facturado' => (int) date('m'),
    'periodo_facturado' => 'MES_COMPLETO',
    'fecha_aprox_cobro' => date('Y-m-d', strtotime('+40 days')),
    'observaciones_cobranza' => 'Cuenta corriente',
    'iva' => [
        [
            'iva_id' => 5,
            'base_imp' => 19343.28,
            'importe' => 4062.09,
        ],
    ],
    'detalle_pdf' => [
        [
            'orden' => 1,
            'descripcion' => 'Servicio logistico mensual',
            'cantidad' => 1,
            'unidad_medida' => 'servicio',
            'precio_unitario' => 19343.28,
            'bonificacion_pct' => 0,
            'subtotal' => 19343.28,
            'alicuota_iva_pct' => 21,
            'subtotal_con_iva' => 23405.37,
        ],
    ],
];

$draft = callApi($kernel, 'POST', '/api/facturas', $draftPayload, $token);
printStep('POST /api/facturas', $draft);

$facturaId = null;
if (is_array($draft['body']) && isset($draft['body']['data']['id'])) {
    $facturaId = (int) $draft['body']['data']['id'];
}

if ($facturaId) {
    // 5) Validar
    $validar = callApi($kernel, 'POST', "/api/facturas/{$facturaId}/validar", null, $token);
    printStep("POST /api/facturas/{$facturaId}/validar", $validar);

    // 6) Emitir (espera error por falta de certificado)
    $emitir = callApi($kernel, 'POST', "/api/facturas/{$facturaId}/emitir", null, $token);
    printStep("POST /api/facturas/{$facturaId}/emitir", $emitir);

    // 7) Detalle
    $detalle = callApi($kernel, 'GET', "/api/facturas/{$facturaId}", null, $token);
    printStep("GET /api/facturas/{$facturaId}", $detalle);

    // 8) Cobranza
    $cobranza = callApi($kernel, 'POST', "/api/facturas/{$facturaId}/actualizar-cobranza", [
        'fecha_aprox_cobro' => date('Y-m-d', strtotime('+45 days')),
        'fecha_pago_manual' => null,
        'monto_pagado_manual' => null,
        'observaciones_cobranza' => 'Seguimiento inicial',
    ], $token);
    printStep("POST /api/facturas/{$facturaId}/actualizar-cobranza", $cobranza);

    // 9) Historial cobranza
    $historial = callApi($kernel, 'GET', "/api/facturas/{$facturaId}/historial-cobranza", null, $token);
    printStep("GET /api/facturas/{$facturaId}/historial-cobranza", $historial);
}

// 10) Resumen clientes facturacion
$resumen = callApi($kernel, 'GET', "/api/clientes-facturacion/resumen?cliente_id={$clienteId}", null, $token);
printStep("GET /api/clientes-facturacion/resumen?cliente_id={$clienteId}", $resumen);

<?php

/**
 * Backfill one-off: poblar dimensiones_valores en líneas v5 (ruta_codigo seteado)
 * que tienen el campo vacío — heredado del importador viejo LiqExcelV5ImportService.
 *
 * No es estrictamente necesario (el fallback en LiqTarifaController::queryLineasPorDimensiones
 * maneja el caso), pero normaliza los datos para futuras queries.
 *
 * Uso desde la raíz del proyecto back/:
 *   php database/scripts/backfill_dimensiones_v5.php
 */

require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

// Cubrimos todas las representaciones de "vacío" vistas:
//   '[]', '{}'        — JSON directo
//   '"[]"', '"{}"'    — JSON double-encoded (del importador viejo v5 que hacía
//                        json_encode() sobre un string ya JSON)
//   NULL              — columnas null
// Match por string directo es portable entre MySQL y MariaDB.
$rows = DB::table('liq_lineas_tarifa')
    ->whereNotNull('ruta_codigo')
    ->where(function ($q) {
        $q->whereNull('dimensiones_valores')
          ->orWhereIn('dimensiones_valores', ['[]', '{}', '"[]"', '"{}"']);
    })
    ->get(['id', 'ruta_codigo', 'capacidad_vehiculo_kg', 'es_tarifa_base', 'distribuidor_nombre', 'patente_match']);

echo "Candidatas: {$rows->count()}" . PHP_EOL;

$updated = 0;
foreach ($rows as $r) {
    $dims = [
        'ruta'           => $r->ruta_codigo,
        'capacidad'      => (string) $r->capacidad_vehiculo_kg,
        'es_tarifa_base' => $r->es_tarifa_base ? '1' : '0',
    ];
    if ($r->distribuidor_nombre) $dims['distribuidor'] = $r->distribuidor_nombre;
    if ($r->patente_match)       $dims['patente']      = $r->patente_match;

    DB::table('liq_lineas_tarifa')
        ->where('id', $r->id)
        ->update(['dimensiones_valores' => json_encode($dims, JSON_UNESCAPED_UNICODE)]);
    $updated++;
}

echo "Actualizadas: {$updated}" . PHP_EOL;

<?php

/**
 * Diagnóstico: por qué los overrides del esquema no matchean con ops.
 *
 * Uso:
 *   php database/scripts/diagnostico_overrides.php <esquema_id> <liquidacion_id>
 */

require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$esquemaId = (int) ($argv[1] ?? 0);
$liqId = (int) ($argv[2] ?? 0);
if (!$esquemaId || !$liqId) { echo "Uso: php diagnostico_overrides.php <esquema_id> <liquidacion_id>\n"; exit(1); }

$overrides = DB::table('liq_lineas_tarifa')
    ->where('esquema_id', $esquemaId)
    ->where('es_tarifa_base', false)
    ->get(['id', 'ruta_codigo', 'capacidad_vehiculo_kg', 'distribuidor_nombre', 'patente_match', 'activo']);

echo "=== Overrides del esquema #$esquemaId ({$overrides->count()} total) ===\n\n";

foreach ($overrides as $o) {
    echo "Override #{$o->id}: ruta={$o->ruta_codigo} cap={$o->capacidad_vehiculo_kg} dist='{$o->distribuidor_nombre}' pat='{$o->patente_match}' act={$o->activo}\n";

    // Match por patente
    if ($o->patente_match) {
        $ops = DB::table('liq_operaciones')
            ->where('liquidacion_cliente_id', $liqId)
            ->where('concepto', $o->ruta_codigo)
            ->where('dominio', $o->patente_match)
            ->get(['id', 'capacidad_vehiculo_kg', 'distribuidor_id']);
        if ($ops->isEmpty()) {
            echo "  [PATENTE] 0 ops con ruta={$o->ruta_codigo} + dominio={$o->patente_match}\n";
        } else {
            $iguales = $ops->where('capacidad_vehiculo_kg', $o->capacidad_vehiculo_kg)->count();
            $diffCaps = $ops->pluck('capacidad_vehiculo_kg')->unique()->implode(',');
            echo "  [PATENTE] {$ops->count()} ops (cap override={$o->capacidad_vehiculo_kg}, caps en ops: [$diffCaps])";
            echo $iguales > 0 ? " · $iguales con CAP COINCIDENTE ✓\n" : " · *** NINGUNA coincide en cap ***\n";
        }
    }

    // Match por distribuidor_nombre
    if ($o->distribuidor_nombre) {
        $target = strtoupper(trim($o->distribuidor_nombre));
        // Buscar ops cuyo distribuidor matchee
        $opsConDist = DB::table('liq_operaciones')
            ->where('liq_operaciones.liquidacion_cliente_id', $liqId)
            ->where('liq_operaciones.concepto', $o->ruta_codigo)
            ->join('personas', 'personas.id', '=', 'liq_operaciones.distribuidor_id')
            ->select('liq_operaciones.id', 'liq_operaciones.capacidad_vehiculo_kg',
                     DB::raw("UPPER(TRIM(CONCAT(personas.apellidos, ' ', personas.nombres))) as nombre_ap"),
                     DB::raw("UPPER(TRIM(CONCAT(personas.nombres, ' ', personas.apellidos))) as nombre_na"))
            ->get();

        $matching = $opsConDist->filter(fn($op) =>
            strtoupper(trim($op->nombre_ap)) === $target ||
            strtoupper(trim($op->nombre_na)) === $target
        );

        if ($matching->isEmpty()) {
            echo "  [DIST] 0 ops con ruta={$o->ruta_codigo} + distribuidor='{$o->distribuidor_nombre}'\n";
            // Sugerir por qué: ver nombres parecidos
            $parecidos = DB::table('liq_operaciones')
                ->where('liq_operaciones.liquidacion_cliente_id', $liqId)
                ->where('liq_operaciones.concepto', $o->ruta_codigo)
                ->join('personas', 'personas.id', '=', 'liq_operaciones.distribuidor_id')
                ->select(DB::raw("DISTINCT UPPER(TRIM(CONCAT(personas.apellidos, ' ', personas.nombres))) as nombre"))
                ->limit(5)
                ->pluck('nombre');
            if ($parecidos->isNotEmpty()) {
                echo "      Nombres distribuidor en ops esa ruta: " . $parecidos->implode(' | ') . "\n";
            }
        } else {
            echo "  [DIST] {$matching->count()} ops ✓\n";
        }
    }
}

echo "\n=== FIN ===\n";

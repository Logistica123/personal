<?php

/**
 * Diagnóstico: por qué el motor OCASA no matchea NINGUNA operación.
 *
 * Revisa:
 *   1. ¿Las ops tienen capacidad_vehiculo_kg poblada después del backfill?
 *   2. ¿Las rutas de las ops (concepto) existen en el esquema?
 *   3. ¿Hay combinaciones (ruta, cap) que DEBERÍAN matchear pero no lo hacen?
 *
 * Uso:
 *   php database/scripts/diagnostico_match_motor.php <liquidacion_id>
 */

require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$liqId = (int) ($argv[1] ?? 0);
if (!$liqId) { echo "Uso: php diagnostico_match_motor.php <liquidacion_id>\n"; exit(1); }

$liq = DB::table('liq_liquidaciones_cliente')->where('id', $liqId)->first();
$esq = DB::table('liq_esquemas_tarifarios')
    ->where('cliente_id', $liq->cliente_id)
    ->where('activo', true)
    ->orderByDesc('id')
    ->first();

echo "=== Diagnóstico de matching · liq #$liqId · esquema #{$esq->id} ({$esq->nombre}) ===\n\n";

// 1. Distribución de capacidades en las ops
echo "[1] Capacidades en ops (después del backfill):\n";
$distCap = DB::table('liq_operaciones')
    ->where('liquidacion_cliente_id', $liqId)
    ->select(DB::raw('COALESCE(capacidad_vehiculo_kg, 0) as cap'), DB::raw('COUNT(*) as n'))
    ->groupBy('cap')
    ->orderBy('cap')
    ->get();
foreach ($distCap as $d) {
    $label = $d->cap == 0 ? 'NULL/0 (sin backfill)' : "{$d->cap} kg";
    echo "  $label: {$d->n} ops\n";
}

// 2. Rutas únicas en las ops vs rutas en el esquema
echo "\n[2] Rutas únicas:\n";
$rutasOps = DB::table('liq_operaciones')
    ->where('liquidacion_cliente_id', $liqId)
    ->distinct()
    ->pluck('concepto')
    ->filter()
    ->sort()
    ->values();
$rutasEsq = DB::table('liq_lineas_tarifa')
    ->where('esquema_id', $esq->id)
    ->distinct()
    ->pluck('ruta_codigo')
    ->filter()
    ->sort()
    ->values();

echo "  Rutas distintas en ops: {$rutasOps->count()}\n";
echo "  Rutas distintas en esquema: {$rutasEsq->count()}\n";

$rutasEnAmbos = $rutasOps->intersect($rutasEsq);
$rutasFaltantes = $rutasOps->diff($rutasEsq);
echo "  Rutas en ops QUE SÍ están en esquema: {$rutasEnAmbos->count()}\n";
echo "  Rutas en ops QUE NO están en esquema: {$rutasFaltantes->count()}\n";
if ($rutasFaltantes->count() > 0) {
    echo "     ({$rutasFaltantes->take(10)->implode(', ')}" . ($rutasFaltantes->count() > 10 ? ', ...' : '') . ")\n";
}
if ($rutasEnAmbos->count() > 0) {
    echo "     Ejemplos que SÍ deberían matchear: {$rutasEnAmbos->take(5)->implode(', ')}\n";
}

// 3. Test específico: tomar 5 ops con ruta+cap presentes en el esquema y ver si matchean
echo "\n[3] Test de matching por op (las que deberían funcionar):\n";
$opsTest = DB::table('liq_operaciones')
    ->where('liquidacion_cliente_id', $liqId)
    ->whereNotNull('capacidad_vehiculo_kg')
    ->where('capacidad_vehiculo_kg', '>', 0)
    ->whereIn('concepto', $rutasEnAmbos)
    ->limit(5)
    ->get(['id', 'concepto', 'capacidad_vehiculo_kg', 'dominio', 'distribuidor_id']);

if ($opsTest->isEmpty()) {
    echo "  *** No hay operaciones con capacidad > 0 Y ruta presente en esquema. ***\n";
    echo "      Eso significa que el backfill no surtió efecto, o las rutas son distintas. ***\n";

    // Diagnóstico más profundo
    $opsConCap = DB::table('liq_operaciones')
        ->where('liquidacion_cliente_id', $liqId)
        ->whereNotNull('capacidad_vehiculo_kg')
        ->where('capacidad_vehiculo_kg', '>', 0)
        ->count();
    echo "      Total ops con cap > 0: $opsConCap\n";

    $primeras = DB::table('liq_operaciones')
        ->where('liquidacion_cliente_id', $liqId)
        ->whereNotNull('capacidad_vehiculo_kg')
        ->where('capacidad_vehiculo_kg', '>', 0)
        ->limit(5)
        ->get(['concepto', 'capacidad_vehiculo_kg']);
    foreach ($primeras as $p) {
        $enEsq = DB::table('liq_lineas_tarifa')
            ->where('esquema_id', $esq->id)
            ->where('ruta_codigo', $p->concepto)
            ->count();
        echo "      ruta='{$p->concepto}' cap={$p->capacidad_vehiculo_kg} → líneas en esquema con ESA ruta: $enEsq\n";
    }
} else {
    foreach ($opsTest as $op) {
        $pat = strtoupper(trim($op->dominio ?? ''));
        $dist = null;
        if ($op->distribuidor_id) {
            $p = DB::table('personas')->where('id', $op->distribuidor_id)->first(['apellidos', 'nombres']);
            if ($p) $dist = strtoupper(trim(($p->apellidos ?? '') . ' ' . ($p->nombres ?? '')));
        }

        echo "  Op #{$op->id}: ruta='{$op->concepto}' cap={$op->capacidad_vehiculo_kg} pat='$pat' dist='$dist'\n";

        // Simular los 3 pasos del motor
        $baseQ = DB::table('liq_lineas_tarifa')
            ->where('esquema_id', $esq->id)
            ->where('activo', true)
            ->where('ruta_codigo', $op->concepto)
            ->where('capacidad_vehiculo_kg', $op->capacidad_vehiculo_kg);

        $porPat = $pat ? (clone $baseQ)->where('es_tarifa_base', false)->where('patente_match', $pat)->first() : null;
        $porDist = $dist ? (clone $baseQ)->where('es_tarifa_base', false)->whereRaw('UPPER(TRIM(distribuidor_nombre)) = ?', [$dist])->first() : null;
        $porBase = (clone $baseQ)->where('es_tarifa_base', true)->first();

        if ($porPat)  echo "    ✓ match PATENTE → línea #{$porPat->id}\n";
        if ($porDist) echo "    ✓ match DISTRIBUIDOR → línea #{$porDist->id}\n";
        if ($porBase) echo "    ✓ match BASE → línea #{$porBase->id}\n";
        if (!$porPat && !$porDist && !$porBase) {
            echo "    ✗ sin match. Revisar líneas con ruta='{$op->concepto}':\n";
            $rows = DB::table('liq_lineas_tarifa')
                ->where('esquema_id', $esq->id)
                ->where('ruta_codigo', $op->concepto)
                ->get(['capacidad_vehiculo_kg', 'es_tarifa_base', 'distribuidor_nombre', 'patente_match', 'activo']);
            foreach ($rows as $r) {
                echo "       cap={$r->capacidad_vehiculo_kg} base={$r->es_tarifa_base} dist={$r->distribuidor_nombre} pat={$r->patente_match} act={$r->activo}\n";
            }
        }
    }
}

echo "\n=== FIN ===\n";

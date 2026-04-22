<?php

/**
 * Corre el motor LiqCalculoOcasaService sobre UNA op específica y reporta
 * paso a paso qué ve y por qué matchea (o no).
 *
 * Uso:
 *   php database/scripts/debug_motor_una_op.php <op_id>
 */

require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$opId = (int) ($argv[1] ?? 0);
if (!$opId) {
    echo "Uso: php debug_motor_una_op.php <op_id>\n";
    // Sugerir una op probablemente match-eable: ruta PAR300, cap 700
    $sample = DB::table('liq_operaciones')
        ->where('liquidacion_cliente_id', 43)
        ->where('concepto', 'PAR300')
        ->where('capacidad_vehiculo_kg', 700)
        ->first();
    if ($sample) echo "Sugerencia: php debug_motor_una_op.php {$sample->id}\n";
    exit(1);
}

// === 1. Leer la op vía Eloquent (igual que el motor) ===
$op = App\Models\LiqOperacion::find($opId);
if (!$op) { echo "Op #$opId no existe\n"; exit(1); }

echo "=== OP #{$op->id} (vía Eloquent) ===\n";
echo "  liquidacion_cliente_id: " . $op->liquidacion_cliente_id . "\n";
echo "  concepto (ruta): '" . $op->concepto . "'\n";
echo "  capacidad_vehiculo_kg: " . var_export($op->capacidad_vehiculo_kg, true) . " (tipo: " . gettype($op->capacidad_vehiculo_kg) . ")\n";
echo "  dominio: '" . $op->dominio . "'\n";
echo "  distribuidor_id: " . var_export($op->distribuidor_id, true) . "\n";
echo "  estado: '" . $op->estado . "'\n";
echo "  excluida: " . var_export($op->excluida, true) . "\n";

echo "\n=== Comparación: raw vs Eloquent ===\n";
$raw = DB::table('liq_operaciones')->where('id', $opId)->first(['concepto','capacidad_vehiculo_kg','dominio']);
echo "  raw cap: " . var_export($raw->capacidad_vehiculo_kg, true) . "\n";
echo "  Eloquent cap: " . var_export($op->capacidad_vehiculo_kg, true) . "\n";
if ((int)($raw->capacidad_vehiculo_kg ?? 0) !== (int)($op->capacidad_vehiculo_kg ?? 0)) {
    echo "  *** DIFIEREN: Eloquent no refleja cap de DB. Problema de cache/estado. ***\n";
}

// === 2. Correr el motor real ===
echo "\n=== Motor LiqCalculoOcasaService::calcularOperacion ===\n";
$esq = App\Models\LiqEsquemaTarifario::where('cliente_id', $op->liquidacion_cliente_id
        ? DB::table('liq_liquidaciones_cliente')->where('id', $op->liquidacion_cliente_id)->value('cliente_id')
        : 0)
    ->where('activo', true)->orderByDesc('id')->first();

if (!$esq) { echo "Sin esquema activo\n"; exit(1); }
echo "Esquema: #{$esq->id} · {$esq->nombre}\n\n";

// Activar query log
DB::enableQueryLog();
$svc = app(App\Services\Liq\LiqCalculoOcasaService::class);
$r = $svc->calcularOperacion($op, $esq);
$log = DB::getQueryLog();

echo "Resultado:\n";
echo "  match_tipo: " . var_export($r['match_tipo'], true) . "\n";
echo "  linea_tarifa_id: " . var_export($r['linea_tarifa_id'], true) . "\n";
echo "  importe: " . var_export($r['importe'], true) . "\n";
if (!empty($r['warnings'])) {
    echo "  warnings:\n";
    foreach ($r['warnings'] as $w) echo "    - $w\n";
}

echo "\n=== SQL generado por el motor (queries) ===\n";
foreach ($log as $i => $q) {
    if (stripos($q['query'], 'liq_lineas_tarifa') === false) continue;
    echo "  [" . ($i + 1) . "] " . $q['query'] . "\n";
    echo "      bindings: " . json_encode($q['bindings']) . "\n";
}

// === 3. Match manual comparativo ===
echo "\n=== Match manual directo (sanity check) ===\n";
$cap = (int) ($op->capacidad_vehiculo_kg ?? 0);
$ruta = (string) ($op->concepto ?? '');

$baseMatch = App\Models\LiqLineaTarifa::where('esquema_id', $esq->id)
    ->where('activo', true)
    ->where('es_tarifa_base', true)
    ->where('ruta_codigo', $ruta)
    ->where('capacidad_vehiculo_kg', $cap)
    ->first();

if ($baseMatch) {
    echo "  ✓ Eloquent BASE match: línea #{$baseMatch->id}\n";
} else {
    echo "  ✗ Eloquent BASE sin match\n";
    // ¿hay líneas con esa ruta?
    $conRuta = App\Models\LiqLineaTarifa::where('esquema_id', $esq->id)->where('ruta_codigo', $ruta)->get(['id','capacidad_vehiculo_kg','es_tarifa_base','activo','aprobado_por']);
    echo "    Líneas del esquema con ruta='$ruta': {$conRuta->count()}\n";
    foreach ($conRuta as $l) {
        echo "      #{$l->id} cap={$l->capacidad_vehiculo_kg} base=" . ($l->es_tarifa_base ? 1 : 0) . " act=" . ($l->activo ? 1 : 0) . " apr=" . ($l->aprobado_por ? 'SI' : 'NO') . "\n";
    }
}

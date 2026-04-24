<?php

/**
 * Diagnostica por qué el detector de subpagos OCASA devolvió "244 sin tarifa_contrato"
 * en la liq #43. Compara sucursales vistas en ops vs sucursales cargadas en la tabla
 * liq_tarifas_contrato_cliente para identificar mismatches de nombres.
 *
 * Uso:
 *   php database/scripts/diagnostico_subpago_gap.php 43
 */

require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$liqId = (int) ($argv[1] ?? 0);
if (!$liqId) { echo "Uso: php diagnostico_subpago_gap.php <liq_id>\n"; exit(1); }

$liq = DB::table('liq_liquidaciones_cliente')->where('id', $liqId)->first();
if (!$liq) { echo "No existe liq #$liqId\n"; exit(1); }

$cid = $liq->cliente_id;

echo "=== Sucursales vistas en ops de liq #$liqId ===\n";
$sucOps = DB::table('liq_operaciones')
    ->where('liquidacion_cliente_id', $liqId)
    ->selectRaw('sucursal_tarifa, COUNT(*) as n')
    ->groupBy('sucursal_tarifa')
    ->orderBy('sucursal_tarifa')
    ->get();
foreach ($sucOps as $r) {
    echo sprintf('  "%s": %d ops%s', $r->sucursal_tarifa ?? 'NULL', $r->n, PHP_EOL);
}

echo "\n=== Sucursales en liq_tarifas_contrato_cliente (cliente $cid) ===\n";
$sucContrato = DB::table('liq_tarifas_contrato_cliente')
    ->where('cliente_id', $cid)
    ->select('sucursal')->distinct()
    ->orderBy('sucursal')
    ->pluck('sucursal');
foreach ($sucContrato as $s) {
    echo "  \"$s\"\n";
}

echo "\n=== Ops sin match (sucursal de op NO está en contrato, case-insensitive) ===\n";
$contratoNormSet = $sucContrato->map(fn($s) => mb_strtoupper($s))->toArray();

$sinMatch = [];
foreach ($sucOps as $r) {
    $opSuc = $r->sucursal_tarifa;
    if ($opSuc === null) continue;
    $norm = strtoupper(strtr($opSuc, [
        'á'=>'A','é'=>'E','í'=>'I','ó'=>'O','ú'=>'U','Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ú'=>'U','ñ'=>'N','Ñ'=>'N',
    ]));
    if (!in_array($norm, $contratoNormSet, true)) {
        $sinMatch[$opSuc] = $r->n;
    }
}
foreach ($sinMatch as $suc => $n) {
    // Buscar sugerencia de match parcial
    $sugs = [];
    foreach ($contratoNormSet as $c) {
        if (str_contains($c, strtoupper(explode(' ', $suc)[0] ?? '')) || str_contains(strtoupper($suc), $c)) {
            $sugs[] = $c;
        }
    }
    $sugTxt = empty($sugs) ? '(sin sugerencias)' : 'sugerencias: ' . implode(' | ', array_unique($sugs));
    echo sprintf('  "%s" (%d ops) · %s%s', $suc, $n, $sugTxt, PHP_EOL);
}

echo "\n=== Ops que NO tienen concepto derivable (cap=0 o distancia_km NULL) ===\n";
$sinConcepto = DB::table('liq_operaciones')
    ->where('liquidacion_cliente_id', $liqId)
    ->where(function ($q) {
        $q->where('capacidad_vehiculo_kg', 0)
          ->orWhereNull('capacidad_vehiculo_kg');
    })
    ->count();
echo "  Con cap=0 o NULL: $sinConcepto\n";

$sinDist = DB::table('liq_operaciones')
    ->where('liquidacion_cliente_id', $liqId)
    ->whereNull('distancia_km')
    ->count();
echo "  Con distancia_km NULL: $sinDist\n";

echo "\n=== Capacidades vistas vs contratadas por sucursal (primeras 10) ===\n";
$porSucCap = DB::table('liq_operaciones')
    ->where('liquidacion_cliente_id', $liqId)
    ->selectRaw('sucursal_tarifa, capacidad_vehiculo_kg, COUNT(*) as n')
    ->groupBy('sucursal_tarifa', 'capacidad_vehiculo_kg')
    ->orderBy('sucursal_tarifa')
    ->orderBy('capacidad_vehiculo_kg')
    ->limit(30)
    ->get();
foreach ($porSucCap as $r) {
    $existe = DB::table('liq_tarifas_contrato_cliente')
        ->where('cliente_id', $cid)
        ->whereRaw('UPPER(sucursal) = UPPER(?)', [$r->sucursal_tarifa ?? ''])
        ->where('capacidad_vehiculo', $r->capacidad_vehiculo_kg)
        ->exists();
    $flag = $existe ? '✓' : '✗';
    echo sprintf('  %s %-20s cap=%-5d %d ops%s', $flag, $r->sucursal_tarifa ?? 'NULL', $r->capacidad_vehiculo_kg ?? 0, $r->n, PHP_EOL);
}

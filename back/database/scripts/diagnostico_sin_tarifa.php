<?php

/**
 * Diagnóstico "Sin tarifa" — explica por qué las operaciones no resuelven contra un esquema.
 *
 * Uso:
 *   php database/scripts/diagnostico_sin_tarifa.php <liquidacion_cliente_id>
 *
 * Ejemplo:
 *   php database/scripts/diagnostico_sin_tarifa.php 42
 *
 * Reporta:
 *   - Esquema activo del cliente
 *   - Total de líneas en el esquema (base/override) y una muestra
 *   - Top 10 operaciones sin tarifa con sus datos de resolver (ruta + cap + distribuidor + patente)
 *   - Para cada una, intenta resolver manualmente y explica por qué falla
 */

require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$liqId = (int) ($argv[1] ?? 0);
if (!$liqId) {
    echo "Uso: php diagnostico_sin_tarifa.php <liquidacion_cliente_id>\n";
    exit(1);
}

$liq = DB::table('liq_liquidaciones_cliente')->where('id', $liqId)->first();
if (!$liq) { echo "No existe la liquidación #$liqId\n"; exit(1); }

$cli = DB::table('liq_clientes')->where('id', $liq->cliente_id)->first();
$periodo = substr($liq->periodo_desde ?? '', 0, 7);
echo "=== Liquidación #{$liq->id} · cliente={$cli->nombre_corto} · período {$periodo} ({$liq->periodo_desde} → {$liq->periodo_hasta})\n\n";

// 1. Esquema activo del cliente
$esq = DB::table('liq_esquemas_tarifarios')
    ->where('cliente_id', $cli->id)
    ->where('activo', true)
    ->orderByDesc('id')
    ->first();
if (!$esq) {
    echo "ERROR: no hay esquema activo para cliente {$cli->nombre_corto}\n";
    exit(1);
}
echo "Esquema activo: #{$esq->id} · {$esq->nombre}\n";
echo "Dimensiones: {$esq->dimensiones}\n\n";

// 2. Tarifas en ese esquema
$total = DB::table('liq_lineas_tarifa')->where('esquema_id', $esq->id)->count();
$base = DB::table('liq_lineas_tarifa')->where('esquema_id', $esq->id)->where('es_tarifa_base', true)->count();
$over = DB::table('liq_lineas_tarifa')->where('esquema_id', $esq->id)->where('es_tarifa_base', false)->count();
$conRuta = DB::table('liq_lineas_tarifa')->where('esquema_id', $esq->id)->whereNotNull('ruta_codigo')->count();
$activas = DB::table('liq_lineas_tarifa')->where('esquema_id', $esq->id)->where('activo', true)->count();
$aprobadas = DB::table('liq_lineas_tarifa')->where('esquema_id', $esq->id)->whereNotNull('aprobado_por')->count();

echo "Líneas en el esquema: $total (base=$base · override=$over)\n";
echo "  Con ruta_codigo: $conRuta\n";
echo "  Activas: $activas\n";
echo "  Aprobadas: $aprobadas\n\n";

if ($total === 0) {
    echo "*** El esquema está VACÍO. Hay que importar las tarifas primero. ***\n";
    exit(0);
}

// Muestra de líneas
echo "--- Muestra de 5 líneas del esquema ---\n";
$muestra = DB::table('liq_lineas_tarifa')
    ->where('esquema_id', $esq->id)
    ->limit(5)
    ->get(['id','ruta_codigo','capacidad_vehiculo_kg','es_tarifa_base','distribuidor_nombre','patente_match','activo','aprobado_por','precio_distribuidor']);
foreach ($muestra as $m) {
    printf("  #%d ruta=%s cap=%d base=%d dist=%s pat=%s act=%d apr=%s pdist=%.2f\n",
        $m->id, $m->ruta_codigo ?? '—', $m->capacidad_vehiculo_kg ?? 0, $m->es_tarifa_base,
        $m->distribuidor_nombre ?? '—', $m->patente_match ?? '—',
        $m->activo, $m->aprobado_por ? 'SI' : 'NO',
        $m->precio_distribuidor ?? 0
    );
}

// 3. Operaciones sin tarifa — detectar qué columna usa esta instalación
$opsCols = DB::select("SHOW COLUMNS FROM liq_operaciones");
$colNames = array_map(fn($c) => $c->Field, $opsCols);

echo "\n--- Columnas clave detectadas en liq_operaciones ---\n";
$relevantes = array_filter($colNames, fn($c) =>
    str_contains($c, 'estado') || str_contains($c, 'tarifa') || str_contains($c, 'sin_') ||
    str_contains($c, 'ruta') || str_contains($c, 'capac') || str_contains($c, 'distrib') ||
    str_contains($c, 'patent') || str_contains($c, 'dominio') || str_contains($c, 'concepto') ||
    str_contains($c, 'linea_')
);
echo "  " . implode(', ', $relevantes) . "\n\n";

// Intentar detectar la columna de estado de tarifa (tolerante a distintos esquemas)
$estadoCol = null;
foreach (['estado_tarifa', 'estado_resolucion', 'tarifa_estado', 'estado'] as $c) {
    if (in_array($c, $colNames)) { $estadoCol = $c; break; }
}
$lineaFkCol = in_array('linea_tarifa_id', $colNames) ? 'linea_tarifa_id'
           : (in_array('liq_linea_tarifa_id', $colNames) ? 'liq_linea_tarifa_id' : null);

echo "Columnas usadas: estado='$estadoCol' · linea_fk='$lineaFkCol'\n\n";

echo "\n--- Operaciones sin tarifa (top 10) ---\n";
$q = DB::table('liq_operaciones')->where('liquidacion_cliente_id', $liqId);
if ($lineaFkCol && $estadoCol) {
    $q->where(function ($sub) use ($lineaFkCol, $estadoCol) {
        $sub->whereNull($lineaFkCol)->orWhere($estadoCol, 'sin_tarifa');
    });
} elseif ($lineaFkCol) {
    $q->whereNull($lineaFkCol);
} elseif ($estadoCol) {
    $q->where($estadoCol, 'sin_tarifa');
}
$ops = $q->limit(10)->get();

if ($ops->isEmpty()) {
    echo "  (ninguna — todas tienen tarifa resuelta)\n";
    exit(0);
}

// Mostrar estructura de una operación para identificar columnas del resolver
$cols = array_keys((array) $ops->first());
echo "Columnas disponibles en liq_operaciones (para identificar resolver): ";
echo implode(', ', array_filter($cols, fn($c) => str_contains($c, 'ruta') || str_contains($c, 'capacidad') || str_contains($c, 'distribuidor') || str_contains($c, 'patente') || str_contains($c, 'dominio') || str_contains($c, 'concepto'))) . "\n\n";

foreach ($ops as $i => $op) {
    // Los nombres reales pueden variar; extraemos todo lo que sea relevante
    $opArr = (array) $op;
    $ruta = $opArr['ruta_codigo'] ?? $opArr['concepto'] ?? $opArr['ruta'] ?? null;
    $cap  = $opArr['capacidad_vehiculo_kg'] ?? $opArr['capacidad_vehiculo'] ?? null;
    $distribuidor = $opArr['distribuidor_nombre'] ?? null;
    $patente = $opArr['dominio'] ?? $opArr['patente'] ?? $opArr['patente_match'] ?? null;

    echo "Op #{$op->id}: ruta='$ruta' cap='$cap' distrib='$distribuidor' pat='$patente'\n";

    if (!$ruta || !$cap) {
        echo "  ✗ Operación sin ruta o capacidad → no puede resolver\n\n";
        continue;
    }

    // Intentar resolver manualmente siguiendo la lógica del spec:
    // 1) override por patente → 2) override por distribuidor → 3) base
    $matches = [];

    if ($patente) {
        $byPat = DB::table('liq_lineas_tarifa')
            ->where('esquema_id', $esq->id)
            ->where('ruta_codigo', $ruta)
            ->where('capacidad_vehiculo_kg', $cap)
            ->where('patente_match', $patente)
            ->where('es_tarifa_base', false)
            ->first(['id', 'distribuidor_nombre', 'patente_match', 'activo', 'aprobado_por']);
        $matches['por_patente'] = $byPat;
    }

    if ($distribuidor) {
        $byDist = DB::table('liq_lineas_tarifa')
            ->where('esquema_id', $esq->id)
            ->where('ruta_codigo', $ruta)
            ->where('capacidad_vehiculo_kg', $cap)
            ->where('distribuidor_nombre', $distribuidor)
            ->where('es_tarifa_base', false)
            ->first(['id', 'distribuidor_nombre', 'patente_match']);
        $matches['por_distribuidor'] = $byDist;
    }

    $byBase = DB::table('liq_lineas_tarifa')
        ->where('esquema_id', $esq->id)
        ->where('ruta_codigo', $ruta)
        ->where('capacidad_vehiculo_kg', $cap)
        ->where('es_tarifa_base', true)
        ->first(['id']);
    $matches['base'] = $byBase;

    foreach ($matches as $tipo => $m) {
        if ($m) echo "  ✓ Match por $tipo: línea #{$m->id}\n";
    }
    if (!array_filter($matches)) {
        // Buscar líneas con la MISMA ruta (ignorando cap) para sugerir qué falta
        $sameRuta = DB::table('liq_lineas_tarifa')
            ->where('esquema_id', $esq->id)
            ->where('ruta_codigo', $ruta)
            ->get(['capacidad_vehiculo_kg', 'distribuidor_nombre', 'patente_match', 'es_tarifa_base']);
        if ($sameRuta->isEmpty()) {
            echo "  ✗ No hay NINGUNA línea con ruta='$ruta' en el esquema\n";
        } else {
            echo "  ✗ Hay {$sameRuta->count()} líneas con ruta='$ruta' pero ninguna matchea. Capacidades disponibles: "
                . $sameRuta->pluck('capacidad_vehiculo_kg')->unique()->implode(', ') . "\n";
        }
    }
    echo "\n";
}

echo "\n=== FIN diagnóstico ===\n";

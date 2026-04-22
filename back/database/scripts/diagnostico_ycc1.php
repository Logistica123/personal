<?php

/**
 * Diagnóstico del parser YCC1 — identifica por qué una carga procesó 0 registros.
 *
 * Revisa 5 puntos de falla:
 *   1. ¿Existe el archivo YCC1 subido para esta liquidación?
 *   2. ¿Qué hojas tiene el Excel y cuál detecta el parser?
 *   3. ¿Los headers del Excel matchean la configuración del cliente?
 *   4. ¿Las operaciones del liq tienen id_operacion_cliente seteado?
 *   5. ¿Los Transportes del YCC1 matchean los id_operacion_cliente?
 *
 * Uso:
 *   php database/scripts/diagnostico_ycc1.php <liquidacion_id>
 */

require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;

$liqId = (int) ($argv[1] ?? 0);
if (!$liqId) { echo "Uso: php diagnostico_ycc1.php <liquidacion_id>\n"; exit(1); }

$liq = DB::table('liq_liquidaciones_cliente')->where('id', $liqId)->first();
if (!$liq) { echo "No existe liq #$liqId\n"; exit(1); }
$cli = DB::table('liq_clientes')->where('id', $liq->cliente_id)->first();
echo "=== Diagnóstico YCC1 · liq #$liqId · cliente {$cli->nombre_corto} ===\n\n";

// ───────────────────────────────────────────────────────────────────
// 1. Archivos YCC1 cargados
// ───────────────────────────────────────────────────────────────────
echo "[1] Archivos de entrada:\n";
$archivos = DB::table('liq_archivos_entrada')
    ->where('liquidacion_cliente_id', $liqId)
    ->get(['id', 'tipo_archivo', 'nombre_original', 'ruta_storage', 'disk', 'cant_registros', 'created_at']);

foreach ($archivos as $a) {
    printf("  #%d · %s · %s · registros=%s · %s\n",
        $a->id, $a->tipo_archivo, $a->nombre_original, $a->cant_registros ?? 'NULL', $a->created_at);
}

// Detección YCC1: por tipo_archivo O por nombre_original conteniendo "YCC"
// (el endpoint upload-ocasa etiqueta como DETALLE_SUCURSAL, no como YCC1)
$ycc1Archivos = $archivos->filter(fn($a) =>
    str_contains(strtoupper($a->tipo_archivo ?? ''), 'YCC') ||
    str_contains(strtoupper($a->nombre_original ?? ''), 'YCC')
);
if ($ycc1Archivos->isEmpty()) {
    echo "\n*** No se encontró archivo YCC1 para la liquidación. Hay que subirlo. ***\n";
    exit(0);
}

$archivo = $ycc1Archivos->first();
echo "\nUsando YCC1: #{$archivo->id} · {$archivo->nombre_original} · tipo={$archivo->tipo_archivo}\n";
if ($archivo->tipo_archivo === 'DETALLE_SUCURSAL') {
    echo "  (Nota: etiquetado 'DETALLE_SUCURSAL' — así lo marca upload-ocasa, no es un error)\n";
}
echo "\n";

// ───────────────────────────────────────────────────────────────────
// CHECK RÁPIDO ANTES DE TODO: ¿hay detalles YCC creados + ops con paradas?
// ───────────────────────────────────────────────────────────────────
echo "[0] Estado actual en DB (lo importante):\n";
$detallesCount = DB::table('liq_operacion_detalles')
    ->join('liq_operaciones', 'liq_operaciones.id', '=', 'liq_operacion_detalles.operacion_id')
    ->where('liq_operaciones.liquidacion_cliente_id', $liqId)
    ->count();
echo "  Paradas YCC en DB (liq_operacion_detalles): $detallesCount\n";

$opsTotal0 = DB::table('liq_operaciones')->where('liquidacion_cliente_id', $liqId)->count();
$opsConParadasTotal = DB::table('liq_operaciones')
    ->where('liquidacion_cliente_id', $liqId)
    ->whereNotNull('paradas_ycc_total')
    ->count();
$opsConParadasMotivo = DB::table('liq_operaciones')
    ->where('liquidacion_cliente_id', $liqId)
    ->whereNotNull('paradas_con_motivo')
    ->count();
$sumParadas = DB::table('liq_operaciones')
    ->where('liquidacion_cliente_id', $liqId)
    ->sum('paradas_ycc_total');

echo "  Operaciones: $opsTotal0 · con paradas_ycc_total seteado: $opsConParadasTotal · con paradas_con_motivo: $opsConParadasMotivo\n";
echo "  Suma paradas_ycc_total: $sumParadas\n";

if ($detallesCount > 0 && $opsConParadasTotal === 0) {
    echo "\n  *** DIAGNÓSTICO RÁPIDO: el parser YCC SÍ cargó los $detallesCount detalles, pero el\n";
    echo "      servicio de eficiencia NUNCA se ejecutó sobre las operaciones. Por eso la UI\n";
    echo "      muestra '0 paradas' y sin eficiencia.\n\n";
    echo "      FIX: correr liq:recalcular (motor OCASA + eficiencia + estado de cuenta) así:\n\n";
    echo "      php artisan liq:recalcular --cliente=OCASA --periodo=2026-03 --dry-run   # validar\n";
    echo "      php artisan liq:recalcular --cliente=OCASA --periodo=2026-03             # aplicar\n\n";
}
if ($detallesCount === 0) {
    echo "\n  *** No hay detalles YCC en la DB. El parser no creó nada. Sigamos diagnosticando abajo. ***\n\n";
}

// ───────────────────────────────────────────────────────────────────
// 2. Hojas del Excel
// ───────────────────────────────────────────────────────────────────
echo "[2] Estructura del Excel:\n";
$disk = $archivo->disk ?: 'local';
$path = Storage::disk($disk)->path($archivo->ruta_storage);
if (!is_readable($path)) {
    echo "  ✗ No se puede leer: $path\n";
    exit(1);
}
echo "  Path: $path\n";
echo "  Size: " . filesize($path) . " bytes\n";

$spreadsheet = IOFactory::load($path);
$sheetNames = $spreadsheet->getSheetNames();
echo "  Hojas (" . count($sheetNames) . "):\n";
foreach ($sheetNames as $i => $n) {
    $s = $spreadsheet->getSheetByName($n);
    $rows = $s->getHighestRow();
    $cols = $s->getHighestColumn();
    echo "    [$i] '$n' · {$rows} filas · cols hasta {$cols}\n";
}

// ───────────────────────────────────────────────────────────────────
// 3. Configuración YCC1 del cliente + hoja que detecta el parser
// ───────────────────────────────────────────────────────────────────
echo "\n[3] Configuración del cliente (configuracion_excel.archivos.ycc1):\n";
$cfg = json_decode($cli->configuracion_excel ?? '{}', true);
$ycc1Cfg = $cfg['archivos']['ycc1'] ?? null;
if (!$ycc1Cfg) {
    echo "  ✗ NO HAY configuración YCC1 en configuracion_excel del cliente.\n";
    echo "     El parser usará hoja='8' por defecto y columnas vacías.\n\n";
} else {
    echo "  Hoja configurada: '" . ($ycc1Cfg['hoja'] ?? '8') . "'\n";
    echo "  Columnas configuradas:\n";
    foreach (($ycc1Cfg['columnas'] ?? []) as $campo => $header) {
        echo "    $campo => '$header'\n";
    }
}

// Simular resolverHoja
$hojaConfig = $ycc1Cfg['hoja'] ?? $cfg['hoja'] ?? '8';
$sheet = $spreadsheet->getSheetByName($hojaConfig);
$fuente = "nombre='$hojaConfig'";
if (!$sheet && is_numeric($hojaConfig)) {
    $idx = (int) $hojaConfig;
    $count = $spreadsheet->getSheetCount();
    if ($idx < $count) { $sheet = $spreadsheet->getSheet($idx); $fuente = "índice $idx (0-based)"; }
    elseif ($idx - 1 >= 0 && $idx - 1 < $count) { $sheet = $spreadsheet->getSheet($idx - 1); $fuente = "índice " . ($idx - 1) . " (1-based fallback)"; }
}
if (!$sheet) { $sheet = $spreadsheet->getActiveSheet(); $fuente = "active sheet (fallback)"; }
echo "\n  Hoja detectada por parser: '{$sheet->getTitle()}' ($fuente)\n";

// ───────────────────────────────────────────────────────────────────
// 4. Headers de la hoja detectada
// ───────────────────────────────────────────────────────────────────
echo "\n[4] Headers de la hoja detectada (fila 1):\n";
$rows = $sheet->toArray(null, true, true, false);
$headers = $rows[0] ?? [];
foreach ($headers as $i => $h) {
    if ($h !== null && $h !== '') echo "    [$i] '$h'\n";
}
echo "  Total filas (incluyendo header): " . count($rows) . "\n";

// Verificar matching de columnas
if ($ycc1Cfg && isset($ycc1Cfg['columnas'])) {
    echo "\n  Matching de columnas configuradas vs headers reales:\n";
    $headersNorm = [];
    foreach ($headers as $i => $h) $headersNorm[$i] = strtolower(trim(preg_replace('/\s+/', ' ', (string) $h) ?? ''));
    $matched = 0;
    foreach ($ycc1Cfg['columnas'] as $campo => $headerName) {
        $headerNorm = strtolower(trim(preg_replace('/\s+/', ' ', (string) $headerName) ?? ''));
        $idx = array_search($headerNorm, $headersNorm, true);
        if ($idx !== false) {
            echo "    ✓ $campo ← col $idx ('$headerName')\n";
            $matched++;
        } else {
            echo "    ✗ $campo ← '$headerName' NO ENCONTRADO\n";
        }
    }
    if ($matched === 0) {
        echo "\n  *** NINGUNA columna matchea → parser no extrae nada → 0 registros. ***\n";
    }
}

// ───────────────────────────────────────────────────────────────────
// 5. Operaciones con id_operacion_cliente vs Transportes del YCC1
// ───────────────────────────────────────────────────────────────────
echo "\n[5] Matching Transporte (YCC1) → id_operacion_cliente (ops):\n";
$opsTotal = DB::table('liq_operaciones')->where('liquidacion_cliente_id', $liqId)->count();
$opsConIdCli = DB::table('liq_operaciones')
    ->where('liquidacion_cliente_id', $liqId)
    ->whereNotNull('id_operacion_cliente')
    ->count();
echo "  Operaciones en el liq: $opsTotal (con id_operacion_cliente: $opsConIdCli)\n";

if ($opsConIdCli === 0) {
    echo "  *** Ninguna operación tiene id_operacion_cliente → parser no puede matchear nada. ***\n";
    echo "     Reprocesá el TMS para que setee el id_operacion_cliente en las ops.\n";
}

// Samples: 5 id_operacion_cliente reales
$sampleOps = DB::table('liq_operaciones')
    ->where('liquidacion_cliente_id', $liqId)
    ->whereNotNull('id_operacion_cliente')
    ->limit(5)
    ->pluck('id_operacion_cliente')
    ->toArray();
echo "  Sample id_operacion_cliente de ops: " . implode(', ', $sampleOps) . "\n";

// Samples: 5 Transportes del YCC1 (si tenemos colMap para transporte)
if ($ycc1Cfg && isset($ycc1Cfg['columnas']['transporte'])) {
    $transporteHeader = strtolower(trim(preg_replace('/\s+/', ' ', $ycc1Cfg['columnas']['transporte']) ?? ''));
    $headersNorm = array_map(fn($h) => strtolower(trim(preg_replace('/\s+/', ' ', (string) $h) ?? '')), $headers);
    $colIdx = array_search($transporteHeader, $headersNorm, true);
    if ($colIdx !== false) {
        $transports = [];
        $noNumericos = 0;
        foreach (array_slice($rows, 1) as $r) {
            $t = trim((string) ($r[$colIdx] ?? ''));
            if ($t === '') continue;
            if (!is_numeric($t)) { $noNumericos++; continue; }
            $transports[] = $t;
            if (count($transports) >= 5) break;
        }
        echo "  Sample Transportes del YCC1 (primeros 5 numéricos): " . implode(', ', $transports) . "\n";
        if ($noNumericos > 0) echo "  *** Había $noNumericos+ Transportes no numéricos en la muestra — el parser los skippea. ***\n";

        // Contar matches reales
        $todosTransports = [];
        foreach (array_slice($rows, 1) as $r) {
            $t = trim((string) ($r[$colIdx] ?? ''));
            if ($t !== '' && is_numeric($t)) $todosTransports[] = $t;
        }
        $todosTransports = array_unique($todosTransports);
        if ($todosTransports) {
            $matches = DB::table('liq_operaciones')
                ->where('liquidacion_cliente_id', $liqId)
                ->whereIn('id_operacion_cliente', $todosTransports)
                ->count();
            echo "  Transportes únicos en YCC1: " . count($todosTransports) . "\n";
            echo "  Matches con operaciones: $matches\n";
            if ($matches === 0 && count($todosTransports) > 0) {
                echo "  *** 0 matches — formato de id_operacion_cliente incompatible con Transporte del YCC1. ***\n";
            }
        }
    }
}

echo "\n=== FIN diagnóstico YCC1 ===\n";

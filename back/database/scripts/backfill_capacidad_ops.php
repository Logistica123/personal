<?php

/**
 * Backfill de capacidad_vehiculo_kg en liq_operaciones desde el maestro de personas.
 *
 * Cuándo usarlo: cuando el TMS OCASA no trajo la columna de capacidad y las ops
 * quedan sin capacidad_vehiculo_kg → el resolver no puede matchear tarifa y todas
 * quedan en "Sin tarifa".
 *
 * Estrategia: para cada op con cap NULL en la liquidación, buscar persona por la
 * patente del dominio (tabla persona_patentes o personas.patente). Si la persona
 * tiene capacidad_vehiculo_kg seteada, se copia a la op.
 *
 * Uso:
 *   php database/scripts/backfill_capacidad_ops.php <liquidacion_id>           # dry-run (solo reporta)
 *   php database/scripts/backfill_capacidad_ops.php <liquidacion_id> --apply  # aplica cambios
 *
 * Después de aplicar: correr "Recalcular motor OCASA" desde el UI (o por API) para
 * que el resolver corra de nuevo con los nuevos datos.
 */

require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$liqId = (int) ($argv[1] ?? 0);
$apply = in_array('--apply', $argv, true);

if (!$liqId) {
    echo "Uso: php backfill_capacidad_ops.php <liquidacion_id> [--apply]\n";
    exit(1);
}

$modo = $apply ? 'APLICAR CAMBIOS' : 'DRY-RUN (sin cambios)';
echo "=== Backfill capacidad en ops · liquidación #$liqId · $modo ===\n\n";

// Normalizador de patente (quita espacios, guiones y pasa a mayúsculas)
$normalizar = fn(string $p) => strtoupper(preg_replace('/[\s\-]/', '', $p) ?? $p);

// 1. Operaciones sin capacidad
$ops = DB::table('liq_operaciones')
    ->where('liquidacion_cliente_id', $liqId)
    ->whereNull('capacidad_vehiculo_kg')
    ->get(['id', 'dominio']);

echo "Operaciones sin capacidad: {$ops->count()}\n";
if ($ops->isEmpty()) { echo "Nada que hacer.\n"; exit(0); }

// 2. Agrupar por patente normalizada (evita queries duplicadas)
$porPatente = [];
foreach ($ops as $op) {
    if (!$op->dominio) continue;
    $norm = $normalizar($op->dominio);
    $porPatente[$norm][] = $op->id;
}

echo "Patentes únicas: " . count($porPatente) . "\n\n";

// 3. Lookup masivo: persona por patente (3 fuentes: persona.patente, persona.patente_norm si existiera, persona_patentes)
$patentes = array_keys($porPatente);
$personaPorPatente = [];

// Fuente 1: persona_patentes (por patente_norm)
$rows = DB::table('persona_patentes')
    ->join('personas', 'personas.id', '=', 'persona_patentes.persona_id')
    ->whereIn('persona_patentes.patente_norm', $patentes)
    ->where('persona_patentes.activo', true)
    ->get(['persona_patentes.patente_norm', 'personas.id as persona_id', 'personas.capacidad_vehiculo_kg', 'personas.apellidos', 'personas.nombres']);
foreach ($rows as $r) {
    $personaPorPatente[$r->patente_norm][] = $r;
}

// Fuente 2: personas.patente normalizado on-the-fly
$rowsDirect = DB::table('personas')
    ->whereNotNull('patente')
    ->get(['id as persona_id', 'patente', 'capacidad_vehiculo_kg', 'apellidos', 'nombres']);
foreach ($rowsDirect as $r) {
    $norm = $normalizar($r->patente);
    if (in_array($norm, $patentes, true)) {
        $personaPorPatente[$norm][] = (object) [
            'patente_norm' => $norm,
            'persona_id' => $r->persona_id,
            'capacidad_vehiculo_kg' => $r->capacidad_vehiculo_kg,
            'apellidos' => $r->apellidos,
            'nombres' => $r->nombres,
        ];
    }
}

// 4. Procesar
$fixed = 0;
$sinPersona = [];
$personaSinCap = [];
$ambiguas = [];

foreach ($porPatente as $patente => $opIds) {
    $candidatos = $personaPorPatente[$patente] ?? [];
    // Dedup por persona_id
    $uniq = [];
    foreach ($candidatos as $c) $uniq[$c->persona_id] = $c;
    $candidatos = array_values($uniq);

    if (count($candidatos) === 0) {
        $sinPersona[$patente] = count($opIds);
        continue;
    }
    if (count($candidatos) > 1) {
        // Resolver ambigüedad: si hay exactamente un candidato con capacidad_vehiculo_kg > 0, usarlo.
        // Si hay múltiples con cap seteada, quedarse ambiguo sólo si difieren entre sí.
        $conCap = array_values(array_filter($candidatos, fn($c) => !empty($c->capacidad_vehiculo_kg)));
        $capsUnicas = array_unique(array_map(fn($c) => (int) $c->capacidad_vehiculo_kg, $conCap));

        if (count($conCap) === 0) {
            // Ninguna tiene cap → reportar como "sin cap"
            $personaSinCap[$patente] = implode(' | ', array_map(fn($c) => "{$c->apellidos} {$c->nombres} (#{$c->persona_id})", $candidatos));
            continue;
        }
        if (count($capsUnicas) > 1) {
            // Múltiples caps distintas → ambigüedad real, reportar
            $ambiguas[$patente] = array_map(fn($c) => "{$c->apellidos} {$c->nombres} (persona #{$c->persona_id}, cap={$c->capacidad_vehiculo_kg})", $candidatos);
            continue;
        }
        // Una sola cap posible (aunque aparezca en varios candidatos) → usar esa
        $persona = $conCap[0];
    } else {
        $persona = $candidatos[0];
        if (!$persona->capacidad_vehiculo_kg) {
            $personaSinCap[$patente] = "{$persona->apellidos} {$persona->nombres} (persona #{$persona->persona_id})";
            continue;
        }
    }

    $fixed += count($opIds);
    if ($apply) {
        DB::table('liq_operaciones')
            ->whereIn('id', $opIds)
            ->update(['capacidad_vehiculo_kg' => $persona->capacidad_vehiculo_kg]);
    }
}

echo "--- Resumen ---\n";
echo "Ops que se " . ($apply ? 'actualizaron' : 'actualizarían') . ": $fixed\n";
echo "Patentes sin persona en el maestro: " . count($sinPersona) . "\n";
echo "Patentes con persona sin capacidad_vehiculo_kg: " . count($personaSinCap) . "\n";
echo "Patentes con múltiples personas (ambiguas): " . count($ambiguas) . "\n\n";

if ($sinPersona) {
    echo "--- Patentes SIN persona en maestro (agregar en Proveedores) ---\n";
    foreach (array_slice($sinPersona, 0, 20, true) as $pat => $n) echo "  $pat · $n ops\n";
    if (count($sinPersona) > 20) echo "  ... y " . (count($sinPersona) - 20) . " más\n";
    echo "\n";
}

if ($personaSinCap) {
    echo "--- Patentes con persona SIN capacidad (cargar en Proveedores > editar > capacidad_vehiculo_kg) ---\n";
    foreach (array_slice($personaSinCap, 0, 20, true) as $pat => $nom) echo "  $pat → $nom\n";
    if (count($personaSinCap) > 20) echo "  ... y " . (count($personaSinCap) - 20) . " más\n";
    echo "\n";
}

if ($ambiguas) {
    echo "--- Patentes ambiguas (múltiples personas con la misma patente) ---\n";
    foreach (array_slice($ambiguas, 0, 5, true) as $pat => $nombres) {
        echo "  $pat:\n";
        foreach ($nombres as $n) echo "    - $n\n";
    }
    echo "\n";
}

if (!$apply) {
    echo "*** Modo DRY-RUN. Agregar --apply para persistir los cambios. ***\n";
} else {
    echo "*** Cambios aplicados. Próximo paso: recalcular tarifas. ***\n";
    echo "    UI: botón 'Recalcular motor OCASA' en la liquidación\n";
    echo "    API: POST /api/liq/liquidaciones/$liqId/recalcular-motor-ocasa\n";
}

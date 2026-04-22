<?php

/**
 * Backfill one-off: en líneas de tarifa OCASA importadas antes del fix, copia
 * precio_distribuidor a costo_fijo_base cuando éste último esté NULL. El motor v5
 * usa costo_fijo_base como pilar del cálculo Jornada — sin él, el importe es $0.
 *
 * Uso:
 *   php database/scripts/backfill_costo_fijo_base.php [esquema_id]   # dry-run
 *   php database/scripts/backfill_costo_fijo_base.php <esquema_id> --apply
 */

require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$esquemaId = (int) ($argv[1] ?? 0);
$apply = in_array('--apply', $argv, true);

$q = DB::table('liq_lineas_tarifa')->whereNull('costo_fijo_base')->where('precio_distribuidor', '>', 0);
if ($esquemaId) $q->where('esquema_id', $esquemaId);

$count = $q->count();
echo "Líneas candidatas (costo_fijo_base NULL + precio_distribuidor > 0): $count\n";
if ($esquemaId) echo "Filtrado a esquema #$esquemaId\n";

if ($count === 0) { echo "Nada que hacer.\n"; exit(0); }

if (!$apply) {
    echo "\nMuestra de 5 líneas que se actualizarían:\n";
    foreach ($q->limit(5)->get(['id', 'esquema_id', 'ruta_codigo', 'capacidad_vehiculo_kg', 'precio_distribuidor']) as $l) {
        echo "  #{$l->id} esq={$l->esquema_id} ruta={$l->ruta_codigo} cap={$l->capacidad_vehiculo_kg} precio_dist={$l->precio_distribuidor}\n";
    }
    echo "\n*** DRY-RUN. Agregar --apply para persistir. ***\n";
    exit(0);
}

$qClone = DB::table('liq_lineas_tarifa')->whereNull('costo_fijo_base')->where('precio_distribuidor', '>', 0);
if ($esquemaId) $qClone->where('esquema_id', $esquemaId);
$updated = $qClone->update(['costo_fijo_base' => DB::raw('precio_distribuidor')]);
echo "Actualizadas: $updated líneas.\n";
echo "Próximo paso: correr el recálculo para que los importes se recomputen con el costo_fijo_base correcto.\n";
echo "  php artisan liq:recalcular-motor-ocasa --liq=<ID> --dry-run\n";

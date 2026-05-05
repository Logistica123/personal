<?php

namespace App\Console\Commands;

use App\Models\Persona;
use App\Models\PolizaAsegurado;
use App\Services\Polizas\MatchingService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Recalcula `persona_estado_al_matchear` y `persona_alerta_estado` de todos
 * los asegurados que tienen `persona_id`. Útil cuando una persona cambia de
 * estado en `personas` (baja, suspensión, etc.) y queremos que la flag de
 * alerta de la póliza se actualice sin tener que re-cargar PDFs.
 *
 * Uso: php artisan polizas:recalcular-estados-asegurados
 */
class PolizasRecalcularEstados extends Command
{
    protected $signature = 'polizas:recalcular-estados-asegurados {--dry-run}';
    protected $description = 'Recalcula persona_estado_al_matchear/persona_alerta_estado de asegurados con persona vinculada';

    public function handle(): int
    {
        $asegurados = PolizaAsegurado::query()
            ->whereNotNull('persona_id')
            ->with('persona:id,estado_id,fecha_baja,es_solicitud,aprobado')
            ->get();

        if ($asegurados->isEmpty()) {
            $this->info('Sin asegurados con persona_id para recalcular.');
            return self::SUCCESS;
        }

        $this->info("Recalculando {$asegurados->count()} asegurados…");

        $cambios = 0;
        $alertasNuevas = 0;

        foreach ($asegurados as $a) {
            if (!$a->persona) continue;

            $estadoNuevo = MatchingService::calcularEstadoPersona($a->persona);
            $alertaNueva = MatchingService::calcularAlertaEstado($estadoNuevo, $a->estado);

            $cambioEstado = $a->persona_estado_al_matchear !== $estadoNuevo;
            $cambioAlerta = $a->persona_alerta_estado     !== $alertaNueva;

            if (!$cambioEstado && !$cambioAlerta) continue;

            $cambios++;
            if ($alertaNueva && !$a->persona_alerta_estado) {
                $alertasNuevas++;
            }

            if (!$this->option('dry-run')) {
                DB::table('polizas_asegurados')
                    ->where('id', $a->id)
                    ->update([
                        'persona_estado_al_matchear' => $estadoNuevo,
                        'persona_alerta_estado'      => $alertaNueva,
                        'updated_at'                 => now(),
                    ]);
            }
        }

        $this->info(sprintf('Cambios: %d (alertas nuevas: %d)%s',
            $cambios, $alertasNuevas, $this->option('dry-run') ? ' — dry-run, sin escribir.' : ''));
        return self::SUCCESS;
    }
}

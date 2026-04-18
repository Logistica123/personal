<?php

namespace App\Console\Commands;

use App\Models\Persona;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PoblarCapacidadVehiculoKg extends Command
{
    protected $signature = 'personas:poblar-capacidad {--dry-run : Solo mostrar qué se actualizaría, sin guardar}';
    protected $description = 'BUGFIX 22 K: Popula capacidad_vehiculo_kg en personas que estén en NULL/0, inferido desde unidad_id';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        // Mapeo unidad_id → capacidad default (según tabla unidades)
        $mapeo = [
            1 => 700,    // Chico (Fiorino, Kangoo, Cubo)
            2 => 2500,   // Mediano (Master, Ducato)
            3 => 5000,   // Grande (Accelo, Mercedes 710)
            4 => 100,    // Moto
        ];

        $this->info('Mapeo unidad_id → capacidad default:');
        foreach ($mapeo as $uid => $cap) {
            $nombre = DB::table('unidades')->where('id', $uid)->value('matricula') ?? '?';
            $this->line("  {$uid} ({$nombre}) → {$cap} kg");
        }
        $this->newLine();

        $query = Persona::whereNull('deleted_at')
            ->where(function ($q) {
                $q->whereNull('capacidad_vehiculo_kg')->orWhere('capacidad_vehiculo_kg', 0);
            });

        $total = $query->count();
        $this->info("Personas con capacidad_vehiculo_kg NULL/0: {$total}");

        $stats = ['actualizadas' => 0, 'ambiguas' => 0, 'sin_unidad' => 0];

        foreach ($query->cursor() as $persona) {
            $unidadId = $persona->unidad_id;

            if (!$unidadId) {
                $stats['sin_unidad']++;
                continue;
            }

            if (!isset($mapeo[$unidadId])) {
                $stats['ambiguas']++;
                continue;
            }

            $capacidad = $mapeo[$unidadId];

            if (!$dryRun) {
                $persona->update(['capacidad_vehiculo_kg' => $capacidad]);
            }
            $stats['actualizadas']++;
        }

        $this->newLine();
        $this->info('─── Reporte ───');
        $this->line("Actualizadas auto:   {$stats['actualizadas']}");
        $this->line("Ambiguas (unidad_id no mapeada — revisar manual): {$stats['ambiguas']}");
        $this->line("Sin unidad_id:       {$stats['sin_unidad']}");
        $this->newLine();

        if ($dryRun) {
            $this->warn('DRY RUN: no se guardaron cambios. Ejecutar sin --dry-run para aplicar.');
        } else {
            $this->info('Cambios aplicados.');
        }

        return 0;
    }
}

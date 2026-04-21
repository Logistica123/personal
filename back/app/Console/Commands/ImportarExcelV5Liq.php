<?php

namespace App\Console\Commands;

use App\Services\Liq\LiqExcelV5ImportService;
use Illuminate\Console\Command;

/**
 * SPEC INTEGRAL Fase B — Importa un xlsx con tarifas OCASA v5 (alternativa al seeder hardcodeado).
 *
 *   php artisan liq:importar-excel-v5 /path/OCASA_Tarifas_v5.xlsx
 *   php artisan liq:importar-excel-v5 /path/file.xlsx --cliente=OCASA --reemplazar
 */
class ImportarExcelV5Liq extends Command
{
    protected $signature = 'liq:importar-excel-v5
                            {archivo : Path absoluto al xlsx}
                            {--cliente=OCASA : nombre_corto del cliente}
                            {--reemplazar : Desactivar esquemas previos del cliente antes de cargar}
                            {--nombre= : Nombre opcional para el esquema nuevo}';

    protected $description = 'SPEC Fase B: importa tarifas desde xlsx físico y crea esquema nuevo activo.';

    public function handle(LiqExcelV5ImportService $svc): int
    {
        $path = $this->argument('archivo');
        if (!is_readable($path)) {
            $this->error("Archivo no legible: {$path}");
            return 1;
        }

        try {
            $res = $svc->importar(
                $path,
                clienteNombre: (string) $this->option('cliente'),
                reemplazar: (bool) $this->option('reemplazar'),
                nombreEsquema: $this->option('nombre') ?: null,
            );
        } catch (\Throwable $e) {
            $this->error('Error: ' . $e->getMessage());
            return 1;
        }

        $this->info("✓ Esquema #{$res['esquema_id']} creado");
        $this->line("  Tarifas base: {$res['base']}");
        $this->line("  Overrides:    {$res['overrides']}");

        if (!empty($res['advertencias'])) {
            $this->newLine();
            $this->warn(count($res['advertencias']) . ' advertencia(s):');
            foreach ($res['advertencias'] as $w) $this->line("  · {$w}");
        }
        if (!empty($res['skipped'])) {
            $this->warn(count($res['skipped']) . ' fila(s) salteada(s)');
        }

        return 0;
    }
}

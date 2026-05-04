<?php

namespace App\Console\Commands;

use App\Services\Polizas\MatchingService;
use Illuminate\Console\Command;

/**
 * Lee un JSON con asegurados parseados (output del microservicio Python) y los
 * matchea contra `personas` reportando stats por método. Útil para validar el
 * matching con datasets reales antes de cargar el endoso/constancia en BD.
 *
 * Uso: php artisan polizas:test-matching /tmp/mapfre.json
 */
class PolizasTestMatching extends Command
{
    protected $signature = 'polizas:test-matching {json_path}';
    protected $description = 'Matchea asegurados de un JSON parseado contra personas y reporta stats';

    public function handle(MatchingService $matcher): int
    {
        $path = $this->argument('json_path');
        if (!is_file($path)) {
            $this->error("No existe el archivo: {$path}");
            return self::FAILURE;
        }

        $data = json_decode(file_get_contents($path), true);
        $asegurados = $data['asegurados'] ?? [];
        if (empty($asegurados)) {
            $this->error('JSON sin "asegurados".');
            return self::FAILURE;
        }

        $this->info(sprintf('Aseguradora: %s · Tipo: %s · Asegurados: %d',
            $data['aseguradora_detectada'] ?? '?',
            $data['tipo_documento'] ?? '?',
            count($asegurados),
        ));
        $this->line('');

        $stats = ['cuil_exacto' => 0, 'dni_exacto' => 0, 'patente_exacto' => 0, 'fuzzy_nombre' => 0, 'no_match' => 0];
        $sin_match = [];
        $dudosos = [];

        foreach ($asegurados as $a) {
            if ($a['tipo'] === 'persona') {
                $r = $matcher->matchPersona(
                    $a['identificador'] ?? null,
                    $a['identificador_tipo'] ?? null,
                    $a['nombre_apellido'] ?? null,
                );
            } else {
                $r = $matcher->matchVehiculo($a['identificador'] ?? null);
            }

            if ($r === null) {
                $stats['no_match']++;
                $sin_match[] = sprintf('  · %s (%s) %s',
                    $a['identificador'] ?? '?',
                    $a['identificador_tipo'] ?? '?',
                    $a['nombre_apellido'] ?? $a['marca_modelo_pdf'] ?? '',
                );
                continue;
            }

            $stats[$r['metodo']]++;
            if ($r['revision_manual_pendiente']) {
                $dudosos[] = sprintf('  · %s → persona %d (score %.3f)',
                    $a['nombre_apellido'] ?? $a['identificador'],
                    $r['persona_id'],
                    $r['score'],
                );
            }
        }

        $this->line('--- Resultados ---');
        foreach ($stats as $metodo => $count) {
            $this->line(sprintf('  %-18s %d', $metodo, $count));
        }
        $total = array_sum($stats);
        $matched = $total - $stats['no_match'];
        $this->line(sprintf('  %-18s %d / %d (%.1f%%)', 'matched_total', $matched, $total, 100*$matched/max($total,1)));

        if (!empty($dudosos)) {
            $this->line('');
            $this->warn(sprintf('%d match(es) con revisión manual pendiente:', count($dudosos)));
            foreach (array_slice($dudosos, 0, 20) as $line) {
                $this->line($line);
            }
            if (count($dudosos) > 20) {
                $this->line(sprintf('  ... +%d más', count($dudosos) - 20));
            }
        }

        if (!empty($sin_match)) {
            $this->line('');
            $this->warn(sprintf('%d sin match (potenciales fantasmas o nuevos):', count($sin_match)));
            foreach (array_slice($sin_match, 0, 30) as $line) {
                $this->line($line);
            }
            if (count($sin_match) > 30) {
                $this->line(sprintf('  ... +%d más', count($sin_match) - 30));
            }
        }

        return self::SUCCESS;
    }
}

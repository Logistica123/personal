<?php

namespace App\Console\Commands;

use App\Models\LiqLiquidacionCliente;
use App\Services\Liq\LiqCalculoOcasaService;
use Illuminate\Console\Command;

/**
 * BUGFIX 31 v2: recalcula una liquidación OCASA con el motor de 3 modelos.
 *
 *   php artisan liq:recalcular-motor-ocasa --liq=41                    # aplicar
 *   php artisan liq:recalcular-motor-ocasa --liq=41 --dry-run          # simular
 *   php artisan liq:recalcular-motor-ocasa --cliente=OCASA --periodo=2026-03 --dry-run
 */
class RecalcularMotorOcasa extends Command
{
    protected $signature = 'liq:recalcular-motor-ocasa
                            {--liq= : liquidacion_cliente_id específico}
                            {--cliente= : nombre_corto del cliente (ej OCASA)}
                            {--periodo= : YYYY-MM, requiere --cliente}
                            {--dry-run : Simular sin persistir cambios}';

    protected $description = 'BUGFIX 31 v2: aplica motor de cálculo OCASA de 3 modelos sobre operaciones existentes.';

    public function handle(LiqCalculoOcasaService $service): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $liqIds = [];

        if ($liqId = $this->option('liq')) {
            $liqIds[] = (int) $liqId;
        } elseif ($cli = $this->option('cliente')) {
            $per = $this->option('periodo');
            if (!$per || !preg_match('/^(\d{4})-(\d{2})$/', $per, $m)) {
                $this->error('--periodo es requerido con --cliente, formato YYYY-MM');
                return 1;
            }
            $desde = sprintf('%04d-%02d-01', (int) $m[1], (int) $m[2]);
            $hasta = date('Y-m-t', strtotime($desde));
            $q = \App\Models\LiqCliente::where('nombre_corto', $cli)
                ->orWhere('razon_social', 'like', "%{$cli}%")
                ->first();
            if (!$q) {
                $this->error("Cliente '{$cli}' no existe.");
                return 1;
            }
            $liqIds = LiqLiquidacionCliente::where('cliente_id', $q->id)
                ->whereBetween('periodo_desde', [$desde, $hasta])
                ->pluck('id')->toArray();
        } else {
            $this->error('Pasar --liq=ID o --cliente=X --periodo=YYYY-MM');
            return 1;
        }

        if (empty($liqIds)) {
            $this->warn('No se encontraron liquidaciones cliente.');
            return 0;
        }

        foreach ($liqIds as $liqId) {
            $liq = LiqLiquidacionCliente::find($liqId);
            if (!$liq) {
                $this->warn("Liq #{$liqId} no existe, skip.");
                continue;
            }
            $this->info("Liq cliente #{$liqId} — cliente {$liq->cliente_id}, período {$liq->periodo_desde} → {$liq->periodo_hasta}");

            $stats = $service->recalcularLiquidacion($liq, $dryRun);

            if (isset($stats['motivo'])) {
                $this->warn('  ' . $stats['motivo']);
                continue;
            }

            $this->line("  Total: {$stats['total']}  |  Actualizadas: {$stats['actualizadas']}  |  Sin tarifa: {$stats['sin_tarifa']}");
            $pm = $stats['por_match'] ?? [];
            $this->line("  Por match: DISTRIBUIDOR=" . ($pm['DISTRIBUIDOR'] ?? 0) . " PATENTE=" . ($pm['PATENTE'] ?? 0) . " BASE=" . ($pm['BASE'] ?? 0) . " sin_match=" . ($pm['sin_match'] ?? 0));

            if (!empty($stats['warnings'])) {
                $this->newLine();
                $this->warn('  Warnings:');
                $shown = 0;
                foreach ($stats['warnings'] as $w => $count) {
                    $this->line("    [{$count}x] {$w}");
                    if (++$shown >= 10) { $this->line('    ...'); break; }
                }
            }

            if (!empty($stats['muestras'])) {
                $this->newLine();
                $rows = array_map(fn ($s) => [
                    $s['op_id'],
                    $s['dominio'] ?? '—',
                    $s['ruta'] ?? '—',
                    $s['capacidad'] ?? '—',
                    $s['match_tipo'] ?? '—',
                    $s['importe'] !== null ? number_format($s['importe'], 2, ',', '.') : '—',
                ], $stats['muestras']);
                $this->table(['Op', 'Dominio', 'Ruta', 'Cap', 'Match', 'Importe'], $rows);
            }
        }

        if ($dryRun) {
            $this->newLine();
            $this->warn('DRY-RUN: ningún dato se actualizó en BD. Correr sin --dry-run para aplicar.');
        }

        return 0;
    }
}

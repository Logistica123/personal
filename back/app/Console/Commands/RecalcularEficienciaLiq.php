<?php

namespace App\Console\Commands;

use App\Models\LiqLiquidacionDistribuidor;
use App\Services\Liq\LiqEficienciaService;
use Illuminate\Console\Command;

class RecalcularEficienciaLiq extends Command
{
    protected $signature = 'liq:recalcular-eficiencia
                            {--cliente= : Filtrar por nombre_corto de cliente (ej: OCASA)}
                            {--periodo= : Filtrar por período YYYY-MM (ej: 2026-03)}
                            {--liq-cliente-id= : Filtrar por liquidacion_cliente_id específico}
                            {--force : Recalcular aunque ya tengan eficiencia_calculada_at}';

    protected $description = 'BUGFIX 24 A6: recalcula eficiencia_pct en liquidaciones de distribuidor existentes';

    public function handle(LiqEficienciaService $service): int
    {
        $q = LiqLiquidacionDistribuidor::query()
            ->with('liquidacionCliente.cliente');

        if ($cli = $this->option('cliente')) {
            $q->whereHas('liquidacionCliente.cliente', function ($c) use ($cli) {
                $c->where('nombre_corto', $cli)->orWhere('razon_social', 'like', "%{$cli}%");
            });
        }

        if ($per = $this->option('periodo')) {
            // YYYY-MM → abrir rango del mes
            [$y, $m] = array_pad(explode('-', $per), 2, null);
            if ($y && $m) {
                $from = sprintf('%04d-%02d-01', (int) $y, (int) $m);
                $to   = date('Y-m-t', strtotime($from));
                $q->whereBetween('periodo_desde', [$from, $to]);
            } else {
                $this->error("Formato de --periodo inválido. Usar YYYY-MM (ej: 2026-03)");
                return 1;
            }
        }

        if ($liqId = $this->option('liq-cliente-id')) {
            $q->where('liquidacion_cliente_id', (int) $liqId);
        }

        if (!$this->option('force')) {
            $q->whereNull('eficiencia_calculada_at');
        }

        $total = $q->count();
        $this->info("Liquidaciones distribuidor a procesar: {$total}");

        if ($total === 0) {
            return 0;
        }

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $stats = ['ok' => 0, 'null' => 0, 'error' => 0];
        foreach ($q->cursor() as $liq) {
            try {
                $pct = $service->calcular($liq);
                if ($pct === null) {
                    $stats['null']++;
                } else {
                    $stats['ok']++;
                }
            } catch (\Throwable $e) {
                $stats['error']++;
                $this->newLine();
                $this->warn("LiqDist #{$liq->id}: {$e->getMessage()}");
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("OK: {$stats['ok']}  |  Sin fórmula: {$stats['null']}  |  Errores: {$stats['error']}");

        return 0;
    }
}

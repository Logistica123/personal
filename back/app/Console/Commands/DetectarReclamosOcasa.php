<?php

namespace App\Console\Commands;

use App\Models\LiqCliente;
use App\Models\LiqLiquidacionCliente;
use App\Services\Liq\LiqDeteccionSubpagoService;
use Illuminate\Console\Command;

/**
 * SPEC v3 · BUG B — Detecta subpagos OCASA y los flaguea en liq_reclamos_ocasa.
 *
 *   php artisan liq:detectar-reclamos-ocasa --liq-cliente-id=43
 *   php artisan liq:detectar-reclamos-ocasa --cliente=OCASA --periodo=2026-03
 *   php artisan liq:detectar-reclamos-ocasa --cliente=OCASA --periodo=2026-03 --tolerancia=0.05
 */
class DetectarReclamosOcasa extends Command
{
    protected $signature = 'liq:detectar-reclamos-ocasa
                            {--liq-cliente-id= : liquidacion_cliente_id específico}
                            {--cliente= : nombre_corto/codigo_corto del cliente (ej OCASA)}
                            {--periodo= : YYYY-MM, requiere --cliente}
                            {--tolerancia=0.05 : tolerancia del 5% por defecto · <0.05 = más estricto, >0.05 = más permisivo}';

    protected $description = 'SPEC v3 BUG B: detecta subpagos/sobrepagos OCASA comparando TMS contra tarifas contrato.';

    public function handle(LiqDeteccionSubpagoService $service): int
    {
        $tolerancia = (float) $this->option('tolerancia');
        $liqIds = [];

        if ($liqId = $this->option('liq-cliente-id')) {
            $liqIds[] = (int) $liqId;
        } elseif ($cliNombre = $this->option('cliente')) {
            $per = $this->option('periodo');
            if (!$per || !preg_match('/^(\d{4})-(\d{2})$/', $per, $m)) {
                $this->error('--periodo es requerido con --cliente, formato YYYY-MM');
                return 1;
            }
            $desde = sprintf('%04d-%02d-01', (int) $m[1], (int) $m[2]);
            $hasta = date('Y-m-t', strtotime($desde));

            $cli = LiqCliente::where('nombre_corto', $cliNombre)
                ->orWhere('codigo_corto', $cliNombre)
                ->orWhere('razon_social', 'like', "%{$cliNombre}%")
                ->first();
            if (!$cli) {
                $this->error("Cliente '{$cliNombre}' no existe");
                return 1;
            }

            $liqIds = LiqLiquidacionCliente::where('cliente_id', $cli->id)
                ->whereBetween('periodo_desde', [$desde, $hasta])
                ->pluck('id')->toArray();
        } else {
            $this->error('Pasar --liq-cliente-id=ID o --cliente=X --periodo=YYYY-MM');
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

            $this->info("━━━ Liq #{$liqId} · cliente={$liq->cliente_id} · {$liq->periodo_desde} → {$liq->periodo_hasta} · tolerancia=" . ($tolerancia * 100) . "%");

            $stats = $service->detectar($liq, $tolerancia);

            $this->line("  Ops analizadas:          {$stats['ops_analizadas']}");
            $this->line("  Reclamos creados:        {$stats['reclamos_creados']}");
            $this->line("  Total subpago:           $" . number_format($stats['total_subpago'], 2, ',', '.'));
            $this->line("  Total sobrepago:         $" . number_format($stats['total_sobrepago'], 2, ',', '.'));
            $this->line("  Sin tarifa_contrato:     {$stats['sin_tarifa_contrato']}");

            if (!empty($stats['por_sucursal'])) {
                $this->newLine();
                $this->line("  Por sucursal:");
                $rows = [];
                foreach ($stats['por_sucursal'] as $suc => $data) {
                    $rows[] = [$suc, $data['ops'], '$' . number_format($data['diferencia'], 2, ',', '.')];
                }
                $this->table(['Sucursal', 'Ops', 'Diferencia acum.'], $rows);
            }
            $this->newLine();
        }

        return 0;
    }
}

<?php

namespace App\Console\Commands;

use App\Models\LiqLiquidacionCliente;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * BUGFIX 27.4: detecta (y opcionalmente resuelve) liquidaciones cliente duplicadas.
 *
 *   php artisan liq:detectar-duplicados
 *   php artisan liq:detectar-duplicados --auto-resolver
 *       (marca como 'rechazada' las duplicadas salvo la más reciente por {cliente, periodo},
 *        usando el ID más alto como ganador)
 */
class DetectarDuplicadosLiq extends Command
{
    protected $signature = 'liq:detectar-duplicados
                            {--cliente= : Filtrar por nombre_corto del cliente}
                            {--auto-resolver : Marcar como rechazada las duplicadas dejando sólo la más reciente}';

    protected $description = 'BUGFIX 27.4: detecta liquidaciones cliente duplicadas por {cliente, período} y opcionalmente las resuelve.';

    public function handle(): int
    {
        $q = DB::table('liq_liquidaciones_cliente as lc')
            ->join('liq_clientes as c', 'c.id', '=', 'lc.cliente_id')
            ->whereNotIn('lc.estado', [LiqLiquidacionCliente::ESTADO_RECHAZADA])
            ->selectRaw('lc.cliente_id, c.nombre_corto, lc.periodo_desde, lc.periodo_hasta, COUNT(*) as cant, GROUP_CONCAT(lc.id ORDER BY lc.id DESC) as ids')
            ->groupBy('lc.cliente_id', 'c.nombre_corto', 'lc.periodo_desde', 'lc.periodo_hasta')
            ->havingRaw('COUNT(*) > 1');

        if ($filtroCliente = $this->option('cliente')) {
            $q->where('c.nombre_corto', $filtroCliente);
        }

        $dup = $q->get();

        if ($dup->isEmpty()) {
            $this->info('Sin duplicados detectados.');
            return 0;
        }

        $this->warn($dup->count() . ' grupo(s) de duplicados encontrados:');
        $this->newLine();

        $rows = [];
        foreach ($dup as $d) {
            $rows[] = [
                $d->nombre_corto,
                "{$d->periodo_desde} → {$d->periodo_hasta}",
                $d->cant,
                $d->ids,
            ];
        }
        $this->table(['Cliente', 'Período', '#Dup', 'IDs (DESC)'], $rows);

        if ($this->option('auto-resolver')) {
            $rechazadas = 0;
            foreach ($dup as $d) {
                $ids = explode(',', $d->ids);
                $ganador = (int) $ids[0];
                $perdedores = array_slice($ids, 1);
                foreach ($perdedores as $pid) {
                    LiqLiquidacionCliente::whereKey((int) $pid)
                        ->update([
                            'estado' => LiqLiquidacionCliente::ESTADO_RECHAZADA,
                        ]);
                    $rechazadas++;
                }
                $this->line("Cliente {$d->nombre_corto} ({$d->periodo_desde}): ganador #{$ganador}, rechazadas: " . implode(',', $perdedores));
            }
            $this->info("Total rechazadas: {$rechazadas}");
        } else {
            $this->comment('Correr con --auto-resolver para marcar como rechazadas las duplicadas (se conserva la de ID más alto por grupo).');
        }

        return 0;
    }
}

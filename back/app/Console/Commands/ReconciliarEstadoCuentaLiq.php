<?php

namespace App\Console\Commands;

use App\Services\Liq\LiqEstadoCuentaGeneratorService;
use Illuminate\Console\Command;

/**
 * BUGFIX 28.5: reconciliación periódica.
 * Detecta huecos (sucursales con ops pero sin fila en liq_estado_cuenta_cliente)
 * en los últimos N meses. Si --auto-repair, crea las filas faltantes.
 *
 *   php artisan liq:reconciliar-estado-cuenta                  # solo reporta
 *   php artisan liq:reconciliar-estado-cuenta --auto-repair    # crea las faltantes
 *   php artisan liq:reconciliar-estado-cuenta --meses=6
 */
class ReconciliarEstadoCuentaLiq extends Command
{
    protected $signature = 'liq:reconciliar-estado-cuenta
                            {--cliente= : Opcional, filtrar por nombre_corto}
                            {--meses=3 : Cantidad de meses hacia atrás a revisar}
                            {--auto-repair : Crea automáticamente las filas faltantes (si no, sólo reporta)}';

    protected $description = 'BUGFIX 28: detecta huecos entre operaciones y estado de cuenta cliente; opcionalmente los repara.';

    public function handle(LiqEstadoCuentaGeneratorService $service): int
    {
        $meses = (int) ($this->option('meses') ?? 3);
        $auto = (bool) $this->option('auto-repair');
        $cli = $this->option('cliente');

        $clienteId = null;
        if ($cli) {
            $cliente = \App\Models\LiqCliente::where('nombre_corto', $cli)->first();
            if (!$cliente) {
                $this->error("Cliente '{$cli}' no existe");
                return 1;
            }
            $clienteId = $cliente->id;
        }

        if (!$auto) {
            // Simular: el service hace un pasaje que puede crear filas.
            // Para un "solo reporte" tendríamos que rollback. Lo hago con transacción.
            \DB::beginTransaction();
            $huecos = $service->detectarHuecos($clienteId, $meses);
            \DB::rollBack();
        } else {
            $huecos = $service->detectarHuecos($clienteId, $meses);
        }

        if (empty($huecos)) {
            $this->info('Sin huecos detectados en los últimos ' . $meses . ' meses.');
            return 0;
        }

        $rows = array_map(fn ($h) => [
            $h['cliente_id'],
            $h['cliente'] ?? '—',
            $h['periodo_tag'] ?? '—',
            $h['sucursal'],
            $h['ops'],
            $h['liquidacion_cliente_id'],
        ], $huecos);

        $this->table(['ClienteID', 'Cliente', 'Período', 'Sucursal', 'Ops', 'LiqClienteID'], $rows);
        $this->newLine();

        if ($auto) {
            $this->info(count($huecos) . ' fila(s) creada(s).');
        } else {
            $this->warn(count($huecos) . ' hueco(s) detectado(s). Correr con --auto-repair para crearlos.');
        }

        return 0;
    }
}

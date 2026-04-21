<?php

namespace App\Console\Commands;

use App\Models\LiqCliente;
use App\Models\LiqLiquidacionCliente;
use App\Services\Liq\LiqEstadoCuentaGeneratorService;
use Illuminate\Console\Command;

/**
 * BUGFIX 28.4: backfill histórico de filas en liq_estado_cuenta_cliente
 *
 *   php artisan liq:backfill-estado-cuenta --cliente=OCASA --periodo=2026-03
 *   php artisan liq:backfill-estado-cuenta --cliente=OCASA --periodo=2026-03 --dry-run
 *   php artisan liq:backfill-estado-cuenta --cliente=OCASA --periodo=2026-03 --forzar
 */
class BackfillEstadoCuentaLiq extends Command
{
    protected $signature = 'liq:backfill-estado-cuenta
                            {--cliente= : nombre_corto o razón social del cliente (requerido)}
                            {--periodo= : Período YYYY-MM (requerido)}
                            {--dry-run : Solo muestra qué haría, sin tocar BD}
                            {--forzar : Regenera filas aunque no haya cambios (no pisa FACTURADA/COBRADA)}';

    protected $description = 'BUGFIX 28: regenera filas en liq_estado_cuenta_cliente para un cliente+período, agregando por sucursal.';

    public function handle(LiqEstadoCuentaGeneratorService $service): int
    {
        $clienteArg = (string) $this->option('cliente');
        $periodo    = (string) $this->option('periodo');
        $dryRun     = (bool) $this->option('dry-run');
        $forzar     = (bool) $this->option('forzar');

        if ($clienteArg === '' || $periodo === '') {
            $this->error('--cliente y --periodo son obligatorios');
            return 1;
        }

        $cliente = LiqCliente::where('nombre_corto', $clienteArg)
            ->orWhere('razon_social', 'like', "%{$clienteArg}%")
            ->first();
        if (!$cliente) {
            $this->error("No se encontró cliente '{$clienteArg}'");
            return 1;
        }

        $this->info("Cliente: {$cliente->nombre_corto} (#{$cliente->id})");
        $this->info("Período: {$periodo}");
        $this->info("Split fiscal activo: " . ($cliente->split_fiscal_por_sucursal ? 'SÍ' : 'NO'));
        $this->newLine();

        if ($dryRun) {
            $this->warn('DRY-RUN: usando transacción que se hace rollback al final');
            \DB::beginTransaction();
        }

        $result = $service->generarParaClientePeriodo($cliente->id, $periodo, $forzar);

        if (isset($result['motivo'])) {
            $this->warn($result['motivo']);
            if ($dryRun) \DB::rollBack();
            return 0;
        }

        // Tabla de sucursales
        $rows = [];
        foreach (($result['sucursales'] ?? []) as $s) {
            $rows[] = [
                $s['accion'] ?? '?',
                $s['sucursal'] ?? '—',
                $s['ops'] ?? 0,
                number_format($s['neto_gravado'] ?? 0, 2, ',', '.'),
                number_format($s['no_gravado'] ?? 0, 2, ',', '.'),
                number_format($s['iva'] ?? 0, 2, ',', '.'),
                number_format($s['importe_a_cobrar'] ?? 0, 2, ',', '.'),
                ($s['ops_sin_split'] ?? 0) > 0 ? "⚠{$s['ops_sin_split']}" : '',
            ];
        }
        if (!empty($rows)) {
            $this->table(['Acción', 'Sucursal', 'Ops', 'Gravado', 'No Grav', 'IVA', 'A Cobrar', 'Sin split'], $rows);
        } else {
            $this->warn('Ninguna sucursal encontrada con operaciones para el período');
        }

        $this->newLine();
        $this->info(sprintf(
            'Resumen: %d creadas | %d actualizadas | %d sin cambios | %d omitidas (ya facturadas)',
            $result['creadas'] ?? 0,
            $result['actualizadas'] ?? 0,
            $result['sin_cambios'] ?? 0,
            $result['omitidas_facturadas'] ?? 0
        ));

        if ($dryRun) {
            \DB::rollBack();
            $this->warn('DRY-RUN: cambios REVERTIDOS. Ejecutar sin --dry-run para aplicar.');
        }

        return 0;
    }
}

<?php

namespace App\Console\Commands;

use App\Models\LiqCliente;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqOperacion;
use App\Services\Liq\LiqCalculoOcasaService;
use App\Services\Liq\LiqEficienciaService;
use App\Services\Liq\LiqEstadoCuentaGeneratorService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * SPEC INTEGRAL Fase A — orquestador de recálculo completo OCASA.
 *
 *   php artisan liq:recalcular --cliente=OCASA --periodo=2026-03 [--dry-run]
 *
 * Pasos que ejecuta por op:
 *   1. Motor LiqCalculoOcasaService → valor_tarifa_distribuidor (importe al distrib)
 *   2. LiqEficienciaService::recalcularOperacion → paradas_exitosas/con_motivo/eficiencia_pct
 *
 * Al final, regenera filas en liq_estado_cuenta_cliente (LiqEstadoCuentaGeneratorService).
 *
 * Con --dry-run corre todo en transacción con rollback — muestra diff pero no persiste.
 */
class RecalcularLiquidacionIntegral extends Command
{
    protected $signature = 'liq:recalcular
                            {--cliente=OCASA : nombre_corto del cliente}
                            {--periodo= : YYYY-MM (requerido)}
                            {--liq-id=* : (opcional) IDs de liq_liquidaciones_cliente puntuales — filtra solo esas. Ej: --liq-id=43 --liq-id=44}
                            {--dry-run : Simula sin persistir cambios}';

    protected $description = 'SPEC Fase A: recalcula importe + eficiencia + estado de cuenta para un cliente/período.';

    public function handle(
        LiqCalculoOcasaService $calc,
        LiqEficienciaService $efi,
        LiqEstadoCuentaGeneratorService $ec
    ): int {
        $cli  = (string) $this->option('cliente');
        $per  = (string) $this->option('periodo');
        $dry  = (bool) $this->option('dry-run');

        if (!preg_match('/^(\d{4})-(\d{2})$/', $per, $m)) {
            $this->error('--periodo es requerido YYYY-MM');
            return 1;
        }
        $from = sprintf('%04d-%02d-01', (int) $m[1], (int) $m[2]);
        $to   = date('Y-m-t', strtotime($from));

        $cliente = LiqCliente::where('nombre_corto', $cli)
            ->orWhere('razon_social', 'like', "%{$cli}%")->first();
        if (!$cliente) {
            $this->error("Cliente '{$cli}' no existe");
            return 1;
        }

        $esquema = LiqEsquemaTarifario::where('cliente_id', $cliente->id)
            ->where('activo', true)->latest()->first();
        if (!$esquema) {
            $this->error("Sin esquema tarifario activo para {$cliente->nombre_corto}");
            return 1;
        }

        $liqIdsFiltro = (array) $this->option('liq-id');
        $liqsClientes = LiqLiquidacionCliente::where('cliente_id', $cliente->id)
            ->whereBetween('periodo_desde', [$from, $to])
            ->when(!empty($liqIdsFiltro), fn ($q) => $q->whereIn('id', $liqIdsFiltro))
            ->get();
        $liqIds = $liqsClientes->pluck('id');

        if (!empty($liqIdsFiltro)) {
            $this->info('Filtro por --liq-id: ' . implode(', ', $liqIdsFiltro));
        }

        $ops = LiqOperacion::whereIn('liquidacion_cliente_id', $liqIds)
            ->whereIn('estado', ['ok', 'diferencia', 'pendiente', 'sin_tarifa'])
            ->where('excluida', false)
            ->get();

        $this->info("━━━ {$cliente->nombre_corto} · {$per} · esquema #{$esquema->id} ━━━");
        $this->info("Liquidaciones cliente: {$liqsClientes->count()}  |  Operaciones: {$ops->count()}");
        $this->newLine();

        if ($ops->isEmpty()) {
            $this->warn('Sin operaciones para recalcular');
            return 0;
        }

        if ($dry) {
            DB::beginTransaction();
        }

        $stats = [
            'ops_recalculadas' => 0,
            'sin_tarifa' => 0,
            'por_match' => [
                'DISTRIBUIDOR' => 0, 'PATENTE' => 0, 'BASE' => 0,
                'PRODUCTIVIDAD' => 0,  // SPEC v3 · Rama D
                'sin_match' => 0,
            ],
            'ef_ops_con_ycc' => 0,
            'ef_ops_sin_ycc' => 0,
            'delta_total_importe' => 0.0,
            'muestras' => [],
        ];

        foreach ($ops as $op) {
            $importeAnterior = (float) ($op->valor_tarifa_distribuidor ?? 0);

            // 1. Motor cálculo
            $resCalc = $calc->calcularOperacion($op, $esquema);
            $match   = $resCalc['match_tipo'] ?? 'sin_match';
            $stats['por_match'][$match ?: 'sin_match']++;
            if ($resCalc['importe'] === null) $stats['sin_tarifa']++;

            if ($resCalc['importe'] !== null) {
                $op->update([
                    'modelo_calculo' => $match,
                    'linea_tarifa_id' => $resCalc['linea_tarifa_id'] ?? $op->linea_tarifa_id,
                    'valor_tarifa_distribuidor' => $resCalc['importe'],
                    'estado' => 'ok',
                    // SPEC v3/v4 — persistir modo_pago + detalle_paradas para que el PDF
                    // pueda renderizar Niveles 3 y 4 con la agrupación correcta.
                    'modo_pago' => $resCalc['modo_pago'] ?? null,
                    'estado_calculo' => $resCalc['estado_calculo'] ?? 'ok',
                    'error_msg' => $resCalc['error_msg'] ?? null,
                    'detalle_paradas' => isset($resCalc['detalle_paradas']) && is_array($resCalc['detalle_paradas']) && !empty($resCalc['detalle_paradas'])
                        ? json_encode($resCalc['detalle_paradas'], JSON_UNESCAPED_UNICODE)
                        : null,
                ]);
                $stats['delta_total_importe'] += ($resCalc['importe'] - $importeAnterior);
                $stats['ops_recalculadas']++;
            }

            // 2. Eficiencia por op
            $resEf = $efi->recalcularOperacion($op, registrarAuditoria: !$dry);
            if (($resEf['total'] ?? 0) > 0) $stats['ef_ops_con_ycc']++;
            else $stats['ef_ops_sin_ycc']++;

            // Muestras
            if (count($stats['muestras']) < 8) {
                $stats['muestras'][] = [
                    'op' => $op->id,
                    'dominio' => $op->dominio,
                    'ruta' => $op->concepto,
                    'match' => $match,
                    'prev' => $importeAnterior,
                    'new' => $resCalc['importe'],
                    'delta' => $resCalc['importe'] !== null ? round($resCalc['importe'] - $importeAnterior, 2) : null,
                    'ef' => $resEf['pct'],
                ];
            }
        }

        // 3. Regenerar estado de cuenta
        $ecStats = null;
        if ($cliente->split_fiscal_por_sucursal) {
            foreach ($liqsClientes as $lc) {
                $ecStats = $ec->generarDesdeLiquidacionCliente($lc, null, forzarRegeneracion: true);
            }
        }

        // Reporte
        $this->info("Motor cálculo:");
        $this->line("  ops recalculadas: {$stats['ops_recalculadas']}  |  sin tarifa: {$stats['sin_tarifa']}");
        $this->line("  matches: DISTRIBUIDOR={$stats['por_match']['DISTRIBUIDOR']}  PATENTE={$stats['por_match']['PATENTE']}  BASE={$stats['por_match']['BASE']}  PRODUCTIVIDAD={$stats['por_match']['PRODUCTIVIDAD']}  sin_match={$stats['por_match']['sin_match']}");
        $this->line('  Δ total importe distribuidor: $' . number_format($stats['delta_total_importe'], 2, ',', '.'));
        $this->newLine();

        $this->info("Eficiencia:");
        $this->line("  ops con YCC cargado: {$stats['ef_ops_con_ycc']}  |  sin YCC: {$stats['ef_ops_sin_ycc']}");
        $this->newLine();

        if ($ecStats) {
            $this->info("Estado de cuenta cliente:");
            $this->line("  creadas: " . ($ecStats['creadas'] ?? 0)
                . "  |  actualizadas: " . ($ecStats['actualizadas'] ?? 0)
                . "  |  sin cambios: " . ($ecStats['sin_cambios'] ?? 0)
                . "  |  omitidas (facturadas): " . ($ecStats['omitidas_facturadas'] ?? 0));
            $this->newLine();
        }

        if (!empty($stats['muestras'])) {
            $rows = array_map(fn ($m) => [
                $m['op'],
                $m['dominio'],
                $m['ruta'],
                $m['match'],
                '$ ' . number_format($m['prev'], 2, ',', '.'),
                $m['new'] !== null ? '$ ' . number_format($m['new'], 2, ',', '.') : '—',
                $m['delta'] !== null ? '$ ' . number_format($m['delta'], 2, ',', '.') : '—',
                $m['ef'] !== null ? number_format($m['ef'], 2, ',', '.') . '%' : '—',
            ], $stats['muestras']);
            $this->table(['Op', 'Dom', 'Ruta', 'Match', 'Anterior', 'Nuevo', 'Δ', 'Eficiencia'], $rows);
        }

        if ($dry) {
            DB::rollBack();
            $this->warn('DRY-RUN: ningún cambio persistido. Re-correr sin --dry-run para aplicar.');
        } else {
            $this->info('✓ Cambios aplicados');
        }

        return 0;
    }
}

<?php

namespace App\Services\Liq;

use App\Models\LiqLiquidacionDistribuidor;
use App\Models\LiqOperacion;
use App\Models\LiqOperacionDetalle;
use App\Services\Liq\Eficiencia\EficienciaNoOpStrategy;
use App\Services\Liq\Eficiencia\EficienciaOcasaStrategy;
use App\Services\Liq\Eficiencia\EficienciaStrategy;
use Illuminate\Support\Facades\DB;

/**
 * Orquesta el cálculo de eficiencia.
 *
 * Históricamente (BUGFIX 24) operaba solo sobre liq_liquidaciones_distribuidor usando
 * SUM(costo_fijo)/SUM(valor_tarifa_original). SPEC INTEGRAL Fase A agrega el cálculo
 * correcto basado en paradas YCC:
 *
 *     eficiencia_op = 100 × paradas_exitosas / paradas_con_motivo
 *     paradas_con_motivo: COUNT YCC con motivo NO vacío (NULL/'' se excluyen)
 *     paradas_exitosas:   COUNT motivo IN liq_motivos_exitosos es_exitoso=1
 *
 * La eficiencia del distribuidor en un período = SUM(exitosas)/SUM(con_motivo),
 * NO promedio de promedios (evita sesgo cuando una op tiene 1 sola parada).
 */
class LiqEficienciaService
{
    private array $motivosCache = [];

    // ─── Modo agregado por liquidación distribuidor (BUGFIX 24 compat) ─────
    public function calcular(LiqLiquidacionDistribuidor $liq): ?float
    {
        $liq->loadMissing('liquidacionCliente.cliente');
        $cliente = $liq->liquidacionCliente?->cliente;
        $nombre  = strtoupper(trim((string) ($cliente?->nombre_corto ?? $cliente?->razon_social ?? 'DESCONOCIDO')));

        $strategy = $this->resolveStrategy($nombre);
        [$pct, $detalle] = $strategy->calcular($liq);

        $liq->eficiencia_pct          = $pct;
        $liq->eficiencia_detalle      = $detalle;
        $liq->eficiencia_calculada_at = now();
        $liq->save();

        return $pct !== null ? (float) $pct : null;
    }

    private function resolveStrategy(string $clienteNombre): EficienciaStrategy
    {
        if (str_contains($clienteNombre, 'OCASA')) {
            return new EficienciaOcasaStrategy();
        }
        return new EficienciaNoOpStrategy($clienteNombre);
    }

    // ─── Fase A: eficiencia por operación (nueva fórmula paradas) ──────────

    /**
     * Recalcula eficiencia de UNA operación desde sus paradas YCC.
     * Persiste: paradas_ycc_total, paradas_con_motivo, paradas_exitosas, eficiencia_pct, eficiencia_calculada_at.
     *
     * @return array{
     *   pct: float|null,
     *   total: int,
     *   con_motivo: int,
     *   exitosas: int,
     *   calificacion: string,
     * }
     */
    public function recalcularOperacion(LiqOperacion $op, bool $registrarAuditoria = true): array
    {
        $clienteId = $op->liquidacionCliente?->cliente_id
            ?? ($op->liquidacionCliente()->value('cliente_id'))
            ?? null;

        $motivosOk = $clienteId ? $this->motivosExitosos($clienteId) : [];

        $paradas = LiqOperacionDetalle::where('operacion_id', $op->id)->get();
        $total = $paradas->count();

        $conMotivo = $paradas->filter(fn ($p) => trim((string) ($p->motivo ?? '')) !== '');
        $exitosas = $conMotivo->filter(fn ($p) => in_array(trim((string) $p->motivo), $motivosOk, true));

        $pct = $conMotivo->count() > 0
            ? round(100.0 * $exitosas->count() / $conMotivo->count(), 2)
            : null;

        // Auditoría del cambio
        if ($registrarAuditoria && ($op->eficiencia_pct !== null || $op->paradas_exitosas !== null)) {
            $prev = [
                'pct' => $op->eficiencia_pct,
                'exitosas' => $op->paradas_exitosas,
                'con_motivo' => $op->paradas_con_motivo,
            ];
            $nue = [
                'pct' => $pct,
                'exitosas' => $exitosas->count(),
                'con_motivo' => $conMotivo->count(),
            ];
            if ($prev != $nue) {
                DB::table('liq_auditoria_eficiencia')->insert([
                    'operacion_id' => $op->id,
                    'eficiencia_anterior' => $prev['pct'],
                    'eficiencia_nueva' => $nue['pct'],
                    'paradas_exitosas_ant' => $prev['exitosas'],
                    'paradas_exitosas_nue' => $nue['exitosas'],
                    'paradas_con_motivo_ant' => $prev['con_motivo'],
                    'paradas_con_motivo_nue' => $nue['con_motivo'],
                    'motivo_recalculo' => 'recalc_manual',
                    'created_at' => now(),
                ]);
            }
        }

        $op->update([
            'paradas_ycc_total'       => $total,
            'paradas_con_motivo'      => $conMotivo->count(),
            'paradas_exitosas'        => $exitosas->count(),
            'eficiencia_pct'          => $pct,
            'eficiencia_calculada_at' => now(),
        ]);

        return [
            'pct'          => $pct,
            'total'        => $total,
            'con_motivo'   => $conMotivo->count(),
            'exitosas'     => $exitosas->count(),
            'calificacion' => $this->calificar($pct),
        ];
    }

    /**
     * Eficiencia agregada de un distribuidor en un período (suma real, no promedio de promedios).
     */
    public function eficienciaDistribuidorPeriodo(
        int $distribuidorId,
        int $clienteId,
        string $periodoDesde,
        string $periodoHasta
    ): array {
        $agg = DB::table('liq_operaciones as lo')
            ->join('liq_liquidaciones_cliente as lc', 'lc.id', '=', 'lo.liquidacion_cliente_id')
            ->where('lc.cliente_id', $clienteId)
            ->whereBetween('lc.periodo_desde', [$periodoDesde, $periodoHasta])
            ->where('lo.distribuidor_id', $distribuidorId)
            ->where('lo.excluida', false)
            ->selectRaw("
                COALESCE(SUM(lo.paradas_con_motivo), 0) as con_motivo,
                COALESCE(SUM(lo.paradas_exitosas), 0)   as exitosas,
                COALESCE(SUM(lo.paradas_ycc_total), 0)  as total,
                COUNT(*) as ops
            ")
            ->first();

        if (!$agg || (int) $agg->con_motivo === 0) {
            return ['pct' => null, 'con_motivo' => 0, 'exitosas' => 0, 'total' => (int) ($agg->total ?? 0), 'ops' => (int) ($agg->ops ?? 0), 'calificacion' => 'Sin datos'];
        }

        $pct = round(100.0 * (int) $agg->exitosas / (int) $agg->con_motivo, 2);
        return [
            'pct'          => $pct,
            'exitosas'     => (int) $agg->exitosas,
            'con_motivo'   => (int) $agg->con_motivo,
            'total'        => (int) $agg->total,
            'ops'          => (int) $agg->ops,
            'calificacion' => $this->calificar($pct),
        ];
    }

    public function motivosExitosos(int $clienteId): array
    {
        if (!isset($this->motivosCache[$clienteId])) {
            $this->motivosCache[$clienteId] = DB::table('liq_motivos_exitosos')
                ->where('cliente_id', $clienteId)
                ->where('es_exitoso', true)
                ->pluck('codigo')
                ->map(fn ($c) => trim((string) $c))
                ->toArray();
        }
        return $this->motivosCache[$clienteId];
    }

    public function calificar(?float $pct): string
    {
        if ($pct === null) return 'Sin datos';
        if ($pct >= 95) return 'Excelente';
        if ($pct >= 85) return 'Muy Bueno';
        if ($pct >= 70) return 'Bueno';
        if ($pct >= 50) return 'Regular';
        return 'Bajo';
    }

    public function colorBadge(?float $pct): string
    {
        if ($pct === null) return '#9E9E9E';
        if ($pct >= 95) return '#2E7D32';
        if ($pct >= 85) return '#388E3C';
        if ($pct >= 70) return '#F9A825';
        if ($pct >= 50) return '#F57C00';
        return '#C62828';
    }
}

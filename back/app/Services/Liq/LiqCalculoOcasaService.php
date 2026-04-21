<?php

namespace App\Services\Liq;

use App\Models\LiqEsquemaTarifario;
use App\Models\LiqLineaTarifa;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqOperacion;
use Illuminate\Support\Facades\DB;

/**
 * BUGFIX 31 v2 — Motor de cálculo OCASA unificado (Excel v5 "OCASA_Tarifas_v5").
 *
 *   pago = costo_fijo_distrib × fracción_jornada
 *        + factor_km_distrib   × CostoKm_TMS
 *        + factor_prod_distrib × CostoProd_TMS
 *        + factor_cant_distrib × CostoCant_TMS
 *        − penalidades_TMS
 *
 * Resolver por prioridad:
 *   1) Match por {ruta, capacidad_vehiculo, distribuidor_nombre} con es_tarifa_base=0
 *   2) Match por {ruta, capacidad_vehiculo, patente_match}        con es_tarifa_base=0
 *   3) Match por {ruta, capacidad_vehiculo}                        con es_tarifa_base=1 (BASE)
 *   4) Sin match → operación queda en estado sin_tarifa
 *
 * Todas las tarifas (base + overrides) viven en liq_lineas_tarifa con flag es_tarifa_base.
 */
class LiqCalculoOcasaService
{
    /**
     * @return array{
     *   match_tipo: 'DISTRIBUIDOR'|'PATENTE'|'BASE'|null,
     *   linea_tarifa_id: int|null,
     *   importe: float|null,
     *   desglose: array,
     *   warnings: array,
     * }
     */
    public function calcularOperacion(LiqOperacion $op, LiqEsquemaTarifario $esquema): array
    {
        $ruta = (string) ($op->concepto ?? '');  // en OCASA la "ruta" se guarda en concepto
        $capacidad = (int) ($op->capacidad_vehiculo_kg ?? 0);
        $patente = strtoupper(trim((string) ($op->dominio ?? '')));

        // Nombre del distribuidor para match (case-insensitive, trim)
        $distNombre = null;
        if ($op->distribuidor_id) {
            $p = \DB::table('personas')->where('id', $op->distribuidor_id)
                ->first(['apellidos', 'nombres']);
            if ($p) {
                $distNombre = strtoupper(trim(($p->apellidos ?? '') . ' ' . ($p->nombres ?? '')));
                // También variante "Nombres Apellidos"
                $distNombreAlt = strtoupper(trim(($p->nombres ?? '') . ' ' . ($p->apellidos ?? '')));
            }
        }

        // 1. Match por distribuidor_nombre
        if ($distNombre) {
            $q = LiqLineaTarifa::where('esquema_id', $esquema->id)
                ->where('activo', true)
                ->where('es_tarifa_base', false)
                ->where('ruta_codigo', $ruta)
                ->where('capacidad_vehiculo_kg', $capacidad)
                ->whereNotNull('distribuidor_nombre');
            $linea = (clone $q)->whereRaw('UPPER(TRIM(distribuidor_nombre)) = ?', [$distNombre])->first()
                ?? (clone $q)->whereRaw('UPPER(TRIM(distribuidor_nombre)) = ?', [$distNombreAlt ?? ''])->first();
            if ($linea) {
                return $this->aplicarFormula($op, $linea, 'DISTRIBUIDOR');
            }
        }

        // 2. Match por patente_match
        if ($patente !== '') {
            $linea = LiqLineaTarifa::where('esquema_id', $esquema->id)
                ->where('activo', true)
                ->where('es_tarifa_base', false)
                ->where('ruta_codigo', $ruta)
                ->where('capacidad_vehiculo_kg', $capacidad)
                ->where('patente_match', $patente)
                ->first();
            if ($linea) {
                return $this->aplicarFormula($op, $linea, 'PATENTE');
            }
        }

        // 3. Match BASE
        $linea = LiqLineaTarifa::where('esquema_id', $esquema->id)
            ->where('activo', true)
            ->where('es_tarifa_base', true)
            ->where('ruta_codigo', $ruta)
            ->where('capacidad_vehiculo_kg', $capacidad)
            ->first();
        if ($linea) {
            return $this->aplicarFormula($op, $linea, 'BASE');
        }

        // 4. Sin match
        return [
            'match_tipo' => null,
            'linea_tarifa_id' => null,
            'importe' => null,
            'desglose' => ['motivo' => 'Sin match — no hay tarifa base ni override para esta ruta+capacidad'],
            'warnings' => ["Sin tarifa para ruta={$ruta}, capacidad={$capacidad}kg, distribuidor={$distNombre}, patente={$patente}"],
        ];
    }

    /**
     * Fórmula unificada Excel v5.
     */
    private function aplicarFormula(LiqOperacion $op, LiqLineaTarifa $linea, string $tipoMatch): array
    {
        $costoFijo    = (float) ($linea->costo_fijo_base ?? 0);
        $factorKm     = $linea->factor_km !== null ? (float) $linea->factor_km : null;
        $factorProd   = $linea->factor_prod_distrib !== null ? (float) $linea->factor_prod_distrib : null;
        $factorCant   = $linea->factor_cant_distrib !== null ? (float) $linea->factor_cant_distrib : null;

        $fraccion   = (float) ($op->fraccion_jornada ?? 1.0);
        $costoKmTms = (float) ($op->costo_km ?? 0);
        $costoProdTms = (float) ($op->costo_prod ?? 0);
        $costoCantTms = (float) ($op->costo_cant ?? 0);
        $penalidades = (float) ($op->campos_originales['penalidades'] ?? 0); // si se captura después; por ahora 0

        $componentes = [
            'costo_fijo'       => round($costoFijo * $fraccion, 2),
            'km'               => $factorKm !== null ? round($factorKm * $costoKmTms, 2) : 0.0,
            'productividad'    => $factorProd !== null ? round($factorProd * $costoProdTms, 2) : 0.0,
            'cantidad'         => $factorCant !== null ? round($factorCant * $costoCantTms, 2) : 0.0,
            'penalidades'      => round($penalidades, 2),
        ];

        $importe = round(
            $componentes['costo_fijo']
            + $componentes['km']
            + $componentes['productividad']
            + $componentes['cantidad']
            - $componentes['penalidades'],
            2
        );

        return [
            'match_tipo'      => $tipoMatch,
            'linea_tarifa_id' => $linea->id,
            'importe'         => $importe,
            'desglose'        => [
                'formula'          => 'costo_fijo × frac + factor_km × CostoKm_TMS + factor_prod × CostoProd_TMS + factor_cant × CostoCant_TMS − penalidades',
                'costo_fijo_distrib' => $costoFijo,
                'fraccion_jornada' => $fraccion,
                'factor_km'        => $factorKm,
                'factor_prod'      => $factorProd,
                'factor_cant'      => $factorCant,
                'costo_km_tms'     => $costoKmTms,
                'costo_prod_tms'   => $costoProdTms,
                'costo_cant_tms'   => $costoCantTms,
                'penalidades_tms'  => $penalidades,
                'componentes'      => $componentes,
            ],
            'warnings'        => [],
        ];
    }

    /**
     * Recalcula todas las operaciones OK/diferencia de una liquidación cliente con el motor v5.
     */
    public function recalcularLiquidacion(
        LiqLiquidacionCliente $liqCliente,
        bool $dryRun = false
    ): array {
        $esquema = LiqEsquemaTarifario::where('cliente_id', $liqCliente->cliente_id)
            ->where('activo', true)
            ->latest()
            ->first();
        if (!$esquema) {
            return ['total' => 0, 'motivo' => 'Sin esquema tarifario activo para cliente', 'actualizadas' => 0];
        }

        $ops = LiqOperacion::where('liquidacion_cliente_id', $liqCliente->id)
            ->whereIn('estado', ['ok', 'diferencia', 'pendiente', 'sin_tarifa'])
            ->where('excluida', false)
            ->get();

        $stats = [
            'total' => $ops->count(),
            'actualizadas' => 0,
            'sin_tarifa' => 0,
            'por_match' => ['DISTRIBUIDOR' => 0, 'PATENTE' => 0, 'BASE' => 0, 'sin_match' => 0],
            'warnings' => [],
            'muestras' => [],
        ];

        foreach ($ops as $op) {
            $res = $this->calcularOperacion($op, $esquema);

            $tipo = $res['match_tipo'] ?? 'sin_match';
            $stats['por_match'][$tipo ?: 'sin_match']++;
            if ($res['importe'] === null) $stats['sin_tarifa']++;

            foreach ($res['warnings'] as $w) {
                $stats['warnings'][$w] = ($stats['warnings'][$w] ?? 0) + 1;
            }

            if (count($stats['muestras']) < 5) {
                $stats['muestras'][] = [
                    'op_id' => $op->id,
                    'dominio' => $op->dominio,
                    'ruta' => $op->concepto,
                    'capacidad' => $op->capacidad_vehiculo_kg,
                    'match_tipo' => $tipo,
                    'importe' => $res['importe'],
                ];
            }

            if ($dryRun) continue;

            $op->update([
                'modelo_calculo' => $tipo,
                'linea_tarifa_id' => $res['linea_tarifa_id'] ?? $op->linea_tarifa_id,
                'valor_tarifa_distribuidor' => $res['importe'],
                'requiere_override_manual' => false,
                'estado' => $res['importe'] !== null ? 'ok' : 'sin_tarifa',
            ]);

            if ($res['importe'] !== null) $stats['actualizadas']++;
        }

        return $stats;
    }
}

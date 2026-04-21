<?php

namespace App\Services\Liq;

use App\Models\LiqCliente;
use App\Models\LiqEstadoCuentaCliente;
use App\Models\LiqJurisdiccionSucursal;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqOperacion;
use Illuminate\Support\Carbon;

/**
 * BUGFIX 28: genera/actualiza filas de liq_estado_cuenta_cliente agregando
 * las operaciones por sucursal. Usa el split grav/no_grav real si el cliente
 * tiene `split_fiscal_por_sucursal = true` (OCASA); caso contrario trata
 * `valor_cliente` como totalmente gravado (comportamiento histórico).
 *
 * Es idempotente: re-corrido actualiza filas PENDIENTE existentes en lugar
 * de duplicar. Nunca toca filas FACTURADA/COBRADA/NC_EMITIDA (warning en log).
 */
class LiqEstadoCuentaGeneratorService
{
    private const IVA_RATE = 0.21;

    /**
     * Regenera para una liquidación cliente específica (todas sus sucursales).
     */
    public function generarDesdeLiquidacionCliente(
        LiqLiquidacionCliente $liqCliente,
        ?int $usuarioId = null,
        bool $forzarRegeneracion = false
    ): array {
        $liqCliente->loadMissing('cliente');
        return $this->generar(
            $liqCliente->cliente_id,
            $liqCliente->periodo_desde->toDateString(),
            $liqCliente->periodo_hasta->toDateString(),
            liqClienteId: $liqCliente->id,
            usuarioId: $usuarioId,
            forzarRegeneracion: $forzarRegeneracion,
        );
    }

    /**
     * Regenera para cliente+período sin importar cuántas liquidaciones cliente existan.
     * Útil para backfill histórico.
     */
    public function generarParaClientePeriodo(
        int $clienteId,
        string $periodo,               // '2026-03' o '2026-03-01'
        bool $forzarRegeneracion = false
    ): array {
        // Normalizar período: si viene 'YYYY-MM' expando a rango completo del mes.
        if (preg_match('/^(\d{4})-(\d{2})$/', $periodo, $m)) {
            $y = (int) $m[1];
            $mo = (int) $m[2];
            $desde = sprintf('%04d-%02d-01', $y, $mo);
            $hasta = date('Y-m-t', strtotime($desde));
        } else {
            $d = Carbon::parse($periodo);
            $desde = $d->copy()->startOfMonth()->toDateString();
            $hasta = $d->copy()->endOfMonth()->toDateString();
        }

        return $this->generar(
            $clienteId,
            $desde,
            $hasta,
            liqClienteId: null,
            usuarioId: null,
            forzarRegeneracion: $forzarRegeneracion,
        );
    }

    /**
     * Núcleo: agrega operaciones por sucursal y upsertea filas.
     *
     * @return array{creadas:int, actualizadas:int, sin_cambios:int, omitidas_facturadas:int, sucursales:array}
     */
    private function generar(
        int $clienteId,
        string $periodoDesde,
        string $periodoHasta,
        ?int $liqClienteId = null,
        ?int $usuarioId = null,
        bool $forzarRegeneracion = false
    ): array {
        $cliente = LiqCliente::find($clienteId);
        $usarSplit = (bool) ($cliente?->split_fiscal_por_sucursal ?? false);

        // Todas las liq_liquidaciones_cliente del cliente+período
        $liqIds = LiqLiquidacionCliente::where('cliente_id', $clienteId)
            ->whereBetween('periodo_desde', [$periodoDesde, $periodoHasta])
            ->pluck('id');

        if ($liqIds->isEmpty()) {
            return [
                'creadas' => 0, 'actualizadas' => 0, 'sin_cambios' => 0,
                'omitidas_facturadas' => 0, 'sucursales' => [],
                'motivo' => "No hay liq_liquidaciones_cliente para cliente {$clienteId} entre {$periodoDesde} y {$periodoHasta}",
            ];
        }

        // Agregar por sucursal_tarifa sobre TODAS las liquidaciones cliente del período
        $agregado = LiqOperacion::whereIn('liquidacion_cliente_id', $liqIds)
            ->whereIn('estado', ['ok', 'diferencia'])
            ->where('excluida', false)
            ->selectRaw("
                sucursal_tarifa,
                COUNT(*) as cant,
                COALESCE(SUM(valor_cliente), 0)        as sum_valor_cliente,
                COALESCE(SUM(importe_gravado), 0)      as sum_gravado,
                COALESCE(SUM(importe_no_gravado), 0)   as sum_no_gravado,
                SUM(CASE WHEN importe_gravado IS NULL OR importe_no_gravado IS NULL THEN 1 ELSE 0 END) as ops_sin_split
            ")
            ->groupBy('sucursal_tarifa')
            ->get();

        // Período en formato 'mes-YY' (compatibilidad con schema actual)
        $desde = Carbon::parse($periodoDesde);
        $hasta = Carbon::parse($periodoHasta);
        $mesesAbrev = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        $periodoTag = $mesesAbrev[$desde->month] . '-' . $desde->format('y');

        $quincena = 'MC';
        if ($desde->day === 1 && $hasta->day <= 15) $quincena = 'Q1';
        elseif ($desde->day >= 16) $quincena = 'Q2';

        $stats = ['creadas' => 0, 'actualizadas' => 0, 'sin_cambios' => 0, 'omitidas_facturadas' => 0];
        $sucursales = [];

        foreach ($agregado as $row) {
            $sucursal = $row->sucursal_tarifa;
            if (!$sucursal) continue;

            // Cálculo del split según si el cliente lo usa
            if ($usarSplit) {
                $netoGravado = round((float) $row->sum_gravado, 2);
                $noGravado   = round((float) $row->sum_no_gravado, 2);
            } else {
                $netoGravado = round((float) $row->sum_valor_cliente, 2);
                $noGravado   = 0.0;
            }
            $iva = round($netoGravado * self::IVA_RATE, 2);
            $importeACobrar = round($netoGravado + $iva + $noGravado, 2);

            // Jurisdicción (cache/upsert existente)
            $jurisdiccion = LiqJurisdiccionSucursal::where('cliente_id', $clienteId)
                ->where('sucursal', $sucursal)
                ->first();

            // Upsert por (cliente_id, sucursal, periodo, quincena, tipo_comprobante='FA')
            $existing = LiqEstadoCuentaCliente::where('cliente_id', $clienteId)
                ->where('sucursal', $sucursal)
                ->where('periodo', $periodoTag)
                ->where('quincena', $quincena)
                ->where('tipo_comprobante', LiqEstadoCuentaCliente::TIPO_FA)
                ->first();

            $entry = [
                'sucursal'    => $sucursal,
                'ops'         => (int) $row->cant,
                'ops_sin_split' => (int) ($row->ops_sin_split ?? 0),
                'neto_gravado' => $netoGravado,
                'no_gravado'  => $noGravado,
                'iva'         => $iva,
                'importe_a_cobrar' => $importeACobrar,
            ];

            if ($existing) {
                // Respetar filas ya facturadas / cobradas
                if ($existing->estado !== LiqEstadoCuentaCliente::ESTADO_PENDIENTE) {
                    $entry['accion'] = 'omitida_facturada';
                    $entry['estado_actual'] = $existing->estado;
                    $sucursales[] = $entry;
                    $stats['omitidas_facturadas']++;
                    \Log::warning("LiqEstadoCuentaGenerator: fila {$existing->id} ({$sucursal}, {$periodoTag}) en estado {$existing->estado} — no se regenera");
                    continue;
                }

                // Diff para saber si hay cambios
                $cambio = (
                    round((float) $existing->neto_gravado, 2) !== $netoGravado ||
                    round((float) $existing->no_gravado, 2) !== $noGravado ||
                    round((float) $existing->iva, 2) !== $iva ||
                    round((float) $existing->importe_a_cobrar, 2) !== $importeACobrar
                );

                if (!$cambio && !$forzarRegeneracion) {
                    $entry['accion'] = 'sin_cambios';
                    $sucursales[] = $entry;
                    $stats['sin_cambios']++;
                    continue;
                }

                $existing->update([
                    'jurisdiccion_id'        => $jurisdiccion?->jurisdiccion_id ?? $existing->jurisdiccion_id,
                    'neto_gravado'           => $netoGravado,
                    'no_gravado'             => $noGravado,
                    'iva'                    => $iva,
                    'importe_a_cobrar'       => $importeACobrar,
                    'liquidacion_cliente_id' => $liqClienteId ?? $existing->liquidacion_cliente_id,
                    'usuario_id'             => $usuarioId ?? $existing->usuario_id,
                ]);
                $entry['accion'] = 'actualizada';
                $entry['row_id'] = $existing->id;
                $sucursales[] = $entry;
                $stats['actualizadas']++;
            } else {
                $new = LiqEstadoCuentaCliente::create([
                    'cliente_id'             => $clienteId,
                    'sucursal'               => $sucursal,
                    'jurisdiccion_id'        => $jurisdiccion?->jurisdiccion_id,
                    'periodo'                => $periodoTag,
                    'quincena'               => $quincena,
                    'neto_gravado'           => $netoGravado,
                    'no_gravado'             => $noGravado,
                    'iva'                    => $iva,
                    'importe_a_cobrar'       => $importeACobrar,
                    'tipo_comprobante'       => LiqEstadoCuentaCliente::TIPO_FA,
                    'liquidacion_cliente_id' => $liqClienteId,
                    'estado'                 => LiqEstadoCuentaCliente::ESTADO_PENDIENTE,
                    'usuario_id'             => $usuarioId,
                ]);
                $entry['accion'] = 'creada';
                $entry['row_id'] = $new->id;
                $sucursales[] = $entry;
                $stats['creadas']++;
            }
        }

        return array_merge($stats, [
            'cliente_id' => $clienteId,
            'cliente'    => $cliente?->nombre_corto ?? $cliente?->razon_social,
            'periodo_tag' => $periodoTag,
            'usa_split_fiscal' => $usarSplit,
            'sucursales' => $sucursales,
        ]);
    }

    /**
     * Detecta "huecos": sucursales con operaciones en el período que
     * NO tienen fila en estado de cuenta. Usado por el job de reconciliación.
     *
     * @return array<int, array{cliente_id:int, cliente:?string, periodo_tag:string, sucursal:string, ops:int}>
     */
    public function detectarHuecos(?int $clienteId = null, int $mesesAtras = 3): array
    {
        $desde = now()->subMonths($mesesAtras)->startOfMonth()->toDateString();

        $query = LiqLiquidacionCliente::query()
            ->when($clienteId, fn ($q) => $q->where('cliente_id', $clienteId))
            ->where('periodo_desde', '>=', $desde);

        $huecos = [];
        foreach ($query->get() as $lc) {
            $result = $this->generar(
                $lc->cliente_id,
                $lc->periodo_desde->toDateString(),
                $lc->periodo_hasta->toDateString(),
                liqClienteId: $lc->id,
                forzarRegeneracion: false
            );
            foreach (($result['sucursales'] ?? []) as $s) {
                // Detectar solo las que se acaban de crear — indica que faltaban antes
                if (($s['accion'] ?? null) === 'creada') {
                    $huecos[] = [
                        'cliente_id'    => $lc->cliente_id,
                        'cliente'       => $result['cliente'] ?? null,
                        'periodo_tag'   => $result['periodo_tag'] ?? null,
                        'sucursal'      => $s['sucursal'],
                        'ops'           => $s['ops'],
                        'liquidacion_cliente_id' => $lc->id,
                    ];
                }
            }
        }
        return $huecos;
    }
}

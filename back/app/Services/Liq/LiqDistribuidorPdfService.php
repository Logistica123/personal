<?php

namespace App\Services\Liq;

use App\Models\LiqLiquidacionDistribuidor;
use App\Models\LiqOperacion;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class LiqDistribuidorPdfService
{
    /**
     * @param  Collection<int, LiqOperacion>  $operaciones
     */
    public function renderPdf(LiqLiquidacionDistribuidor $liqDist, Collection $operaciones): string
    {
        $liqDist->loadMissing([
            'distribuidor:id,apellidos,nombres,cuil,email,telefono,patente,sucursal_id',
            'distribuidor.sucursal:id,codigo_corto,nombre',
            'liquidacionCliente:id,cliente_id,periodo_desde,periodo_hasta',
            'liquidacionCliente.cliente:id,nombre_corto,razon_social,cuit',
        ]);

        // Detectar si es OCASA por modelo_tarifa en operaciones
        $isOcasa = $operaciones->contains(fn (LiqOperacion $op) => $op->modelo_tarifa !== null);

        if ($isOcasa) {
            return $this->renderPdfOcasa($liqDist, $operaciones);
        }

        return $this->renderPdfGenerico($liqDist, $operaciones);
    }

    private function renderPdfGenerico(LiqLiquidacionDistribuidor $liqDist, Collection $operaciones): string
    {
        $cliente = $liqDist->liquidacionCliente?->cliente;
        $distribuidor = $liqDist->distribuidor;

        $logoDataUri = $this->loadLogoDataUri();

        $desde = $this->safeDate($liqDist->periodo_desde?->toDateString() ?? (string) $liqDist->periodo_desde);
        $hasta = $this->safeDate($liqDist->periodo_hasta?->toDateString() ?? (string) $liqDist->periodo_hasta);

        $ops = $operaciones
            ->map(function (LiqOperacion $op) {
                $raw = is_array($op->campos_originales) ? $op->campos_originales : [];

                $fecha = $this->pick($raw, ['FechaViaje', 'fechaViaje', 'fecha_viaje', 'Fecha', 'fecha']);
                $importe = $op->valor_tarifa_distribuidor !== null ? (float) $op->valor_tarifa_distribuidor : null;

                // Cantidad: de campos_originales o calculada
                $cantidad = $this->pick($raw, ['cantidad', 'qty']);
                if ($cantidad !== null) {
                    $cantidad = (float) $cantidad;
                }

                // Tarifa unitaria distribuidor: de campos_originales o calculada
                $tarifaUnit = null;
                if ($importe !== null && $cantidad !== null && $cantidad > 0) {
                    $tarifaUnit = round($importe / $cantidad, 2);
                }
                // Si no hay cantidad pero hay valor_tarifa_distribuidor, la cantidad es 1
                if ($cantidad === null && $importe !== null) {
                    $cantidad = 1;
                    $tarifaUnit = $importe;
                }

                return [
                    'id' => (int) $op->id,
                    'fecha' => $this->formatDate($fecha),
                    'concepto' => $op->concepto,
                    'cantidad' => $cantidad,
                    'tarifaUnit' => $tarifaUnit,
                    'importe' => $importe,
                ];
            })
            ->sortBy(function (array $row) {
                return ($row['fecha'] ?? '') . '|' . ($row['concepto'] ?? '') . '|' . (string) ($row['id'] ?? 0);
            })
            ->values();

        $html = view('liq.liquidacion_distribuidor', [
            'logoDataUri' => $logoDataUri,
            'cliente' => [
                'nombre' => $cliente?->nombre_corto ?: ($cliente?->razon_social ?: 'Cliente'),
                'razon_social' => $cliente?->razon_social,
                'cuit' => $cliente?->cuit,
            ],
            'empresa' => [
                'razon_social' => 'LOGISTICA ARGENTINA SRL',
            ],
            'distribuidor' => [
                'nombre' => trim(($distribuidor?->apellidos ?? '') . ' ' . ($distribuidor?->nombres ?? '')) ?: null,
                'cuil' => $distribuidor?->cuil,
                'email' => $distribuidor?->email,
                'telefono' => $distribuidor?->telefono,
                'patente' => $distribuidor?->patente,
            ],
            'liq' => [
                'periodo_desde' => $desde,
                'periodo_hasta' => $hasta,
                'cantidad_operaciones' => (int) $liqDist->cantidad_operaciones,
                'subtotal' => (float) $liqDist->subtotal,
                'gastos' => (float) $liqDist->gastos_administrativos,
                'total' => (float) $liqDist->total_a_pagar,
                'sucursal' => $operaciones->first()?->sucursal_tarifa,
            ],
            'operaciones' => $ops,
        ])->render();

        return $this->renderDompdf($html);
    }

    private function renderPdfOcasa(LiqLiquidacionDistribuidor $liqDist, Collection $operaciones): string
    {
        $cliente = $liqDist->liquidacionCliente?->cliente;
        $distribuidor = $liqDist->distribuidor;

        $logoDataUri = $this->loadLogoDataUri();

        $desde = $this->safeDate($liqDist->periodo_desde?->toDateString() ?? (string) $liqDist->periodo_desde);
        $hasta = $this->safeDate($liqDist->periodo_hasta?->toDateString() ?? (string) $liqDist->periodo_hasta);

        // SPEC v3 · agregador de resumen mensual de paradas (rama D productividad).
        // Se acumula cruzando todas las ops para mostrarlo al pie del PDF.
        $resumenMensual = [];  // key: "material|zona|estado" → [paradas, importe]

        $ops = $operaciones
            ->map(function (LiqOperacion $op) use (&$resumenMensual) {
                $raw = is_array($op->campos_originales) ? $op->campos_originales : [];
                $fecha = $this->pick($raw, ['Fecha Planif/', 'FechaPlanif', 'fecha_planif', 'Fecha', 'fecha']);
                $importe = $op->valor_tarifa_distribuidor !== null ? (float) $op->valor_tarifa_distribuidor : null;

                $umbralKm = 240;
                $kmExcedente = 0;
                $tarifaKmUnit = 0;
                $valorKm = 0;

                if ($op->modelo_tarifa === 'JORNADA_KM' && (float) $op->fraccion_jornada >= 1.0) {
                    $kmExcedente = max(0, (float) $op->distancia_km - $umbralKm);
                    $valorKm = (float) ($op->tarifa_km_distrib_valor ?? 0);
                    $tarifaKmUnit = $kmExcedente > 0 ? round($valorKm / $kmExcedente, 2) : 0;
                }

                // SPEC v3 Addendum · Rama D · decode detalle_paradas + agrupar para PDF
                $detalleParadas = null;
                if ($op->modo_pago === 'productividad_paradas') {
                    $raw_dp = $op->detalle_paradas;
                    if (is_string($raw_dp)) $raw_dp = json_decode($raw_dp, true);
                    if (is_array($raw_dp) && !empty($raw_dp)) {
                        // Nivel 3: agrupación por (parada_num × material_la × motivo)
                        $detalleParadas = $this->agruparParaNivel3($raw_dp);

                        // Nivel 4: resumen mensual usando filas YCC raw (no agrupadas).
                        // # paradas se calcula con SET de (op_id, parada_num) para no duplicar
                        // paradas multi-material en el conteo.
                        foreach ($raw_dp as $f) {
                            $materialLa = (string) ($f['material_la'] ?? '—');
                            $zona       = (string) ($f['zona'] ?? '—');
                            $estado     = (string) ($f['estado'] ?? 'visitado_ne');
                            $costoLa    = (float) ($f['costo_la'] ?? $f['tarifa_la'] ?? 0);
                            $bultos     = (int) ($f['bultos'] ?? 0);
                            $paradaNum  = (int) ($f['parada_num'] ?? 0);

                            $key = $materialLa . '|' . $zona . '|' . $estado;
                            if (!isset($resumenMensual[$key])) {
                                $resumenMensual[$key] = [
                                    'material_la'    => $materialLa,
                                    'zona'           => $zona,
                                    'estado'         => $estado,
                                    'paradas_unicas' => [],   // set: 'op_id|parada_num' => true
                                    'bultos'         => 0,
                                    'importe'        => 0.0,
                                ];
                            }
                            $resumenMensual[$key]['paradas_unicas'][$op->id . '|' . $paradaNum] = true;
                            $resumenMensual[$key]['bultos']  += $bultos;
                            $resumenMensual[$key]['importe'] += $costoLa;
                        }
                    }
                }

                // Modalidad legible para el PDF
                $modalidad = match ($op->modo_pago) {
                    'productividad_paradas' => 'Productividad',
                    'factor_tms'            => 'Jornada+KM',
                    'override_jornada'      => 'Jornada',
                    default                 => $op->modelo_tarifa ?? '—',
                };

                return [
                    'id' => (int) $op->id,
                    'fecha' => $this->formatDate($fecha),
                    'transporte' => $op->id_operacion_cliente,
                    'ruta' => $op->concepto,
                    'sucursal_op' => $op->sucursal_tarifa,
                    'modelo' => $op->modelo_tarifa,
                    'modalidad' => $modalidad,
                    'modo_pago' => $op->modo_pago,
                    'fraccion' => (float) ($op->fraccion_jornada ?? 1.0),
                    'tarifa_jornada' => $op->tarifa_jornada_distrib !== null ? (float) $op->tarifa_jornada_distrib : null,
                    'km_excedente' => $kmExcedente,
                    'tarifa_km' => $tarifaKmUnit,
                    'valor_km' => $valorKm,
                    'paradas' => $op->total_paradas,
                    'tarifa_prod' => $op->tarifa_prod_distrib !== null ? (float) $op->tarifa_prod_distrib : null,
                    'importe' => $importe,
                    'detalle_paradas' => $detalleParadas,  // SPEC v3 · null o array agrupado
                ];
            })
            ->sortBy(function (array $row) {
                return ($row['fecha'] ?? '') . '|' . ($row['ruta'] ?? '') . '|' . (string) ($row['id'] ?? 0);
            })
            ->values();

        // SPEC v3 Addendum · Nivel 4: convertir set paradas_unicas → count + ordenar
        $resumenMensualSorted = collect($resumenMensual)
            ->map(function ($g) {
                $g['paradas'] = count($g['paradas_unicas'] ?? []);
                unset($g['paradas_unicas']);
                return $g;
            })
            ->sortBy(fn ($g) => $g['material_la'] . '|' . $g['zona'] . '|' . $g['estado'])
            ->values()
            ->all();

        // BUGFIX 26.1: resolver sucursal "principal" del distribuidor.
        //   Preferencia: persona.sucursal (FK), si no aparece se usa la sucursal dominante de las ops.
        $sucursalPrincipal = null;
        if ($distribuidor?->sucursal) {
            $codigo = $distribuidor->sucursal->codigo_corto;
            $nombre = $distribuidor->sucursal->nombre;
            $sucursalPrincipal = trim(($codigo ? $codigo . ' · ' : '') . ($nombre ?? ''));
        }
        if (!$sucursalPrincipal) {
            $sucursalesDistintas = $operaciones->pluck('sucursal_tarifa')->filter()->unique();
            if ($sucursalesDistintas->count() === 1) {
                $sucursalPrincipal = $sucursalesDistintas->first();
            } elseif ($sucursalesDistintas->count() > 1) {
                $sucursalPrincipal = 'Múltiples (' . $sucursalesDistintas->count() . ')';
            }
        }

        $html = view('liq.liquidacion_distribuidor_ocasa', [
            'logoDataUri' => $logoDataUri,
            'cliente' => [
                'nombre' => $cliente?->nombre_corto ?: ($cliente?->razon_social ?: 'Cliente'),
                'razon_social' => $cliente?->razon_social,
                'cuit' => $cliente?->cuit,
            ],
            'empresa' => [
                'razon_social' => 'LOGISTICA ARGENTINA SRL',
            ],
            'distribuidor' => [
                'nombre' => trim(($distribuidor?->apellidos ?? '') . ' ' . ($distribuidor?->nombres ?? '')) ?: null,
                'cuil' => $distribuidor?->cuil,
                'email' => $distribuidor?->email,
                'telefono' => $distribuidor?->telefono,
                'patente' => $distribuidor?->patente,
            ],
            'liq' => [
                'periodo_desde' => $desde,
                'periodo_hasta' => $hasta,
                'cantidad_operaciones' => (int) $liqDist->cantidad_operaciones,
                'subtotal' => (float) $liqDist->subtotal,
                'gastos' => (float) $liqDist->gastos_administrativos,
                'peajes' => (float) ($liqDist->subtotal_peajes ?? 0),
                'reembolso_peajes' => (float) ($liqDist->total_reembolso_peajes ?? 0),
                // BUGFIX 25: solo renderizar bloque de peajes si el cliente los reembolsa
                'cliente_paga_peajes' => (bool) ($liqDist->liquidacionCliente?->cliente?->pagar_peajes_a_distribuidor ?? false),
                // BUGFIX 24 C
                'eficiencia_pct' => $liqDist->eficiencia_pct !== null ? (float) $liqDist->eficiencia_pct : null,
                'eficiencia_detalle' => $liqDist->eficiencia_detalle,
                'mostrar_eficiencia' => (bool) ($liqDist->liquidacionCliente?->cliente?->mostrar_eficiencia_en_pdf ?? true),
                'beneficio_seguro' => (float) ($liqDist->beneficio_seguro ?? 0),
                'total' => (float) $liqDist->total_a_pagar,
                'sucursal' => $sucursalPrincipal,  // BUGFIX 26.1: sucursal del distribuidor
            ],
            'operaciones' => $ops,
            'resumenMensual' => $resumenMensualSorted,  // SPEC v3 · footer productividad
        ])->render();

        return $this->renderDompdf($html, 'landscape');
    }

    /**
     * SPEC v3 Addendum · Nivel 3 · Agrupa las filas YCC de una op en
     * {parada_num, material_la, motivo} → UNA fila por grupo.
     *
     *   - Parada simple → 1 fila visual.
     *   - Parada con N bultos del mismo material/motivo → 1 fila (bultos sumados).
     *   - Parada con 2 materiales distintos → 2 filas (una por material).
     *   - Parada con 2 motivos distintos (ej. parte exitosa + parte fallida) → 2 filas.
     *
     * @param array<int,array<string,mixed>> $detalleParadas filas YCC sin agrupar
     * @return array<int,array{parada_num:int,zona:string,material_la:string,motivo:string,
     *                          estado:string,bultos:int,costo_orig:float,costo_la:float}>
     */
    private function agruparParaNivel3(array $detalleParadas): array
    {
        $grupos = [];
        foreach ($detalleParadas as $f) {
            $paradaNum  = (int) ($f['parada_num'] ?? 0);
            $materialLa = (string) ($f['material_la'] ?? '—');
            $motivo     = (string) ($f['motivo'] ?? '—');
            $key = $paradaNum . '|' . $materialLa . '|' . $motivo;
            if (!isset($grupos[$key])) {
                $grupos[$key] = [
                    'parada_num'  => $paradaNum,
                    'zona'        => (string) ($f['zona'] ?? '—'),
                    'material_la' => $materialLa,
                    'motivo'      => $motivo,
                    'estado'      => (string) ($f['estado'] ?? 'visitado_ne'),
                    'bultos'      => 0,
                    'costo_orig'  => 0.0,
                    'costo_la'    => 0.0,
                ];
            }
            $grupos[$key]['bultos']     += (int) ($f['bultos'] ?? 0);
            $grupos[$key]['costo_orig'] += (float) ($f['costo_orig'] ?? $f['tarifa_orig'] ?? 0);
            $grupos[$key]['costo_la']   += (float) ($f['costo_la']   ?? $f['tarifa_la']   ?? 0);
        }
        usort($grupos, fn ($a, $b) =>
            [$a['parada_num'], $a['material_la'], $a['motivo']]
            <=> [$b['parada_num'], $b['material_la'], $b['motivo']]
        );
        return array_values($grupos);
    }

    private function renderDompdf(string $html, string $orientation = 'portrait'): string
    {
        $options = new Options();
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('isRemoteEnabled', false);
        $options->set('isHtml5ParserEnabled', true);

        $dompdf = new Dompdf($options);
        $dompdf->setPaper('A4', $orientation);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->render();

        return $dompdf->output();
    }

    private function loadLogoDataUri(): ?string
    {
        $path = public_path('logo-empresa.png');
        if (! is_string($path) || ! file_exists($path)) {
            return null;
        }

        $bin = file_get_contents($path);
        if ($bin === false || $bin === '') {
            return null;
        }

        return 'data:image/png;base64,' . base64_encode($bin);
    }

    private function safeDate(?string $value): string
    {
        try {
            return Carbon::parse((string) $value)->toDateString();
        } catch (\Throwable) {
            return substr((string) $value, 0, 10) ?: now()->toDateString();
        }
    }

    private function pick(array $data, array $keys): mixed
    {
        foreach ($keys as $key) {
            if (! array_key_exists($key, $data)) {
                continue;
            }
            $value = $data[$key];
            if (is_string($value)) {
                $trimmed = trim($value);
                if ($trimmed !== '') {
                    return $trimmed;
                }
            } elseif ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    private function formatDate(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        try {
            return Carbon::parse((string) $value)->format('d/m/Y');
        } catch (\Throwable) {
            $raw = (string) $value;
            return $raw !== '' ? $raw : null;
        }
    }
}


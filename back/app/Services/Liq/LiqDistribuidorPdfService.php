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
        // SET global de paradas únicas del mes para el TOTAL del Nivel 4.
        // Necesario porque sumar las paradas por fila duplica las paradas multi-material
        // (una parada con 2 materiales aparece en 2 filas; el SET las cuenta una sola vez).
        $totalMesParadasSet = [];

        $ops = $operaciones
            ->map(function (LiqOperacion $op) use (&$resumenMensual, &$totalMesParadasSet) {
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

                // SPEC v4 · Rama D · decode detalle_paradas + agrupar para PDF
                $detalleParadas = null;
                $paradasEntregadas = null;
                $paradasTotales = null;
                if ($op->modo_pago === 'productividad_paradas') {
                    $raw_dp = $op->detalle_paradas;
                    if (is_string($raw_dp)) $raw_dp = json_decode($raw_dp, true);
                    if (is_array($raw_dp) && !empty($raw_dp)) {
                        // Factor LA→Distribuidor: leer del primer detalle (todos comparten en una op)
                        $factor = (float) ($raw_dp[0]['factor_aplicado'] ?? 0.85);

                        // Nivel 3: agrupación por (material_la × zona × estado) - simplificado
                        $detalleParadas = $this->agruparParaNivel3($raw_dp, $factor);

                        // Conteo entregadas/totales con paradas únicas (set por parada_num)
                        $setEntregadas = [];
                        $setTotales = [];
                        foreach ($raw_dp as $f) {
                            $pn = (int) ($f['parada_num'] ?? 0);
                            if ($pn === 0) continue;
                            $setTotales[$pn] = true;
                            if (($f['estado'] ?? '') === 'entregado') {
                                $setEntregadas[$pn] = true;
                            }
                        }
                        $paradasEntregadas = count($setEntregadas);
                        $paradasTotales    = count($setTotales);

                        // Nivel 4: resumen mensual con costo_orig_sum para evitar pérdida de centavos
                        // # paradas con SET de (op_id, parada_num) para no duplicar paradas multi-material
                        foreach ($raw_dp as $f) {
                            $materialLa = (string) ($f['material_la'] ?? '—');
                            $zona       = (string) ($f['zona'] ?? '—');
                            $estado     = (string) ($f['estado'] ?? 'visitado_ne');
                            $costoOrig  = (float) ($f['costo_orig'] ?? $f['tarifa_orig'] ?? 0);
                            $bultos     = (int) ($f['bultos'] ?? 0);
                            $paradaNum  = (int) ($f['parada_num'] ?? 0);

                            $key = $materialLa . '|' . $zona . '|' . $estado;
                            if (!isset($resumenMensual[$key])) {
                                $resumenMensual[$key] = [
                                    'material_la'    => $materialLa,
                                    'zona'           => $zona,
                                    'estado'         => $estado,
                                    'paradas_unicas' => [],
                                    'bultos'         => 0,
                                    'costo_orig_sum' => 0.0,   // sumar sin redondeo intermedio
                                    'factor'         => $factor,
                                ];
                            }
                            $resumenMensual[$key]['paradas_unicas'][$op->id . '|' . $paradaNum] = true;
                            $resumenMensual[$key]['bultos']         += $bultos;
                            $resumenMensual[$key]['costo_orig_sum'] += $costoOrig;

                            // SET global del mes (ignora material/zona/estado para no duplicar
                            // paradas multi-material cuando se totaliza el Nivel 4).
                            $totalMesParadasSet[$op->id . '|' . $paradaNum] = true;
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
                    'paradas_entregadas' => $paradasEntregadas,
                    'paradas_totales' => $paradasTotales,
                    'tarifa_prod' => $op->tarifa_prod_distrib !== null ? (float) $op->tarifa_prod_distrib : null,
                    'importe' => $importe,
                    'detalle_paradas' => $detalleParadas,  // SPEC v3 · null o array agrupado
                ];
            })
            ->sortBy(function (array $row) {
                return ($row['fecha'] ?? '') . '|' . ($row['ruta'] ?? '') . '|' . (string) ($row['id'] ?? 0);
            })
            ->values();

        // SPEC v4 · Nivel 4: convertir set paradas_unicas → count + calcular importe correcto
        $resumenMensualSorted = collect($resumenMensual)
            ->map(function ($g) {
                $g['paradas'] = count($g['paradas_unicas'] ?? []);
                $g['importe'] = round($g['costo_orig_sum'] * ($g['factor'] ?? 0.85), 2);
                unset($g['paradas_unicas'], $g['costo_orig_sum'], $g['factor']);
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
            'resumenMensualTotalParadas' => count($totalMesParadasSet),  // SET global, evita duplicar multi-material
        ])->render();

        return $this->renderDompdf($html, 'landscape');
    }

    /**
     * SPEC v4 · Nivel 3 simplificado · Agrupa las filas YCC de una op en
     * {material_la, zona, estado} → UNA fila por grupo (4-5 filas por op típicamente).
     *
     * Cuenta paradas únicas usando SET de parada_num — una parada con 2 materiales NO se
     * duplica al sumar las paradas de cada material (cuenta 1 en cada uno).
     *
     * El cobra_la se calcula como `Σ costo_orig × factor` (un solo round al final del
     * grupo) para evitar pérdida de centavos al acumular round() por fila.
     *
     * @param array<int,array<string,mixed>> $detalleParadas filas YCC sin agrupar
     * @param float $factor factor LA→Distribuidor a aplicar (ej 0.85)
     * @return array<int,array{material_la:string,zona:string,estado:string,
     *                          paradas:int,bultos:int,cobra_la:float}>
     */
    private function agruparParaNivel3(array $detalleParadas, float $factor): array
    {
        $grupos = [];
        foreach ($detalleParadas as $f) {
            $materialLa = (string) ($f['material_la'] ?? '—');
            $zona       = (string) ($f['zona'] ?? '—');
            $estado     = (string) ($f['estado'] ?? 'visitado_ne');
            $paradaNum  = (int) ($f['parada_num'] ?? 0);
            $key        = $materialLa . '|' . $zona . '|' . $estado;

            if (!isset($grupos[$key])) {
                $grupos[$key] = [
                    'material_la'    => $materialLa,
                    'zona'           => $zona,
                    'estado'         => $estado,
                    'paradas_unicas' => [],
                    'bultos'         => 0,
                    'costo_orig_sum' => 0.0,
                ];
            }
            $grupos[$key]['paradas_unicas'][$paradaNum] = true;
            $grupos[$key]['bultos']         += (int) ($f['bultos'] ?? 0);
            $grupos[$key]['costo_orig_sum'] += (float) ($f['costo_orig'] ?? $f['tarifa_orig'] ?? 0);
        }

        $resultado = [];
        foreach ($grupos as $g) {
            $resultado[] = [
                'material_la' => $g['material_la'],
                'zona'        => $g['zona'],
                'estado'      => $g['estado'],
                'paradas'     => count($g['paradas_unicas']),
                'bultos'      => $g['bultos'],
                'cobra_la'    => round($g['costo_orig_sum'] * $factor, 2),
            ];
        }

        usort($resultado, fn ($a, $b) =>
            [$a['material_la'], $a['zona'], $a['estado']] <=> [$b['material_la'], $b['zona'], $b['estado']]
        );

        return $resultado;
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


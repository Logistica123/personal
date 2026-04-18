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
            'distribuidor:id,apellidos,nombres,cuil,email,telefono,patente',
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

        $ops = $operaciones
            ->map(function (LiqOperacion $op) {
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

                return [
                    'id' => (int) $op->id,
                    'fecha' => $this->formatDate($fecha),
                    'transporte' => $op->id_operacion_cliente,
                    'ruta' => $op->concepto,
                    'modelo' => $op->modelo_tarifa,
                    'fraccion' => (float) ($op->fraccion_jornada ?? 1.0),
                    'tarifa_jornada' => $op->tarifa_jornada_distrib !== null ? (float) $op->tarifa_jornada_distrib : null,
                    'km_excedente' => $kmExcedente,
                    'tarifa_km' => $tarifaKmUnit,
                    'valor_km' => $valorKm,
                    'paradas' => $op->total_paradas,
                    'tarifa_prod' => $op->tarifa_prod_distrib !== null ? (float) $op->tarifa_prod_distrib : null,
                    'importe' => $importe,
                ];
            })
            ->sortBy(function (array $row) {
                return ($row['fecha'] ?? '') . '|' . ($row['ruta'] ?? '') . '|' . (string) ($row['id'] ?? 0);
            })
            ->values();

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
                'beneficio_seguro' => (float) ($liqDist->beneficio_seguro ?? 0),
                'total' => (float) $liqDist->total_a_pagar,
                'sucursal' => $operaciones->first()?->sucursal_tarifa,
            ],
            'operaciones' => $ops,
        ])->render();

        return $this->renderDompdf($html, 'landscape');
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


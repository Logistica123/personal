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

        $cliente = $liqDist->liquidacionCliente?->cliente;
        $distribuidor = $liqDist->distribuidor;

        $logoDataUri = $this->loadLogoDataUri();

        $desde = $this->safeDate($liqDist->periodo_desde?->toDateString() ?? (string) $liqDist->periodo_desde);
        $hasta = $this->safeDate($liqDist->periodo_hasta?->toDateString() ?? (string) $liqDist->periodo_hasta);

        $ops = $operaciones
            ->map(function (LiqOperacion $op) {
                $raw = is_array($op->campos_originales) ? $op->campos_originales : [];

                $idViaje = $this->pick($raw, ['IdViaje', 'idViaje', 'id_viaje', 'viaje_id', 'Id viaje']);
                $fecha = $this->pick($raw, ['FechaViaje', 'fechaViaje', 'fecha_viaje', 'Fecha', 'fecha']);
                $origen = $this->pick($raw, ['Origen', 'origen']);
                $destino = $this->pick($raw, ['Destino', 'destino']);

                return [
                    'id' => (int) $op->id,
                    'idViaje' => $idViaje !== null ? (string) $idViaje : null,
                    'fecha' => $this->formatDate($fecha),
                    'origen' => $origen !== null ? (string) $origen : null,
                    'destino' => $destino !== null ? (string) $destino : null,
                    'concepto' => $op->concepto,
                    'importe' => $op->valor_tarifa_distribuidor !== null ? (float) $op->valor_tarifa_distribuidor : null,
                ];
            })
            ->sortBy(function (array $row) {
                return ($row['fecha'] ?? '') . '|' . ($row['idViaje'] ?? '') . '|' . (string) ($row['id'] ?? 0);
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
                'id' => (int) $liqDist->id,
                'liquidacion_cliente_id' => (int) $liqDist->liquidacion_cliente_id,
                'periodo_desde' => $desde,
                'periodo_hasta' => $hasta,
                'fecha_generacion' => $liqDist->fecha_generacion ? $liqDist->fecha_generacion->timezone(config('app.timezone', 'UTC'))->format('d/m/Y H:i') : null,
                'cantidad_operaciones' => (int) $liqDist->cantidad_operaciones,
                'subtotal' => (float) $liqDist->subtotal,
                'gastos' => (float) $liqDist->gastos_administrativos,
                'total' => (float) $liqDist->total_a_pagar,
            ],
            'operaciones' => $ops,
        ])->render();

        $options = new Options();
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('isRemoteEnabled', false);
        $options->set('isHtml5ParserEnabled', true);

        $dompdf = new Dompdf($options);
        $dompdf->setPaper('A4', 'portrait');
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


<?php

namespace App\Services\Liq;

use App\Models\LiqOrdenPago;
use Dompdf\Dompdf;
use Dompdf\Options;

class OrdenPagoPdfService
{
    /**
     * Genera el contenido PDF (string binario) de una Orden de Pago.
     */
    public function renderPdf(LiqOrdenPago $op): string
    {
        $op->loadMissing(['concepto', 'detalles', 'usuario:id,name']);

        $detallesOrdenados = $op->detalles
            ->sortBy(['cliente_nombre', 'sucursal', 'distribuidor_nombre'])
            ->values();

        $logoDataUri = $this->loadLogoDataUri();

        $html = view('liq.orden_pago', [
            'logoDataUri' => $logoDataUri,
            'empresa' => [
                'razon_social' => 'LOGISTICA ARGENTINA SRL',
            ],
            'op' => [
                'numero_display'        => $op->numero_display,
                'fecha_emision'         => $op->fecha_emision?->format('d/m/Y'),
                'concepto'              => $op->concepto?->nombre,
                'anio'                  => $op->anio,
                'mes'                   => $op->mes,
                'estado'                => $op->estado,
                'cantidad_liquidaciones' => $detallesOrdenados->count(),
                'subtotal'              => (float) $op->subtotal,
                'total_descuentos'      => (float) $op->total_descuentos,
                'total_a_pagar'         => (float) $op->total_a_pagar,
                'observaciones'         => $op->observaciones,
            ],
            'beneficiario' => [
                'tipo'   => $op->beneficiario_tipo,
                'nombre' => $op->beneficiario_nombre,
                'cuil'   => $op->beneficiario_cuil,
                'cbu'    => $op->beneficiario_cbu,
            ],
            'detalles' => $detallesOrdenados->map(fn ($d) => [
                'cliente_nombre'        => $d->cliente_nombre,
                'sucursal'              => $d->sucursal,
                'periodo'               => $d->periodo,
                'distribuidor_nombre'   => $d->distribuidor_nombre,
                'cobrador_nombre'       => $d->cobrador_nombre,
                'subtotal_liquidacion'  => (float) $d->subtotal_liquidacion,
                'gastos_admin'          => (float) $d->gastos_admin,
                'descuento_combustible' => (float) $d->descuento_combustible,
                'descuento_paquete'     => (float) $d->descuento_paquete,
                'descuento_ajuste'      => (float) $d->descuento_ajuste,
                'otros_descuentos'      => (float) $d->otros_descuentos,
                'importe_final'         => (float) $d->importe_final,
            ])->all(),
        ])->render();

        $options = new Options();
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('isRemoteEnabled', false);
        $options->set('isHtml5ParserEnabled', true);

        $dompdf = new Dompdf($options);
        $dompdf->setPaper('A4', 'landscape');
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->render();

        return $dompdf->output();
    }

    private function loadLogoDataUri(): ?string
    {
        $path = public_path('logo-empresa.png');
        if (!is_string($path) || !file_exists($path)) {
            return null;
        }

        $bin = file_get_contents($path);
        if ($bin === false || $bin === '') {
            return null;
        }

        return 'data:image/png;base64,' . base64_encode($bin);
    }
}

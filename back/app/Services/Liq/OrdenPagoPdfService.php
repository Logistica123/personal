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
        $op->loadMissing([
            'concepto',
            'detalles.liquidacionDistribuidor:id,tipo_comprobante,importe_iva,iva_porcentaje,total_a_pagar_overridido',
            'detalles.archivo:id,tipo_comprobante,importe_iva,iva_porcentaje,importe_facturar_overridido',
            'usuario:id,name',
        ]);

        $detallesOrdenados = $op->detalles
            ->sortBy(['cliente_nombre', 'sucursal', 'distribuidor_nombre'])
            ->values();

        $logoDataUri = $this->loadLogoDataUri();

        // OP global vs individual: contamos beneficiarios efectivos (por cobrador o distrib)
        // distintos. Si solo hay 1, mantenemos el bloque "Beneficiario" en el header. Si hay
        // varios, lo ocultamos y usamos layout de OP global.
        $cantidadBeneficiariosDistintos = $detallesOrdenados
            ->map(fn ($d) => $d->cobrador_nombre ?: $d->distribuidor_nombre)
            ->filter()
            ->unique()
            ->count();
        $esOpGlobal = $cantidadBeneficiariosDistintos > 1;

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
                'cantidad_beneficiarios_distintos' => $cantidadBeneficiariosDistintos,
                'es_global'             => $esOpGlobal,
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
            'detalles' => $detallesOrdenados->map(function ($d) {
                // Cruzo el detalle con la fuente para traer IVA / Factura A flag / override flag.
                $fuente = $d->liquidacionDistribuidor ?? $d->archivo;
                $tipoCbte = $fuente?->tipo_comprobante ?? 'C';
                $importeIva = (float) ($fuente?->importe_iva ?? 0);
                $ivaPct = $fuente?->iva_porcentaje !== null ? (float) $fuente->iva_porcentaje : null;
                $importeOverridido = $d->liquidacionDistribuidor
                    ? (bool) ($d->liquidacionDistribuidor->total_a_pagar_overridido ?? false)
                    : (bool) ($d->archivo->importe_facturar_overridido ?? false);

                // Observaciones: si hay cobrador real / override, mostrar "COBRA X" en mayuscula.
                $observaciones = $d->cobrador_nombre
                    ? 'COBRA ' . mb_strtoupper($d->cobrador_nombre)
                    : '';

                return [
                    'cliente_nombre'        => $d->cliente_nombre,
                    'sucursal'              => $d->sucursal,
                    'periodo'               => $d->periodo,
                    'distribuidor_nombre'   => $d->distribuidor_nombre,
                    'cobrador_nombre'       => $d->cobrador_nombre,
                    'forma_pago'            => $d->medio_pago ?: 'TRANSFERENCIA',
                    'subtotal_liquidacion'  => (float) $d->subtotal_liquidacion,
                    'gastos_admin'          => (float) $d->gastos_admin,
                    'descuento_combustible' => (float) $d->descuento_combustible,
                    'descuento_paquete'     => (float) $d->descuento_paquete,
                    'descuento_ajuste'      => (float) $d->descuento_ajuste,
                    'otros_descuentos'      => (float) $d->otros_descuentos,
                    'iva_2da_factura'       => $tipoCbte === 'A' ? $importeIva : 0.0,
                    'iva_porcentaje'        => $ivaPct,
                    'tipo_comprobante'      => $tipoCbte,
                    'importe_overridido'    => $importeOverridido,
                    'importe_final'         => (float) $d->importe_final,
                    'observaciones'         => $observaciones,
                ];
            })->all(),
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

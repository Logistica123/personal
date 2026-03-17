<?php

namespace App\Services\Facturacion;

use App\Models\FacturaCabecera;
use App\Services\Facturacion\Exceptions\FacturaValidationException;
use App\Support\Facturacion\PeriodoFacturado;

class FacturaValidator
{
    private const CBTE_TIPOS_REQUIEREN_ASOCIACION = [
        2, 3, 7, 8, 12, 13, // ND/NC A/B/C
        20, 21, // ND/NC exterior
        202, 203, 207, 208, 212, 213, // ND/NC FCE A/B/C
    ];

    public function validateOrFail(FacturaCabecera $factura): void
    {
        $errors = $this->validate($factura);
        if ($errors !== []) {
            throw new FacturaValidationException($errors);
        }
    }

    /**
     * @return array<string,list<string>>
     */
    public function validate(FacturaCabecera $factura): array
    {
        $factura->loadMissing(['ivaItems', 'detallePdf', 'tributos', 'cbtesAsoc']);
        $errors = [];

        $required = [
            'emisor_id' => $factura->emisor_id,
            'ambiente' => $factura->ambiente?->value ?? $factura->ambiente,
            'pto_vta' => $factura->pto_vta,
            'cbte_tipo' => $factura->cbte_tipo,
            'concepto' => $factura->concepto,
            'doc_tipo' => $factura->doc_tipo,
            'doc_nro' => $factura->doc_nro,
            'cliente_id' => $factura->cliente_id,
            'sucursal_id' => $factura->sucursal_id,
            'anio_facturado' => $factura->anio_facturado,
            'mes_facturado' => $factura->mes_facturado,
            'periodo_facturado' => $factura->periodo_facturado?->value ?? $factura->periodo_facturado,
            'moneda_id' => $factura->moneda_id,
            'moneda_cotiz' => $factura->moneda_cotiz,
            'imp_total' => $factura->imp_total,
            'fecha_aprox_cobro' => $factura->fecha_aprox_cobro,
        ];

        foreach ($required as $field => $value) {
            if ($value === null || $value === '' || $value === 0 || $value === '0') {
                $errors[$field][] = 'El campo es obligatorio.';
            }
        }

        if (! in_array(($factura->periodo_facturado?->value ?? $factura->periodo_facturado), array_column(PeriodoFacturado::cases(), 'value'), true)) {
            $errors['periodo_facturado'][] = 'El período facturado no es válido.';
        }

        if (in_array((int) $factura->concepto, [2, 3], true)) {
            if (! $factura->fecha_serv_desde) {
                $errors['fecha_serv_desde'][] = 'Debe informar fecha desde para servicios.';
            }
            if (! $factura->fecha_serv_hasta) {
                $errors['fecha_serv_hasta'][] = 'Debe informar fecha hasta para servicios.';
            }
            if (! $factura->fecha_vto_pago) {
                $errors['fecha_vto_pago'][] = 'Debe informar fecha de vencimiento de pago para servicios.';
            }
        }

        if ($factura->fecha_pago_manual && $factura->fecha_aprox_cobro) {
            if ($factura->fecha_pago_manual->lt($factura->fecha_aprox_cobro)) {
                $errors['fecha_pago_manual'][] = 'La fecha de pago manual debe ser posterior o igual a la fecha aproximada de cobro.';
            }
        }

        $expectedTotal = round(
            (float) $factura->imp_tot_conc
            + (float) $factura->imp_neto
            + (float) $factura->imp_op_ex
            + (float) $factura->imp_iva
            + (float) $factura->imp_trib,
            2
        );

        if (round((float) $factura->imp_total, 2) !== $expectedTotal) {
            $errors['imp_total'][] = 'La suma de importes fiscales no coincide con el total.';
        }

        $ivaSum = round((float) $factura->ivaItems->sum(fn ($item) => (float) $item->importe), 2);
        if ($factura->ivaItems->isNotEmpty() && round((float) $factura->imp_iva, 2) !== $ivaSum) {
            $errors['imp_iva'][] = 'La sumatoria de IVA detalle no coincide con el importe IVA de cabecera.';
        }

        $detalleSum = round((float) $factura->detallePdf->sum(fn ($item) => (float) $item->subtotal_con_iva), 2);
        if ($factura->detallePdf->isNotEmpty()) {
            $totalSinTributos = round((float) $factura->imp_total - (float) $factura->imp_trib, 2);
            $diff = abs($totalSinTributos - $detalleSum);
            if ($diff > 0.01) {
                $errors['imp_total'][] = 'El total de cabecera (sin tributos) no coincide con la sumatoria del detalle.';
            }
        }

        if ($factura->detallePdf->isEmpty()) {
            $errors['detalle_pdf'][] = 'La factura debe tener al menos un renglón para el PDF.';
        }

        $cbteTipo = (int) ($factura->cbte_tipo ?? 0);
        if (in_array($cbteTipo, self::CBTE_TIPOS_REQUIEREN_ASOCIACION, true) && $factura->cbtesAsoc->isEmpty()) {
            $errors['cbtes_asoc'][] = 'Debe asociar al menos un comprobante para emitir notas de crédito/débito.';
        }

        return $errors;
    }
}

<?php

namespace App\Services\Arca\Wsfe;

use App\Models\FacturaCabecera;

class WsfeRequestBuilder
{
    /**
     * @return array<string,mixed>
     */
    public function buildCaeRequest(FacturaCabecera $factura, int $cbteNumero): array
    {
        $factura->loadMissing(['ivaItems', 'tributos', 'cbtesAsoc']);

        return [
            'FeCAEReq' => [
                'FeCabReq' => [
                    'CantReg' => 1,
                    'PtoVta' => (int) $factura->pto_vta,
                    'CbteTipo' => (int) $factura->cbte_tipo,
                ],
                'FeDetReq' => [
                    'FECAEDetRequest' => [[
                        'Concepto' => (int) $factura->concepto,
                        'DocTipo' => (int) $factura->doc_tipo,
                        'DocNro' => (float) $factura->doc_nro,
                        'CbteDesde' => $cbteNumero,
                        'CbteHasta' => $cbteNumero,
                        'CbteFch' => $factura->fecha_cbte?->format('Ymd'),
                        'ImpTotal' => (float) $factura->imp_total,
                        'ImpTotConc' => (float) $factura->imp_tot_conc,
                        'ImpNeto' => (float) $factura->imp_neto,
                        'ImpOpEx' => (float) $factura->imp_op_ex,
                        'ImpIVA' => (float) $factura->imp_iva,
                        'ImpTrib' => (float) $factura->imp_trib,
                        'MonId' => (string) $factura->moneda_id,
                        'MonCotiz' => (float) $factura->moneda_cotiz,
                        'FchServDesde' => $factura->fecha_serv_desde?->format('Ymd'),
                        'FchServHasta' => $factura->fecha_serv_hasta?->format('Ymd'),
                        'FchVtoPago' => $factura->fecha_vto_pago?->format('Ymd'),
                        'CbtesAsoc' => $factura->cbtesAsoc->isEmpty() ? null : [
                            'CbteAsoc' => $factura->cbtesAsoc
                                ->map(fn ($item) => [
                                    'Tipo' => (int) $item->cbte_tipo,
                                    'PtoVta' => (int) $item->pto_vta,
                                    'Nro' => (int) $item->cbte_numero,
                                ])
                                ->values()
                                ->all(),
                        ],
                        'Iva' => $factura->ivaItems->isEmpty() ? null : [
                            'AlicIva' => $factura->ivaItems
                                ->map(fn ($item) => [
                                    'Id' => (int) $item->iva_id,
                                    'BaseImp' => (float) $item->base_imp,
                                    'Importe' => (float) $item->importe,
                                ])
                                ->values()
                                ->all(),
                        ],
                        'Tributos' => $factura->tributos->isEmpty() ? null : [
                            'Tributo' => $factura->tributos
                                ->map(fn ($item) => [
                                    'Id' => (int) $item->tributo_id,
                                    'Desc' => (string) ($item->descr ?? ''),
                                    'BaseImp' => (float) ($item->base_imp ?? 0),
                                    'Alic' => (float) ($item->alic ?? 0),
                                    'Importe' => (float) $item->importe,
                                ])
                                ->values()
                                ->all(),
                        ],
                    ]],
                ],
            ],
        ];
    }
}

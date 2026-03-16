<?php

namespace App\Services\Facturacion;

use App\Models\FacturaCabecera;
use Illuminate\Support\Facades\DB;

class FacturaDraftService
{
    public function __construct(
        private readonly FacturaIdempotencyService $idempotencyService,
        private readonly CobranzaStateResolver $cobranzaStateResolver,
    ) {
    }

    public function createDraft(array $payload): FacturaCabecera
    {
        return DB::transaction(function () use ($payload) {
            $factura = new FacturaCabecera();
            $this->fillFactura($factura, $payload, true);
            $factura->save();
            $this->syncChildren($factura, $payload);
            $factura->refresh()->load(['ivaItems', 'tributos', 'detallePdf']);

            return $factura;
        });
    }

    public function updateDraft(FacturaCabecera $factura, array $payload): FacturaCabecera
    {
        if (! $factura->canEditFiscalFields()) {
            throw new \RuntimeException('La factura autorizada no permite edición fiscal.');
        }

        return DB::transaction(function () use ($factura, $payload) {
            $beforeCbteNumero = $factura->cbte_numero;
            $this->fillFactura($factura, $payload, false);
            if ($beforeCbteNumero !== null) {
                $factura->cbte_numero = $beforeCbteNumero;
            }
            $factura->save();
            $this->syncChildren($factura, $payload);
            $factura->refresh()->load(['ivaItems', 'tributos', 'detallePdf']);

            return $factura;
        });
    }

    private function fillFactura(FacturaCabecera $factura, array $payload, bool $isNew): void
    {
        $factura->fill([
            'emisor_id' => $payload['emisor_id'] ?? $factura->emisor_id,
            'ambiente' => $payload['ambiente'] ?? $factura->ambiente,
            'pto_vta' => $payload['pto_vta'] ?? $factura->pto_vta,
            'cbte_tipo' => $payload['cbte_tipo'] ?? $factura->cbte_tipo,
            'concepto' => $payload['concepto'] ?? $factura->concepto,
            'doc_tipo' => $payload['doc_tipo'] ?? $factura->doc_tipo,
            'doc_nro' => $payload['doc_nro'] ?? $factura->doc_nro,
            'cliente_id' => $payload['cliente_id'] ?? $factura->cliente_id,
            'sucursal_id' => $payload['sucursal_id'] ?? $factura->sucursal_id,
            'cliente_nombre' => $payload['cliente_nombre'] ?? $factura->cliente_nombre,
            'cliente_domicilio' => $payload['cliente_domicilio'] ?? $factura->cliente_domicilio,
            'fecha_cbte' => $payload['fecha_cbte'] ?? $factura->fecha_cbte,
            'fecha_serv_desde' => $payload['fecha_serv_desde'] ?? $factura->fecha_serv_desde,
            'fecha_serv_hasta' => $payload['fecha_serv_hasta'] ?? $factura->fecha_serv_hasta,
            'fecha_vto_pago' => $payload['fecha_vto_pago'] ?? $factura->fecha_vto_pago,
            'condiciones_venta' => $payload['condiciones_venta'] ?? $factura->condiciones_venta,
            'moneda_id' => $payload['moneda_id'] ?? $factura->moneda_id,
            'moneda_cotiz' => $payload['moneda_cotiz'] ?? $factura->moneda_cotiz,
            'imp_total' => $payload['imp_total'] ?? $factura->imp_total,
            'imp_tot_conc' => $payload['imp_tot_conc'] ?? $factura->imp_tot_conc,
            'imp_neto' => $payload['imp_neto'] ?? $factura->imp_neto,
            'imp_op_ex' => $payload['imp_op_ex'] ?? $factura->imp_op_ex,
            'imp_iva' => $payload['imp_iva'] ?? $factura->imp_iva,
            'imp_trib' => $payload['imp_trib'] ?? $factura->imp_trib,
            'anio_facturado' => $payload['anio_facturado'] ?? $factura->anio_facturado,
            'mes_facturado' => $payload['mes_facturado'] ?? $factura->mes_facturado,
            'periodo_facturado' => $payload['periodo_facturado'] ?? $factura->periodo_facturado,
            'fecha_aprox_cobro' => $payload['fecha_aprox_cobro'] ?? $factura->fecha_aprox_cobro,
            'fecha_pago_manual' => $payload['fecha_pago_manual'] ?? $factura->fecha_pago_manual,
            'monto_pagado_manual' => $payload['monto_pagado_manual'] ?? $factura->monto_pagado_manual,
            'observaciones_cobranza' => $payload['observaciones_cobranza'] ?? $factura->observaciones_cobranza,
        ]);

        $factura->hash_idempotencia = $this->idempotencyService->buildHashFromPayload($factura->getAttributes());
        $factura->estado_cobranza = $this->cobranzaStateResolver->resolve($factura);

        if ($isNew || ! $factura->estado) {
            $factura->estado = 'BORRADOR';
        }
    }

    private function syncChildren(FacturaCabecera $factura, array $payload): void
    {
        $factura->ivaItems()->delete();
        $factura->tributos()->delete();
        $factura->detallePdf()->delete();

        foreach ($this->resolveIvaItems($factura, $payload) as $item) {
            $factura->ivaItems()->create([
                'iva_id' => $item['iva_id'],
                'base_imp' => $item['base_imp'],
                'importe' => $item['importe'],
            ]);
        }

        foreach (($payload['tributos'] ?? []) as $item) {
            $factura->tributos()->create([
                'tributo_id' => $item['tributo_id'],
                'descr' => $item['descr'] ?? null,
                'base_imp' => $item['base_imp'] ?? null,
                'alic' => $item['alic'] ?? null,
                'importe' => $item['importe'],
            ]);
        }

        foreach (($payload['detalle_pdf'] ?? []) as $item) {
            $factura->detallePdf()->create([
                'orden' => $item['orden'],
                'descripcion' => $item['descripcion'],
                'cantidad' => $item['cantidad'],
                'unidad_medida' => $item['unidad_medida'] ?? null,
                'precio_unitario' => $item['precio_unitario'],
                'bonificacion_pct' => $item['bonificacion_pct'] ?? 0,
                'subtotal' => $item['subtotal'],
                'alicuota_iva_pct' => $item['alicuota_iva_pct'] ?? 0,
                'subtotal_con_iva' => $item['subtotal_con_iva'],
            ]);
        }
    }

    /**
     * @return array<int,array{iva_id:int,base_imp:float,importe:float}>
     */
    private function resolveIvaItems(FacturaCabecera $factura, array $payload): array
    {
        $ivaItems = $payload['iva'] ?? [];
        if (! is_array($ivaItems)) {
            $ivaItems = [];
        }

        $cbteTipo = (int) ($payload['cbte_tipo'] ?? $factura->cbte_tipo ?? 0);
        $impIva = (float) ($payload['imp_iva'] ?? $factura->imp_iva ?? 0);

        if ($cbteTipo === 1 && $impIva > 0 && count($ivaItems) === 0) {
            $impNeto = (float) ($payload['imp_neto'] ?? $factura->imp_neto ?? 0);
            $ivaItems[] = [
                'iva_id' => $this->resolveDefaultIvaId($impNeto, $impIva),
                'base_imp' => round($impNeto, 2),
                'importe' => round($impIva, 2),
            ];
        }

        return array_map(
            fn (array $item) => [
                'iva_id' => (int) $item['iva_id'],
                'base_imp' => (float) $item['base_imp'],
                'importe' => (float) $item['importe'],
            ],
            $ivaItems
        );
    }

    private function resolveDefaultIvaId(float $baseImp, float $importe): int
    {
        $candidates = [
            ['id' => 5, 'rate' => 21.0],
            ['id' => 4, 'rate' => 10.5],
            ['id' => 6, 'rate' => 27.0],
            ['id' => 3, 'rate' => 5.0],
            ['id' => 2, 'rate' => 2.5],
            ['id' => 1, 'rate' => 0.0],
        ];

        if ($baseImp <= 0 || $importe <= 0) {
            return 5;
        }

        $rate = ($importe / $baseImp) * 100;
        $closest = $candidates[0];
        $bestDiff = abs($rate - $closest['rate']);

        foreach ($candidates as $candidate) {
            $diff = abs($rate - $candidate['rate']);
            if ($diff < $bestDiff) {
                $bestDiff = $diff;
                $closest = $candidate;
            }
        }

        return (int) $closest['id'];
    }
}

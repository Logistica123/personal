<?php

namespace App\Services\Facturacion;

use App\Models\FacturaCabecera;

class FacturaIdempotencyService
{
    public function buildHashFromPayload(array $payload): string
    {
        $cbtesAsoc = $payload['cbtes_asoc'] ?? [];
        if (! is_array($cbtesAsoc)) {
            $cbtesAsoc = [];
        }
        $normalizedCbtesAsoc = array_values(array_filter(array_map(function ($item) {
            if (! is_array($item)) {
                return null;
            }
            $tipo = (int) ($item['cbte_tipo'] ?? 0);
            $ptoVta = (int) ($item['pto_vta'] ?? 0);
            $nro = preg_replace('/\D+/', '', (string) ($item['cbte_numero'] ?? ''));
            if ($tipo <= 0 || $ptoVta <= 0 || $nro === '') {
                return null;
            }
            return sprintf('%d-%d-%s', $tipo, $ptoVta, $nro);
        }, $cbtesAsoc)));
        sort($normalizedCbtesAsoc);

        $canonical = [
            'emisor_id' => (int) ($payload['emisor_id'] ?? 0),
            'ambiente' => strtoupper(trim((string) ($payload['ambiente'] ?? ''))),
            'pto_vta' => (int) ($payload['pto_vta'] ?? 0),
            'cbte_tipo' => (int) ($payload['cbte_tipo'] ?? 0),
            'concepto' => (int) ($payload['concepto'] ?? 0),
            'doc_tipo' => (int) ($payload['doc_tipo'] ?? 0),
            'doc_nro' => preg_replace('/\D+/', '', (string) ($payload['doc_nro'] ?? '')),
            'fecha_cbte' => (string) ($payload['fecha_cbte'] ?? ''),
            'imp_total' => $this->normalizeDecimal($payload['imp_total'] ?? 0),
            'imp_neto' => $this->normalizeDecimal($payload['imp_neto'] ?? 0),
            'imp_iva' => $this->normalizeDecimal($payload['imp_iva'] ?? 0),
            'cliente_id' => (int) ($payload['cliente_id'] ?? 0),
            'sucursal_id' => (int) ($payload['sucursal_id'] ?? 0),
            'anio_facturado' => (int) ($payload['anio_facturado'] ?? 0),
            'mes_facturado' => (int) ($payload['mes_facturado'] ?? 0),
            'periodo_facturado' => strtoupper(trim((string) ($payload['periodo_facturado'] ?? ''))),
            'cbtes_asoc' => $normalizedCbtesAsoc,
        ];

        return hash('sha256', json_encode($canonical, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    public function buildHashForFactura(FacturaCabecera $factura): string
    {
        $factura->loadMissing(['cbtesAsoc']);
        $payload = $factura->getAttributes();
        $payload['cbtes_asoc'] = $factura->cbtesAsoc
            ->map(fn ($item) => [
                'cbte_tipo' => $item->cbte_tipo,
                'pto_vta' => $item->pto_vta,
                'cbte_numero' => $item->cbte_numero,
            ])
            ->values()
            ->all();

        return $this->buildHashFromPayload($payload);
    }

    private function normalizeDecimal(mixed $value): string
    {
        return number_format((float) $value, 2, '.', '');
    }
}

<?php

namespace App\Services\Facturacion;

use App\Models\FacturaCabecera;

class FacturaIdempotencyService
{
    public function buildHashFromPayload(array $payload): string
    {
        $canonical = [
            'emisor_id' => (int) ($payload['emisor_id'] ?? 0),
            'ambiente' => strtoupper(trim((string) ($payload['ambiente'] ?? ''))),
            'pto_vta' => (int) ($payload['pto_vta'] ?? 0),
            'cbte_tipo' => (int) ($payload['cbte_tipo'] ?? 0),
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
        ];

        return hash('sha256', json_encode($canonical, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    public function buildHashForFactura(FacturaCabecera $factura): string
    {
        return $this->buildHashFromPayload($factura->getAttributes());
    }

    private function normalizeDecimal(mixed $value): string
    {
        return number_format((float) $value, 2, '.', '');
    }
}

<?php

namespace App\Services\Arca\Wsfe;

use App\Models\ArcaCertificado;
use App\Models\FacturaCabecera;
use App\Services\Arca\Exceptions\WsfeException;
use App\Services\Arca\Wsaa\WsaaToken;

class InvoiceNumberResolver
{
    public function __construct(private readonly WsfeClient $wsfeClient)
    {
    }

    public function resolveNextNumber(FacturaCabecera $factura, ArcaCertificado $certificado, ?WsaaToken $token = null): int
    {
        $response = $this->wsfeClient->compUltimoAutorizado(
            $certificado,
            (int) $factura->pto_vta,
            (int) $factura->cbte_tipo,
            $token
        );

        $errors = $response['errors'] ?? [];
        if (! empty($errors)) {
            throw new WsfeException('ARCA devolvió errores al consultar el último autorizado.');
        }

        return max(1, ((int) ($response['cbte_nro'] ?? 0)) + 1);
    }
}

<?php

namespace App\Repositories\Facturacion;

use App\Models\FacturaCabecera;
use Illuminate\Database\Eloquent\Builder;

class FacturaCabeceraRepository
{
    public function query(): Builder
    {
        return FacturaCabecera::query();
    }

    public function findAuthorizedByHash(string $hash): ?FacturaCabecera
    {
        return FacturaCabecera::query()
            ->where('hash_idempotencia', $hash)
            ->whereIn('estado', ['AUTORIZADA', 'PDF_GENERADO'])
            ->first();
    }

    public function findByIdWithRelations(int $id): ?FacturaCabecera
    {
        return FacturaCabecera::query()
            ->with(['emisor', 'certificado', 'cliente', 'sucursal', 'ivaItems', 'tributos', 'detallePdf', 'historialCobranza.usuario'])
            ->find($id);
    }
}

<?php

namespace App\Services\Facturacion;

use App\Models\FacturaCabecera;
use Illuminate\Support\Facades\Storage;

class FacturaXmlStorageService
{
    /**
     * @return array{request:string,response:string}
     */
    public function store(FacturaCabecera $factura, string $requestXml, string $responseXml): array
    {
        $basePath = sprintf('arca/xml/factura-%d', $factura->id);
        $timestamp = now()->format('YmdHis');

        $requestPath = sprintf('%s/request-%s.xml', $basePath, $timestamp);
        $responsePath = sprintf('%s/response-%s.xml', $basePath, $timestamp);

        Storage::disk((string) config('services.arca.storage_disk', 'local'))->put($requestPath, $requestXml);
        Storage::disk((string) config('services.arca.storage_disk', 'local'))->put($responsePath, $responseXml);

        return [
            'request' => $requestPath,
            'response' => $responsePath,
        ];
    }
}

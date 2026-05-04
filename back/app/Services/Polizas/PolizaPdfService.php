<?php

namespace App\Services\Polizas;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Cliente al microservicio Python `POST /api/polizas/parse-pdf`.
 *
 * Reusa la misma config `services.oca.base_url` que el procesador OCASA porque
 * ambos endpoints corren en el mismo proceso FastAPI.
 */
class PolizaPdfService
{
    private function baseUrl(): string
    {
        return rtrim((string) config('services.oca.base_url', 'http://localhost:8100'), '/');
    }

    /**
     * Envía un PDF al parser y devuelve el JSON con aseguradora, póliza, endoso y asegurados.
     *
     * @return array{aseguradora_detectada:?string, tipo_documento:?string, poliza:array, endoso:?array, asegurados:array, warnings:array}
     */
    public function parse(UploadedFile $file): array
    {
        $response = Http::timeout(60)
            ->attach('file', fopen($file->getRealPath(), 'r'), $file->getClientOriginalName() ?: 'poliza.pdf')
            ->post($this->baseUrl() . '/api/polizas/parse-pdf');

        if (!$response->ok()) {
            throw new RuntimeException('Microservicio Python: ' . $response->status() . ' ' . $response->body());
        }

        $data = $response->json();
        if (!is_array($data)) {
            throw new RuntimeException('Respuesta inválida del parser');
        }

        return [
            'aseguradora_detectada' => $data['aseguradora_detectada'] ?? null,
            'tipo_documento'        => $data['tipo_documento']        ?? null,
            'poliza'                => $data['poliza']                ?? [],
            'endoso'                => $data['endoso']                ?? null,
            'asegurados'            => $data['asegurados']            ?? [],
            'warnings'              => $data['warnings']              ?? [],
        ];
    }
}

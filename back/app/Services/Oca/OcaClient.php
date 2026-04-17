<?php

namespace App\Services\Oca;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Cliente HTTP para el microservicio Python de procesamiento OCA.
 */
class OcaClient
{
    private function baseUrl(): string
    {
        return rtrim((string) config('services.oca.base_url', 'http://localhost:8100'), '/');
    }

    public function isAvailable(): bool
    {
        try {
            $response = Http::timeout(5)->get($this->baseUrl() . '/health');
            return $response->ok() && ($response->json('status') === 'ok');
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Procesa PDFs OCA subidos y devuelve el resultado de vinculación.
     *
     * @param string $sucursal Código de sucursal (ej: GUILLON, PQO, TUC)
     * @param UploadedFile $mainPdf PDF principal de la sucursal
     * @param UploadedFile[] $distribPdfs PDFs de distribuidores
     * @return array Resultado de vinculación del motor Python
     */
    public function procesar(string $sucursal, UploadedFile $mainPdf, array $distribPdfs): array
    {
        $request = Http::timeout(120)
            ->attach('main_pdf', fopen($mainPdf->getRealPath(), 'r'), $mainPdf->getClientOriginalName());

        foreach ($distribPdfs as $pdf) {
            $request = $request->attach('distrib_pdfs', fopen($pdf->getRealPath(), 'r'), $pdf->getClientOriginalName());
        }

        $response = $request->post($this->baseUrl() . '/api/oca/procesar', [
            'sucursal' => $sucursal,
        ]);

        if (! $response->ok()) {
            throw new RuntimeException(
                'Error del servicio OCA: ' . ($response->json('detail') ?? $response->body())
            );
        }

        $data = $response->json();
        if (! ($data['success'] ?? false)) {
            throw new RuntimeException('Error OCA: ' . ($data['mensaje'] ?? 'Error desconocido'));
        }

        // BUGFIX 19: incluir warnings (codigos_nuevos) junto al resultado
        $resultado = $data['resultado'] ?? [];
        if (isset($data['warnings'])) {
            $resultado['_warnings'] = $data['warnings'];
        }

        return $resultado;
    }

    /**
     * Procesa PDFs OCA con modo OCR (para PDFs escaneados/imagen).
     */
    public function procesarOcr(string $sucursal, UploadedFile $mainPdf, array $distribPdfs): array
    {
        $request = Http::timeout(180)
            ->attach('main_pdf', fopen($mainPdf->getRealPath(), 'r'), $mainPdf->getClientOriginalName());

        foreach ($distribPdfs as $pdf) {
            $request = $request->attach('distrib_pdfs', fopen($pdf->getRealPath(), 'r'), $pdf->getClientOriginalName());
        }

        $response = $request->post($this->baseUrl() . '/api/oca/procesar', [
            'sucursal' => $sucursal,
            'modo' => 'ocr',
        ]);

        if (! $response->ok()) {
            throw new RuntimeException(
                'Error del servicio OCA (OCR): ' . ($response->json('detail') ?? $response->body())
            );
        }

        $data = $response->json();
        if (! ($data['success'] ?? false)) {
            throw new RuntimeException('Error OCA OCR: ' . ($data['mensaje'] ?? 'Error desconocido'));
        }

        return $data['resultado'] ?? [];
    }

    /**
     * Parsea solo el PDF principal (debug).
     */
    public function parsearPrincipal(UploadedFile $pdf): array
    {
        $response = Http::timeout(60)
            ->attach('pdf', fopen($pdf->getRealPath(), 'r'), $pdf->getClientOriginalName())
            ->post($this->baseUrl() . '/api/oca/parsear-principal');

        if (! $response->ok()) {
            throw new RuntimeException('Error parseando PDF principal: ' . $response->body());
        }

        return $response->json();
    }

    /**
     * Parsea PDFs de distribuidores (debug).
     */
    public function parsearDistribuidores(string $sucursal, array $pdfs): array
    {
        $request = Http::timeout(60);

        foreach ($pdfs as $pdf) {
            $request = $request->attach('pdfs', fopen($pdf->getRealPath(), 'r'), $pdf->getClientOriginalName());
        }

        $response = $request->post($this->baseUrl() . '/api/oca/parsear-distribuidores', [
            'sucursal' => $sucursal,
        ]);

        if (! $response->ok()) {
            throw new RuntimeException('Error parseando distribuidores: ' . $response->body());
        }

        return $response->json();
    }
}

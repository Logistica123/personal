<?php

namespace App\Services\FacturaAi;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class OpenAiFacturaParser
{
    public function parse(string $text): array
    {
        $apiKey = config('services.openai.key');
        if (! $apiKey) {
            throw new RuntimeException('OPENAI_API_KEY no configurada.');
        }

        $model = config('services.openai.model', 'gpt-4o-mini');
        $payload = [
            'model' => $model,
            'temperature' => 0,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Sos un extractor de datos de facturas. Devolv\u00e9 solo JSON valido con estas claves: razon_social, cuit, numero_factura, fecha_emision, tipo_factura, importe_total, iva, concepto, cbu, liquidacion_id. Si no esta, usa null.',
                ],
                [
                    'role' => 'user',
                    'content' => "Texto de la factura:\n".$text,
                ],
            ],
        ];

        $response = Http::withToken($apiKey)
            ->acceptJson()
            ->post('https://api.openai.com/v1/chat/completions', $payload);

        if (! $response->successful()) {
            throw new RuntimeException('Error al consultar OpenAI: '.$response->status());
        }

        $content = $response->json('choices.0.message.content');
        if (! is_string($content) || trim($content) === '') {
            throw new RuntimeException('Respuesta vacia de OpenAI.');
        }

        $json = $this->extractJson($content);
        $decoded = json_decode($json, true);

        if (! is_array($decoded)) {
            throw new RuntimeException('No se pudo parsear JSON de OpenAI.');
        }

        return $decoded;
    }

    private function extractJson(string $content): string
    {
        $trimmed = trim($content);
        if ($trimmed === '') {
            return '{}';
        }

        if (str_starts_with($trimmed, '{') && str_ends_with($trimmed, '}')) {
            return $trimmed;
        }

        if (preg_match('/\{.*\}/s', $trimmed, $matches)) {
            return $matches[0];
        }

        return '{}';
    }
}

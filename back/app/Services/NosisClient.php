<?php

namespace App\Services;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class NosisClient
{
    public function validateCbu(string $documento, string $cbu, ?int $grupoVid = null): array
    {
        $baseUrl = config('nosis.base_url');
        $username = config('nosis.username');
        $token = config('nosis.token');
        $groupId = $grupoVid ?? config('nosis.group_id');
        $timeout = config('nosis.timeout', 10);

        if (!$baseUrl || !$username || !$token) {
            throw new RuntimeException('Faltan credenciales de Nosis (NOSIS_BASE_URL, NOSIS_USERNAME, NOSIS_TOKEN).');
        }

        $response = Http::timeout($timeout)
            ->retry(1, 300)
            ->get($baseUrl, [
                'usuario' => $username,
                'token' => $token,
                'documento' => $documento,
                'CBU' => $cbu,
                'NroGrupoVID' => $groupId,
            ]);

        if (!$response->ok()) {
            throw new RuntimeException("Nosis devolvió HTTP {$response->status()}");
        }

        $raw = $response->json();

        if ($raw === null) {
            $raw = $response->body();
        }

        $message = null;
        $valid = false;

        if (is_array($raw)) {
            $message = Arr::get($raw, 'Mensaje')
                ?? Arr::get($raw, 'mensaje')
                ?? Arr::get($raw, 'Message')
                ?? Arr::get($raw, 'message');

            $valid = $this->isValidMessage($message);
        } elseif (is_string($raw)) {
            $parsedXml = $this->parseXmlMessage($raw);
            if ($parsedXml) {
                $message = $parsedXml['message'];
                $valid = $parsedXml['valid'];
            } else {
                $message = $raw;
                $valid = $this->isValidMessage($message);
            }
        }

        return [
            'valid' => $valid,
            'message' => $message ?: 'Respuesta recibida de Nosis.',
            'raw' => $raw,
        ];
    }

    private function isValidMessage(?string $message): bool
    {
        if (!$message) {
            return false;
        }

        $normalized = Str::lower($message);

        return Str::contains($normalized, 'validado') || Str::contains($normalized, 'aprobado');
    }

    private function parseXmlMessage(string $payload): ?array
    {
        if (!str_contains($payload, '<')) {
            return null;
        }

        try {
            $xml = simplexml_load_string($payload);
            if (!$xml) {
                return null;
            }

            $estado = (string) ($xml->Contenido->Resultado->Estado ?? '');
            $novedad = (string) ($xml->Contenido->Resultado->Novedad ?? '');
            $cbuEstado = (string) ($xml->Contenido->Datos->Cbu->Estado ?? '');

            $parts = array_filter([$novedad, $cbuEstado]);
            $message = count($parts) > 0 ? implode(' · ', $parts) : trim($payload);

            $valid = false;
            if ($estado === '200') {
                $valid = $this->isValidMessage($cbuEstado ?: $novedad ?: $message);
            }

            return [
                'message' => $message,
                'valid' => $valid,
            ];
        } catch (\Throwable) {
            return null;
        }
    }
}

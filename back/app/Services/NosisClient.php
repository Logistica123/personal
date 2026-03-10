<?php

namespace App\Services;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class NosisClient
{
    public function validateCbu(string $documento, string $cbu, ?int $grupoVid = null, ?string $fechaNacimiento = null): array
    {
        $groupId = $grupoVid ?? config('nosis.group_id');

        return $this->request([
            'documento' => $documento,
            'CBU' => $cbu,
            'NroGrupoVID' => $groupId,
            'FechaNacimiento' => $fechaNacimiento ?: null,
        ]);
    }

    public function lookupDocumento(string $documento, ?int $grupoVid = null, ?string $fechaNacimiento = null): array
    {
        $groupId = $grupoVid ?? config('nosis.group_id');

        return $this->request([
            'documento' => $documento,
            'NroGrupoVID' => $groupId,
            'FechaNacimiento' => $fechaNacimiento ?: null,
        ]);
    }

    private function request(array $params): array
    {
        $baseUrl = config('nosis.base_url');
        $username = config('nosis.username');
        $token = config('nosis.token');
        $timeout = config('nosis.timeout', 10);
        $isCbuValidation = isset($params['CBU']) && $params['CBU'] !== null && $params['CBU'] !== '';

        if (!$baseUrl || !$username || !$token) {
            throw new RuntimeException('Faltan credenciales de Nosis (NOSIS_BASE_URL, NOSIS_USERNAME, NOSIS_TOKEN).');
        }

        $query = array_filter(
            [
                'usuario' => $username,
                'token' => $token,
                ...$params,
            ],
            static fn ($value) => $value !== null && $value !== ''
        );

        $response = Http::timeout($timeout)
            ->retry(1, 300)
            ->get($baseUrl, $query);

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
            $parsedXml = $this->parseXmlMessage($raw, $isCbuValidation);
            if ($parsedXml) {
                $message = $parsedXml['message'];
                $valid = $parsedXml['valid'];
            } else {
                $message = $raw;
                $valid = $this->isValidMessage($message);
            }
        }

        $resolvedMessage = $message ?: 'Respuesta recibida de Nosis.';
        $parsed = $this->buildParsedPayload($raw, $resolvedMessage, $valid, $isCbuValidation);

        return [
            'valid' => $valid,
            'message' => $resolvedMessage,
            'raw' => $raw,
            'parsed' => $parsed,
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

    private function parseXmlMessage(string $payload, bool $isCbuValidation): ?array
    {
        $parsed = $this->parseXmlPayload($payload, $isCbuValidation);
        if (!$parsed) {
            return null;
        }

        return [
            'message' => (string) ($parsed['message'] ?? trim($payload)),
            'valid' => (bool) ($parsed['valid'] ?? false),
        ];
    }

    private function buildParsedPayload(mixed $raw, string $message, bool $valid, bool $isCbuValidation): ?array
    {
        if (is_string($raw)) {
            $parsed = $this->parseXmlPayload($raw, $isCbuValidation);
            if ($parsed) {
                return $parsed;
            }

            return [
                'rawFormat' => 'text',
                'message' => $message,
                'valid' => $valid,
            ];
        }

        if (is_array($raw)) {
            return $this->filterEmptyValues([
                'rawFormat' => 'json',
                'message' => $message,
                'valid' => $valid,
                'resultadoEstado' => $this->firstArrayValue($raw, ['Estado', 'estado', 'status']),
                'resultadoNovedad' => $this->firstArrayValue($raw, ['Novedad', 'novedad', 'detail']),
                'documento' => $this->firstArrayValue($raw, ['Documento', 'documento']),
                'razonSocial' => $this->firstArrayValue($raw, ['RazonSocial', 'razonSocial', 'nombre']),
                'arcaStatus' => $this->firstArrayValue($raw, [
                    'ArcaEstado',
                    'arcaEstado',
                    'EstadoArca',
                    'estadoArca',
                    'AfipEstado',
                    'afipEstado',
                    'EstadoAfip',
                    'estadoAfip',
                    'CondicionFiscal',
                    'condicionFiscal',
                    'EstadoFiscal',
                    'estadoFiscal',
                ]),
                'dgrStatus' => $this->firstArrayValue($raw, [
                    'DgrEstado',
                    'dgrEstado',
                    'EstadoDgr',
                    'estadoDgr',
                    'CondicionDgr',
                    'condicionDgr',
                    'IngresosBrutosEstado',
                    'ingresosBrutosEstado',
                ]),
                'bankOwnerName' => $this->firstArrayValue($raw, [
                    'Titular',
                    'titular',
                    'TitularCuenta',
                    'titularCuenta',
                    'NombreTitular',
                    'nombreTitular',
                    'RazonSocialTitular',
                    'razonSocialTitular',
                ]),
                'bankOwnerDocument' => $this->normalizeDigits($this->firstArrayValue($raw, [
                    'DocumentoTitular',
                    'documentoTitular',
                    'TitularDocumento',
                    'titularDocumento',
                    'CuitTitular',
                    'cuitTitular',
                    'CuilTitular',
                    'cuilTitular',
                ])),
                'cbuEstado' => $this->firstArrayValue($raw, ['CbuEstado', 'cbuEstado']),
                'cbuNovedad' => $this->firstArrayValue($raw, ['CbuNovedad', 'cbuNovedad']),
                'cbu' => $this->normalizeDigits($this->firstArrayValue($raw, ['CBU', 'cbu'])),
            ]);
        }

        return null;
    }

    private function parseXmlPayload(string $payload, bool $isCbuValidation = false): ?array
    {
        if (!str_contains($payload, '<')) {
            return null;
        }

        try {
            $xml = simplexml_load_string($payload);
            if (!$xml) {
                return null;
            }

            $resultado = $xml->Contenido->Resultado ?? null;
            $datos = $xml->Contenido->Datos ?? null;
            $persona = $datos->Persona ?? null;
            $cbu = $datos->Cbu ?? null;

            $resultadoEstado = $this->xmlText($resultado?->Estado);
            $resultadoNovedad = $this->xmlText($resultado?->Novedad);
            $razonSocial = $this->xmlText($persona?->RazonSocial);
            $documento = $this->xmlText($persona?->Documento);
            $fechaNacimiento = $this->xmlText($persona?->FechaNacimiento);
            $cbuEstado = $this->xmlText($cbu?->Estado);
            $cbuNovedad = $this->xmlText($cbu?->Novedad);
            $cbuNumero = $this->xmlText($cbu?->Numero) ?: $this->xmlText($cbu?->CBU);
            $arcaStatus = $this->xmlSearchText($xml, [
                'ArcaEstado',
                'EstadoArca',
                'AfipEstado',
                'EstadoAfip',
                'CondicionFiscal',
                'EstadoFiscal',
                'SituacionFiscal',
            ]);
            $dgrStatus = $this->xmlSearchText($xml, [
                'DgrEstado',
                'EstadoDgr',
                'CondicionDgr',
                'SituacionDgr',
                'IngresosBrutosEstado',
                'EstadoIngresosBrutos',
            ]);
            $bankOwnerName = $this->xmlSearchText($xml, [
                'Titular',
                'TitularCuenta',
                'NombreTitular',
                'RazonSocialTitular',
                'TitularRazonSocial',
            ]);
            $bankOwnerDocument = $this->normalizeDigits($this->xmlSearchText($xml, [
                'DocumentoTitular',
                'TitularDocumento',
                'CuitTitular',
                'CuilTitular',
                'TitularCuit',
                'TitularCuil',
            ]));

            $messageParts = $isCbuValidation
                ? array_values(array_filter([$resultadoNovedad, $cbuNovedad, $cbuEstado]))
                : array_values(array_filter([$resultadoNovedad]));
            $message = count($messageParts) > 0 ? implode(' · ', $messageParts) : trim($payload);
            $valid = $resultadoEstado === '200'
                && (
                    $isCbuValidation
                        ? $this->isValidMessage($cbuEstado ?: $resultadoNovedad ?: $message)
                        : $this->isSuccessfulLookupMessage($resultadoNovedad ?: $message)
                );

            return $this->filterEmptyValues([
                'rawFormat' => 'xml',
                'message' => $message,
                'valid' => $valid,
                'resultadoEstado' => $resultadoEstado,
                'resultadoNovedad' => $resultadoNovedad,
                'razonSocial' => $razonSocial,
                'documento' => $documento,
                'documentoNormalizado' => $this->normalizeDigits($documento),
                'fechaNacimiento' => $fechaNacimiento,
                'fechaNacimientoNormalizada' => $this->normalizeDate($fechaNacimiento),
                'arcaStatus' => $arcaStatus,
                'dgrStatus' => $dgrStatus,
                'bankOwnerName' => $bankOwnerName,
                'bankOwnerDocument' => $bankOwnerDocument,
                'cbuEstado' => $cbuEstado,
                'cbuNovedad' => $cbuNovedad,
                'cbu' => $cbuNumero,
                'cbuNormalizado' => $this->normalizeDigits($cbuNumero),
            ]);
        } catch (\Throwable) {
            return null;
        }
    }

    private function xmlText(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);

        return $text !== '' ? $text : null;
    }

    private function normalizeDigits(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $value) ?: '';

        return $digits !== '' ? $digits : null;
    }

    private function normalizeDate(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed) === 1) {
            return $trimmed;
        }

        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $trimmed, $matches) === 1) {
            return "{$matches[3]}-{$matches[2]}-{$matches[1]}";
        }

        return null;
    }

    private function isSuccessfulLookupMessage(?string $message): bool
    {
        if (!$message) {
            return false;
        }

        $normalized = Str::lower(trim($message));

        return $this->isValidMessage($message)
            || in_array($normalized, ['ok', 'correcto', 'sin novedades'], true);
    }

    private function firstArrayValue(array $payload, array $keys): ?string
    {
        foreach ($keys as $key) {
            $value = Arr::get($payload, $key);
            if (!is_scalar($value)) {
                continue;
            }

            $text = trim((string) $value);
            if ($text !== '') {
                return $text;
            }
        }

        return null;
    }

    private function xmlSearchText(\SimpleXMLElement $xml, array $tagNames): ?string
    {
        foreach ($tagNames as $tagName) {
            $nodes = $xml->xpath(sprintf('//*[local-name()="%s"]', $tagName));
            if (!is_array($nodes)) {
                continue;
            }

            foreach ($nodes as $node) {
                $text = $this->xmlText($node);
                if ($text !== null) {
                    return $text;
                }
            }
        }

        return null;
    }

    private function filterEmptyValues(array $payload): array
    {
        return array_filter($payload, static function ($value) {
            return $value !== null && $value !== '' && $value !== [];
        });
    }
}

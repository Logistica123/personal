<?php

namespace App\Services\Erp;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class ErpClient
{
    public function __construct(private readonly ?array $config = null)
    {
    }

    public function isEnabled(): bool
    {
        $cfg = $this->resolvedConfig();
        return (bool) ($cfg['enabled'] ?? false);
    }

    public function isMockMode(): bool
    {
        $cfg = $this->resolvedConfig();
        return (bool) ($cfg['mock_mode'] ?? false);
    }

    public function canPublish(): bool
    {
        if ($this->isMockMode()) {
            return true;
        }

        $cfg = $this->resolvedConfig();
        $baseUrl = $this->normalizeNullableString($cfg['base_url'] ?? null);

        return $this->isEnabled() && $baseUrl !== null;
    }

    public function publishDistributor(array $payload): array
    {
        $cfg = $this->resolvedConfig();
        $endpoint = (string) ($cfg['distributor_endpoint'] ?? '/liquidaciones/distribuidor');

        return $this->send($endpoint, $payload, 'distributor');
    }

    public function publishFacturacion(array $payload): array
    {
        $cfg = $this->resolvedConfig();
        $endpoint = (string) ($cfg['billing_endpoint'] ?? '/liquidaciones/facturacion');

        return $this->send($endpoint, $payload, 'facturacion');
    }

    private function send(string $endpoint, array $payload, string $type): array
    {
        $cfg = $this->resolvedConfig();

        if ($this->isMockMode()) {
            $latencyMs = max(0, (int) ($cfg['mock_latency_ms'] ?? 0));
            if ($latencyMs > 0) {
                usleep($latencyMs * 1000);
            }

            $requestId = 'MOCK-REQ-' . strtoupper(Str::random(12));
            $batchId = 'MOCK-BATCH-' . now()->format('YmdHis');

            return [
                'url' => 'mock://erp/' . ltrim($endpoint, '/'),
                'status_code' => 200,
                'ok' => true,
                'body' => [
                    'status' => 'accepted',
                    'message' => 'Mock ERP accepted.',
                    'erpRequestId' => $requestId,
                    'erpBatchId' => $batchId,
                    'type' => $type,
                ],
                'message' => 'Mock ERP accepted.',
                'erp_request_id' => $requestId,
                'erp_batch_id' => $batchId,
                'transient' => false,
            ];
        }

        $baseUrl = $this->normalizeNullableString($cfg['base_url'] ?? null);
        if ($baseUrl === null) {
            return [
                'url' => null,
                'status_code' => null,
                'ok' => false,
                'body' => null,
                'message' => 'ERP base_url no configurada.',
                'erp_request_id' => null,
                'erp_batch_id' => null,
                'transient' => false,
            ];
        }

        $url = rtrim($baseUrl, '/') . '/' . ltrim($endpoint, '/');
        $timeout = max(3, (int) ($cfg['timeout'] ?? 15));
        $token = $this->normalizeNullableString($cfg['token'] ?? null);

        try {
            $client = Http::timeout($timeout)->acceptJson();
            if ($token !== null) {
                $client = $client->withToken($token);
            }

            $response = $client->post($url, $payload);
            $body = $response->json();
            if (!is_array($body)) {
                $body = ['raw' => $response->body()];
            }

            $statusCode = $response->status();
            $isTransient = $statusCode === 408 || $statusCode === 429 || $statusCode >= 500;

            return [
                'url' => $url,
                'status_code' => $statusCode,
                'ok' => $response->successful(),
                'body' => $body,
                'message' => $body['message'] ?? $response->reason(),
                'erp_request_id' => $body['erpRequestId'] ?? $body['erp_request_id'] ?? null,
                'erp_batch_id' => $body['erpBatchId'] ?? $body['erp_batch_id'] ?? null,
                'transient' => $isTransient,
            ];
        } catch (\Throwable $e) {
            return [
                'url' => $url,
                'status_code' => null,
                'ok' => false,
                'body' => null,
                'message' => $e->getMessage(),
                'erp_request_id' => null,
                'erp_batch_id' => null,
                'transient' => true,
            ];
        }
    }

    private function resolvedConfig(): array
    {
        return $this->config ?? config('services.erp', []);
    }

    private function normalizeNullableString($value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $trimmed = trim($value);
        return $trimmed !== '' ? $trimmed : null;
    }
}

<?php

namespace App\Services\Voice;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class AnuraVoiceService
{
    public function providerName(): string
    {
        return 'anura';
    }

    public function createClickToDial(string $called, string $extension, array $customs = []): array
    {
        $customs = array_values(array_slice(array_map(
            static fn ($value) => trim((string) $value),
            $customs
        ), 0, 6));

        if (! $this->isActive()) {
            return [
                'provider' => $this->providerName(),
                'status' => 'queued',
                'mock' => true,
                'response' => [
                    'called' => $called,
                    'extension' => $extension,
                    'customs' => $customs,
                ],
            ];
        }

        $token = trim((string) config('services.voice.anura.click2dial_token', ''));
        if ($token === '') {
            throw new RuntimeException('Falta ANURA_CLICK2DIAL_TOKEN para iniciar llamadas por Anura.');
        }

        $endpoint = $this->resolveClickToDialEndpoint();
        $body = $this->buildFormPayload($called, $extension, $customs);

        $response = Http::withToken($token)
            ->withHeaders([
                'Accept' => 'application/json',
                'Content-Type' => 'application/x-www-form-urlencoded',
            ])
            ->withBody($body, 'application/x-www-form-urlencoded')
            ->timeout(max((int) config('services.voice.anura.timeout', 15), 5))
            ->post($endpoint);

        if ($response->failed()) {
            $payload = trim($response->body());
            throw new RuntimeException('Anura rechazó la llamada: ' . ($payload !== '' ? $payload : 'error HTTP ' . $response->status()));
        }

        return [
            'provider' => $this->providerName(),
            'status' => (string) ($response->json('status') ?? 'queued'),
            'sid' => $response->json('call_id')
                ?? $response->json('callId')
                ?? $response->json('sid')
                ?? $response->header('X-Request-Id'),
            'mock' => false,
            'response' => $response->json() ?? ['raw' => $response->body()],
        ];
    }

    public function validateWebhookRequest(Request $request): bool
    {
        $expectedToken = trim((string) config('services.voice.anura.webhook_token', ''));
        if ($expectedToken === '') {
            return true;
        }

        $header = trim((string) $request->header('Authorization', ''));
        if (preg_match('/^Bearer\s+(.+)$/i', $header, $matches) === 1) {
            return hash_equals($expectedToken, trim((string) $matches[1]));
        }

        return false;
    }

    private function isActive(): bool
    {
        return (string) config('services.voice.driver', 'mock') === $this->providerName()
            && (bool) config('services.voice.anura.enabled', false);
    }

    private function resolveClickToDialEndpoint(): string
    {
        $configured = trim((string) config('services.voice.anura.click2dial_endpoint', ''));
        if ($configured !== '') {
            return $configured;
        }

        $baseUrl = rtrim(trim((string) config('services.voice.anura.api_base_url', 'https://api.anura.com.ar')), '/');

        return $baseUrl . '/adapter/default/click2call';
    }

    private function buildFormPayload(string $called, string $extension, array $customs): string
    {
        $segments = [
            'called=' . rawurlencode($called),
            'extension=' . rawurlencode($extension),
        ];

        foreach ($customs as $custom) {
            if ($custom === '') {
                continue;
            }

            $segments[] = 'customs=' . rawurlencode($custom);
        }

        return implode('&', $segments);
    }
}

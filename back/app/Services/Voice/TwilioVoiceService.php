<?php

namespace App\Services\Voice;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class TwilioVoiceService
{
    public function providerName(): string
    {
        return (string) config('services.voice.driver', 'mock');
    }

    public function issueAccessToken(User $user, ?string $requestedIdentity = null): array
    {
        $identity = $this->buildIdentity($user, $requestedIdentity);
        $ttl = max((int) config('services.voice.token_ttl', 3600), 60);
        $expiresAt = now()->addSeconds($ttl);

        if (! $this->isTwilioActive()) {
            $mockToken = base64_encode((string) Str::uuid() . '|' . $identity . '|mock');

            return [
                'provider' => 'mock',
                'token' => $mockToken,
                'identity' => $identity,
                'expiresAt' => $expiresAt->toIso8601String(),
            ];
        }

        $accountSid = (string) config('services.voice.twilio.account_sid');
        $apiKeySid = (string) config('services.voice.twilio.api_key_sid');
        $apiKeySecret = (string) config('services.voice.twilio.api_key_secret');
        $twimlAppSid = (string) config('services.voice.twilio.twiml_app_sid');

        if ($accountSid === '' || $apiKeySid === '' || $apiKeySecret === '' || $twimlAppSid === '') {
            throw new RuntimeException('Faltan credenciales Twilio para generar token de voz.');
        }

        $payload = [
            'jti' => $apiKeySid . '-' . Str::uuid()->toString(),
            'iss' => $apiKeySid,
            'sub' => $accountSid,
            'exp' => $expiresAt->timestamp,
            'grants' => [
                'identity' => $identity,
                'voice' => [
                    'incoming' => ['allow' => true],
                    'outgoing' => ['application_sid' => $twimlAppSid],
                ],
            ],
        ];

        $token = $this->encodeJwt(['typ' => 'JWT', 'alg' => 'HS256'], $payload, $apiKeySecret);

        return [
            'provider' => 'twilio',
            'token' => $token,
            'identity' => $identity,
            'expiresAt' => $expiresAt->toIso8601String(),
        ];
    }

    public function createOutboundPhoneCall(string $toPhone, string $fromPhone, ?string $dialTargetIdentity = null): array
    {
        if (! $this->isTwilioActive()) {
            return [
                'sid' => 'MOCK-' . strtoupper(Str::random(24)),
                'status' => 'queued',
                'provider' => 'mock',
            ];
        }

        $accountSid = (string) config('services.voice.twilio.account_sid');
        $authToken = (string) config('services.voice.twilio.auth_token');

        if ($accountSid === '' || $authToken === '') {
            throw new RuntimeException('Faltan credenciales Twilio para iniciar llamada telefónica.');
        }

        $statusCallback = (string) config('services.voice.twilio.status_callback_url');
        $outboundTwimlUrl = (string) config('services.voice.twilio.outbound_twiml_url');

        if ($statusCallback === '' || $outboundTwimlUrl === '') {
            throw new RuntimeException('Faltan URLs de callback/TwiML para llamadas salientes.');
        }

        $dialTo = $dialTargetIdentity ? 'client:' . $this->sanitizeIdentity($dialTargetIdentity) : '';
        $twimlUrl = $outboundTwimlUrl;
        if ($dialTo !== '') {
            $separator = str_contains($twimlUrl, '?') ? '&' : '?';
            $twimlUrl .= $separator . 'To=' . urlencode($dialTo);
        }

        $response = Http::asForm()
            ->withBasicAuth($accountSid, $authToken)
            ->timeout(15)
            ->post("https://api.twilio.com/2010-04-01/Accounts/{$accountSid}/Calls.json", [
                'To' => $toPhone,
                'From' => $fromPhone,
                'Url' => $twimlUrl,
                'Method' => 'POST',
                'StatusCallback' => $statusCallback,
                'StatusCallbackMethod' => 'POST',
                'StatusCallbackEvent' => 'initiated ringing answered completed',
            ]);

        if ($response->failed()) {
            throw new RuntimeException('Twilio rechazó la llamada: ' . $response->body());
        }

        return [
            'sid' => (string) $response->json('sid'),
            'status' => (string) $response->json('status', 'queued'),
            'provider' => 'twilio',
        ];
    }

    public function buildOutboundTwiml(?string $to, ?string $callerId = null): string
    {
        $target = trim((string) $to);
        if ($target === '') {
            return '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="es-ES">Destino inválido.</Say></Response>';
        }

        $caller = trim((string) $callerId);
        if ($caller === '') {
            $caller = trim((string) config('services.voice.default_caller_id', ''));
        }

        $dialAttributes = 'timeout="20"';
        if ($caller !== '') {
            $dialAttributes .= ' callerId="' . $this->escapeXml($caller) . '"';
        }

        $isPhone = preg_match('/^\+?[0-9]{7,15}$/', $target) === 1;

        if ($isPhone) {
            return '<?xml version="1.0" encoding="UTF-8"?><Response><Dial ' . $dialAttributes . '><Number>'
                . $this->escapeXml($target)
                . '</Number></Dial></Response>';
        }

        $identity = $target;
        if (str_starts_with(strtolower($identity), 'client:')) {
            $identity = substr($identity, 7);
        }

        $identity = $this->sanitizeIdentity($identity);

        return '<?xml version="1.0" encoding="UTF-8"?><Response><Dial ' . $dialAttributes . '><Client>'
            . $this->escapeXml($identity)
            . '</Client></Dial></Response>';
    }

    public function validateWebhookSignature(Request $request): bool
    {
        if (! (bool) config('services.voice.webhook_signature_validation', true)) {
            return true;
        }

        if (! $this->isTwilioActive()) {
            return true;
        }

        $twilioAuthToken = (string) config('services.voice.twilio.auth_token');
        $signature = (string) $request->header('X-Twilio-Signature', '');

        if ($twilioAuthToken === '' || $signature === '') {
            return false;
        }

        $urls = [];

        $configuredSignatureUrl = trim((string) config('services.voice.twilio.signature_url', ''));
        if ($configuredSignatureUrl !== '') {
            $urls[] = $configuredSignatureUrl;
        }

        $urls[] = $request->fullUrl();
        $urls[] = $request->url();

        $params = $request->post();

        foreach (array_unique($urls) as $url) {
            $candidate = $this->signTwilioRequest($url, $params, $twilioAuthToken);
            if (hash_equals($candidate, $signature)) {
                return true;
            }
        }

        return false;
    }

    private function isTwilioActive(): bool
    {
        return $this->providerName() === 'twilio'
            && (bool) config('services.voice.twilio.enabled', false);
    }

    private function buildIdentity(User $user, ?string $requestedIdentity): string
    {
        if (is_string($requestedIdentity) && trim($requestedIdentity) !== '') {
            return $this->sanitizeIdentity($requestedIdentity);
        }

        return 'user-' . $user->id;
    }

    private function sanitizeIdentity(string $identity): string
    {
        $clean = preg_replace('/[^a-zA-Z0-9@._-]/', '', trim($identity)) ?? '';
        $clean = substr($clean, 0, 80);

        if ($clean === '') {
            $clean = 'user-' . Str::lower(Str::random(8));
        }

        return $clean;
    }

    private function encodeJwt(array $headers, array $payload, string $secret): string
    {
        $encodedHeader = $this->base64UrlEncode(json_encode($headers, JSON_UNESCAPED_SLASHES));
        $encodedPayload = $this->base64UrlEncode(json_encode($payload, JSON_UNESCAPED_SLASHES));

        $signature = hash_hmac('sha256', $encodedHeader . '.' . $encodedPayload, $secret, true);

        return $encodedHeader . '.' . $encodedPayload . '.' . $this->base64UrlEncode($signature);
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function signTwilioRequest(string $url, array $params, string $authToken): string
    {
        ksort($params, SORT_STRING);

        $data = $url;
        foreach ($params as $key => $value) {
            if (is_array($value)) {
                sort($value, SORT_STRING);
                foreach ($value as $item) {
                    $data .= $key . (string) $item;
                }
                continue;
            }

            $data .= $key . (string) $value;
        }

        return base64_encode(hash_hmac('sha1', $data, $authToken, true));
    }

    private function escapeXml(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}

<?php

namespace App\Services\Arca\Wsaa;

use App\Models\ArcaCertificado;
use App\Models\ArcaTaCache;
use Carbon\CarbonImmutable;

class TaCacheService
{
    public function __construct(private readonly WsaaClient $wsaaClient)
    {
    }

    public function getValidTa(ArcaCertificado $certificado, string $serviceName = 'wsfe'): WsaaToken
    {
        $cache = ArcaTaCache::query()
            ->where('certificado_id', $certificado->id)
            ->where('ambiente', $certificado->ambiente?->value ?? (string) $certificado->ambiente)
            ->where('service_name', $serviceName)
            ->first();

        $now = CarbonImmutable::now('UTC');
        if ($cache && $cache->expiration_time && $cache->expiration_time->copy()->subSeconds(60)->greaterThan($now)) {
            return new WsaaToken(
                (string) $cache->token,
                (string) $cache->sign,
                CarbonImmutable::instance($cache->generation_time),
                CarbonImmutable::instance($cache->expiration_time),
                ''
            );
        }

        $token = $this->wsaaClient->login($certificado, $serviceName);

        ArcaTaCache::query()->updateOrCreate(
            [
                'certificado_id' => $certificado->id,
                'ambiente' => $certificado->ambiente?->value ?? (string) $certificado->ambiente,
                'service_name' => $serviceName,
            ],
            [
                'token' => $token->token,
                'sign' => $token->sign,
                'generation_time' => $token->generationTime,
                'expiration_time' => $token->expirationTime,
            ]
        );

        $certificado->forceFill([
            'ultimo_login_wsaa_ok_at' => now(),
        ])->save();

        return $token;
    }
}

<?php

namespace App\Services\Arca\Wsaa;

use Carbon\CarbonImmutable;

class TraXmlBuilder
{
    public function build(string $serviceName, ?CarbonImmutable $now = null, int $ttlMinutes = 12): string
    {
        $issuedAt = $now ?? CarbonImmutable::now('UTC');
        $expiration = $issuedAt->addMinutes($ttlMinutes);
        $uniqueId = (string) $issuedAt->timestamp;

        return trim(
            <<<XML
            <?xml version="1.0" encoding="UTF-8"?>
            <loginTicketRequest version="1.0">
              <header>
                <uniqueId>{$uniqueId}</uniqueId>
                <generationTime>{$issuedAt->format('c')}</generationTime>
                <expirationTime>{$expiration->format('c')}</expirationTime>
              </header>
              <service>{$serviceName}</service>
            </loginTicketRequest>
            XML
        );
    }
}

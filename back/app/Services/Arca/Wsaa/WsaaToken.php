<?php

namespace App\Services\Arca\Wsaa;

use Carbon\CarbonImmutable;

final class WsaaToken
{
    public function __construct(
        public readonly string $token,
        public readonly string $sign,
        public readonly CarbonImmutable $generationTime,
        public readonly CarbonImmutable $expirationTime,
        public readonly string $rawXml
    ) {
    }
}

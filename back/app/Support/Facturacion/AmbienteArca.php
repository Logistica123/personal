<?php

namespace App\Support\Facturacion;

enum AmbienteArca: string
{
    case HOMO = 'HOMO';
    case PROD = 'PROD';

    public static function fromMixed(string|null $value, self $default = self::PROD): self
    {
        return match (strtoupper(trim((string) $value))) {
            self::HOMO->value => self::HOMO,
            self::PROD->value => self::PROD,
            default => $default,
        };
    }
}

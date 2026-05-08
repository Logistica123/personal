<?php

namespace App\Exceptions\Polizas;

use RuntimeException;
use Throwable;

/**
 * ADDENDUM 11 — Excepción específica para "no se puede enviar porque el admin
 * no tiene Outlook vinculado / el OAuth falló". El controller la captura y
 * devuelve 422 con un shape que el frontend usa para mostrar el banner
 * "Re-vincular tu Outlook".
 */
class OAuthRequiredException extends RuntimeException
{
    /** @var string `sin_vincular` | `inactivo` | `envio_fallido` */
    public string $razon;

    public function __construct(string $message, string $razon, ?Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
        $this->razon = $razon;
    }
}

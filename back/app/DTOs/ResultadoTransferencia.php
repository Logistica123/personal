<?php

namespace App\DTOs;

class ResultadoTransferencia
{
    public function __construct(
        public bool    $exitoso,
        public ?string $referenciaBanco = null,
        public ?string $codigo = null,
        public ?string $mensaje = null,
        public ?string $responseRaw = null,
    ) {
    }
}

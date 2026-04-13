<?php

namespace App\DTOs;

class EstadoTransferencia
{
    public function __construct(
        public string  $estado,
        public ?string $mensaje = null,
        public ?string $fechaProceso = null,
    ) {
    }
}

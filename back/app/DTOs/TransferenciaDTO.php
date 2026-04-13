<?php

namespace App\DTOs;

class TransferenciaDTO
{
    public function __construct(
        public string $cbuOrigen,
        public string $cbuDestino,
        public float  $importe,
        public string $concepto,
        public string $referencia,
        public string $beneficiario,
        public string $cuitBenef,
        public string $moneda = 'ARS',
    ) {
    }
}

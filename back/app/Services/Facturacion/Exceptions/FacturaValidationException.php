<?php

namespace App\Services\Facturacion\Exceptions;

use InvalidArgumentException;

class FacturaValidationException extends InvalidArgumentException
{
    /**
     * @param array<string, list<string>|string> $errors
     */
    public function __construct(
        private readonly array $errors,
        string $message = 'La factura no superó la validación local.'
    ) {
        parent::__construct($message);
    }

    /**
     * @return array<string, list<string>|string>
     */
    public function errors(): array
    {
        return $this->errors;
    }
}

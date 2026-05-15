<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class CuitValido implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if ($value === null || $value === '') {
            return;
        }

        $cuit = preg_replace('/\D+/', '', (string) $value);

        if (strlen($cuit) !== 11) {
            $fail('El CUIT debe tener 11 dígitos.');
            return;
        }

        $mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
        $suma = 0;
        for ($i = 0; $i < 10; $i++) {
            $suma += intval($cuit[$i]) * $mult[$i];
        }
        $dv = 11 - ($suma % 11);
        if ($dv === 11) $dv = 0;
        if ($dv === 10) $dv = 9;

        if (intval($cuit[10]) !== $dv) {
            $fail('El CUIT es inválido (dígito verificador no coincide).');
        }
    }
}

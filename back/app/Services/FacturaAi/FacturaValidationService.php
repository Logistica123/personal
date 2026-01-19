<?php

namespace App\Services\FacturaAi;

use App\Models\Archivo;
use App\Models\Factura;
use App\Models\Persona;
use Illuminate\Support\Str;

class FacturaValidationService
{
    public function validate(
        Factura $factura,
        ?Archivo $liquidacion,
        ?Persona $persona,
        bool $skipCuil = false,
        bool $skipImporte = false
    ): array
    {
        $validations = [];
        $decision = [
            'estado' => 'aprobada',
            'motivo' => null,
            'mensaje' => null,
        ];

        $idValid = $liquidacion !== null;
        $validations[] = $this->makeValidation(
            'id',
            $idValid,
            $idValid ? null : 'ID de liquidación inexistente'
        );

        if (! $idValid) {
            return $this->reject($validations, 'id', 'ID de liquidación inexistente');
        }

        $numeroUnico = $this->isInvoiceUnique($factura);
        $validations[] = $this->makeValidation(
            'factura',
            $numeroUnico,
            $numeroUnico ? null : 'Factura duplicada'
        );

        if (! $numeroUnico) {
            return $this->reject($validations, 'factura', 'Factura duplicada');
        }

        $cuilOk = $skipCuil ? true : $this->isCuilMatching($factura, $persona);
        $validations[] = $this->makeValidation(
            'cuil',
            $cuilOk,
            $cuilOk ? null : 'El CUIL del emisor no coincide con el CUIL registrado para el cobro'
        );

        if (! $cuilOk && ! $skipCuil) {
            return $this->reject($validations, 'cuil', 'El CUIL del emisor no coincide con el CUIL registrado para el cobro');
        }

        $conceptOk = $this->isConceptValid($factura->concepto ?? '');
        $validations[] = $this->makeValidation(
            'concepto',
            $conceptOk,
            $conceptOk ? null : 'El concepto de la factura no es válido'
        );

        if (! $conceptOk) {
            return $this->reject($validations, 'concepto', 'El concepto de la factura no es válido');
        }

        $importeOk = $skipImporte ? true : $this->isImporteCorrect($factura, $liquidacion);
        $validations[] = $this->makeValidation(
            'importe',
            $importeOk,
            $importeOk ? null : 'El importe facturado es incorrecto'
        );

        if (! $importeOk && ! $skipImporte) {
            return $this->reject($validations, 'importe', 'El importe facturado es incorrecto');
        }

        return [
            'validations' => $validations,
            'decision' => $decision,
        ];
    }

    private function reject(array $validations, string $motivo, string $mensaje): array
    {
        return [
            'validations' => $validations,
            'decision' => [
                'estado' => 'rechazada',
                'motivo' => $motivo,
                'mensaje' => $mensaje,
            ],
        ];
    }

    private function makeValidation(string $rule, bool $result, ?string $message): array
    {
        return [
            'regla' => $rule,
            'resultado' => $result,
            'mensaje' => $message,
        ];
    }

    private function isInvoiceUnique(Factura $factura): bool
    {
        if (! $factura->cuit_emisor || ! $factura->tipo_factura || ! $factura->numero_factura) {
            return true;
        }

        return ! Factura::query()
            ->where('cuit_emisor', $factura->cuit_emisor)
            ->where('tipo_factura', $factura->tipo_factura)
            ->where('numero_factura', $factura->numero_factura)
            ->where('id', '<>', $factura->id)
            ->exists();
    }

    private function isCuilMatching(Factura $factura, ?Persona $persona): bool
    {
        $cuit = $this->normalizeTaxId($factura->cuit_emisor ?? '');
        if ($cuit === '') {
            return false;
        }

        if (! $this->isValidCuit($cuit)) {
            return false;
        }

        $expected = '';
        if ($persona) {
            $expected = $persona->cobrador_cuil ?: $persona->cuil ?: '';
        }

        $expected = $this->normalizeTaxId($expected);
        if ($expected === '') {
            return false;
        }

        return $cuit === $expected;
    }

    private function isConceptValid(string $concepto): bool
    {
        $normalized = $this->normalizeText($concepto);
        $primaryWords = ['servicio', 'logistica', 'prestado'];
        $primaryOk = true;
        foreach ($primaryWords as $word) {
            if (! Str::contains($normalized, $word)) {
                $primaryOk = false;
                break;
            }
        }

        if ($primaryOk) {
            return true;
        }

        $webWords = ['servicio', 'web'];
        foreach ($webWords as $word) {
            if (! Str::contains($normalized, $word)) {
                return false;
            }
        }

        return true;
    }

    private function isImporteCorrect(Factura $factura, ?Archivo $liquidacion): bool
    {
        if (! $liquidacion || $liquidacion->importe_facturar === null) {
            return false;
        }

        if ($factura->importe_total === null) {
            return false;
        }

        $base = (float) $liquidacion->importe_facturar;
        $expected = $factura->tipo_factura === 'A'
            ? round($base * 1.21, 2)
            : round($base, 2);

        $factura->importe_esperado = $expected;

        return round((float) $factura->importe_total, 2) === $expected;
    }

    private function normalizeTaxId(string $value): string
    {
        return preg_replace('/\\D+/', '', $value) ?? '';
    }

    private function normalizeText(string $value): string
    {
        $lower = Str::lower($value);
        $translit = iconv('UTF-8', 'ASCII//TRANSLIT', $lower);
        $clean = preg_replace('/[^a-z0-9\\s]+/', ' ', $translit ?: $lower);
        $clean = preg_replace('/\\s+/', ' ', $clean ?? '');

        return trim($clean ?? '');
    }

    private function isValidCuit(string $value): bool
    {
        if (! preg_match('/^\\d{11}$/', $value)) {
            return false;
        }

        $coefficients = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
        $sum = 0;
        for ($i = 0; $i < 10; $i++) {
            $sum += (int) $value[$i] * $coefficients[$i];
        }

        $mod = $sum % 11;
        $check = 11 - $mod;
        if ($check === 11) {
            $check = 0;
        } elseif ($check === 10) {
            $check = 9;
        }

        return (int) $value[10] === $check;
    }
}

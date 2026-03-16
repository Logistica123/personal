<?php

namespace App\Services\Facturacion;

use App\Models\FacturaCabecera;
use App\Support\Facturacion\CobranzaEstado;
use Carbon\CarbonInterface;

class CobranzaStateResolver
{
    public function resolve(FacturaCabecera $factura, ?CarbonInterface $today = null): CobranzaEstado
    {
        $referenceDate = $today ? $today->copy()->startOfDay() : now()->startOfDay();
        $fechaPago = $factura->fecha_pago_manual?->copy()?->startOfDay();
        $fechaAprox = $factura->fecha_aprox_cobro?->copy()?->startOfDay();
        $montoPagado = $factura->monto_pagado_manual !== null ? (float) $factura->monto_pagado_manual : null;
        $importeTotal = (float) $factura->imp_total;

        if ($montoPagado !== null && $montoPagado > 0 && $montoPagado + 0.009 < $importeTotal) {
            return CobranzaEstado::PARCIAL;
        }

        if ($fechaPago !== null || ($montoPagado !== null && $montoPagado >= $importeTotal)) {
            return CobranzaEstado::COBRADA;
        }

        if ($fechaAprox === null) {
            return CobranzaEstado::PENDIENTE;
        }

        if ($fechaAprox->greaterThan($referenceDate)) {
            return CobranzaEstado::A_VENCER;
        }

        return CobranzaEstado::VENCIDA;
    }
}

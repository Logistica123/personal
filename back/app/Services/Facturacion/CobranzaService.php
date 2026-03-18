<?php

namespace App\Services\Facturacion;

use App\Models\FacturaCabecera;
use App\Models\HistorialCobranzaFactura;
use Illuminate\Support\Facades\DB;

class CobranzaService
{
    public function __construct(
        private readonly CobranzaStateResolver $stateResolver,
        private readonly FacturacionAuditService $auditService,
    ) {
    }

    public function update(FacturaCabecera $factura, array $data, ?int $usuarioId = null, ?string $ip = null): FacturaCabecera
    {
        return DB::transaction(function () use ($factura, $data, $usuarioId, $ip) {
            $before = $factura->fresh()?->toArray() ?? $factura->toArray();
            $estadoAnterior = $factura->estado_cobranza?->value ?? (string) $factura->estado_cobranza;

            $factura->fecha_aprox_cobro = $data['fecha_aprox_cobro'] ?? $factura->fecha_aprox_cobro;
            $factura->fecha_pago_manual = $data['fecha_pago_manual'] ?? $factura->fecha_pago_manual;
            $factura->monto_pagado_manual = $data['monto_pagado_manual'] ?? $factura->monto_pagado_manual;
            $factura->observaciones_cobranza = $data['observaciones_cobranza'] ?? $factura->observaciones_cobranza;
            if (array_key_exists('op_cobro_recibo_manual', $data)) {
                $factura->op_cobro_recibo_manual = $data['op_cobro_recibo_manual'];
            }
            if (array_key_exists('op_cobro_archivo_path', $data)) {
                $factura->op_cobro_archivo_path = $data['op_cobro_archivo_path'];
            }
            if (array_key_exists('op_cobro_archivo_nombre', $data)) {
                $factura->op_cobro_archivo_nombre = $data['op_cobro_archivo_nombre'];
            }
            if (array_key_exists('forma_cobro_manual', $data)) {
                $factura->forma_cobro_manual = $data['forma_cobro_manual'];
            }
            if (array_key_exists('retenciones_gcias_manual', $data)) {
                $factura->retenciones_gcias_manual = $data['retenciones_gcias_manual'];
            }
            if (array_key_exists('otras_retenciones_manual', $data)) {
                $factura->otras_retenciones_manual = $data['otras_retenciones_manual'];
            }
            $factura->estado_cobranza = $this->stateResolver->resolve($factura);
            $factura->save();

            HistorialCobranzaFactura::query()->create([
                'factura_id' => $factura->id,
                'estado_anterior' => $estadoAnterior,
                'estado_nuevo' => $factura->estado_cobranza?->value ?? (string) $factura->estado_cobranza,
                'fecha_aprox_cobro_anterior' => $before['fecha_aprox_cobro'] ?? null,
                'fecha_aprox_cobro_nueva' => optional($factura->fecha_aprox_cobro)->format('Y-m-d'),
                'fecha_pago_anterior' => $before['fecha_pago_manual'] ?? null,
                'fecha_pago_nueva' => optional($factura->fecha_pago_manual)->format('Y-m-d'),
                'monto_pagado_anterior' => $before['monto_pagado_manual'] ?? null,
                'monto_pagado_nuevo' => $factura->monto_pagado_manual,
                'observaciones' => $factura->observaciones_cobranza,
                'usuario_id' => $usuarioId,
            ]);

            $this->auditService->record(
                'factura_cabecera',
                $factura->id,
                'cobranza.actualizada',
                $before,
                $factura->fresh()->toArray(),
                $usuarioId,
                $ip
            );

            return $factura->fresh(['historialCobranza.usuario']);
        });
    }

    public function registerPayment(FacturaCabecera $factura, string $fechaPago, ?float $montoPagado = null, ?string $observaciones = null, ?int $usuarioId = null, ?string $ip = null): FacturaCabecera
    {
        return $this->update($factura, [
            'fecha_pago_manual' => $fechaPago,
            'monto_pagado_manual' => $montoPagado ?? (float) $factura->imp_total,
            'observaciones_cobranza' => $observaciones ?? $factura->observaciones_cobranza,
        ], $usuarioId, $ip);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqOrdenPagoDetalle extends Model
{
    use HasFactory;

    protected $table = 'liq_ordenes_pago_detalle';

    protected $fillable = [
        'orden_pago_id',
        'liquidacion_distribuidor_id',
        'cliente_nombre',
        'sucursal',
        'periodo',
        'distribuidor_nombre',
        'cobrador_nombre',
        'subtotal_liquidacion',
        'gastos_admin',
        'descuento_combustible',
        'descuento_paquete',
        'descuento_ajuste',
        'otros_descuentos',
        'detalle_otros_descuentos',
        'importe_final',
    ];

    protected $casts = [
        'subtotal_liquidacion'   => 'decimal:2',
        'gastos_admin'           => 'decimal:2',
        'descuento_combustible'  => 'decimal:2',
        'descuento_paquete'      => 'decimal:2',
        'descuento_ajuste'       => 'decimal:2',
        'otros_descuentos'       => 'decimal:2',
        'importe_final'          => 'decimal:2',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function ordenPago()
    {
        return $this->belongsTo(LiqOrdenPago::class, 'orden_pago_id');
    }

    public function liquidacionDistribuidor()
    {
        return $this->belongsTo(LiqLiquidacionDistribuidor::class, 'liquidacion_distribuidor_id');
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Calcula el importe_final a partir del desglose de descuentos.
     */
    public function calcularImporteFinal(): float
    {
        return round(
            $this->subtotal_liquidacion
            - $this->gastos_admin
            - $this->descuento_combustible
            - $this->descuento_paquete
            - $this->descuento_ajuste
            - $this->otros_descuentos,
            2
        );
    }
}

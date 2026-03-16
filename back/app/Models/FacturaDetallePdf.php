<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FacturaDetallePdf extends Model
{
    use HasFactory;

    protected $table = 'factura_detalle_pdf';

    protected $fillable = [
        'factura_id',
        'orden',
        'descripcion',
        'cantidad',
        'unidad_medida',
        'precio_unitario',
        'bonificacion_pct',
        'subtotal',
        'alicuota_iva_pct',
        'subtotal_con_iva',
    ];

    protected function casts(): array
    {
        return [
            'cantidad' => 'decimal:4',
            'precio_unitario' => 'decimal:2',
            'bonificacion_pct' => 'decimal:4',
            'subtotal' => 'decimal:2',
            'alicuota_iva_pct' => 'decimal:4',
            'subtotal_con_iva' => 'decimal:2',
        ];
    }

    public function factura()
    {
        return $this->belongsTo(FacturaCabecera::class, 'factura_id');
    }
}

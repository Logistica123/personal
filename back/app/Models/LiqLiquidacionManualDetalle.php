<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiqLiquidacionManualDetalle extends Model
{
    protected $table = 'liq_liquidacion_manual_detalle';

    protected $fillable = [
        'liquidacion_distribuidor_id',
        'concepto',
        'descripcion',
        'cantidad',
        'tarifa_unitaria',
        'total_linea',
    ];

    protected $casts = [
        'cantidad' => 'decimal:3',
        'tarifa_unitaria' => 'decimal:2',
        'total_linea' => 'decimal:2',
    ];

    public function liquidacionDistribuidor()
    {
        return $this->belongsTo(LiqLiquidacionDistribuidor::class, 'liquidacion_distribuidor_id');
    }
}

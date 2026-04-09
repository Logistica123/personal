<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiqVinculacionOca extends Model
{
    protected $table = 'liq_vinculaciones_oca';

    protected $fillable = [
        'liquidacion_cliente_id',
        'fecha',
        'nro_planilla',
        'cod_contrato',
        'descripcion',
        'precio_original',
        'cantidad',
        'importe_original',
        'distribuidor_id',
        'distribuidor_nombre',
        'precio_distribuidor',
        'importe_distribuidor',
        'match_score',
        'estado',
        'formato_origen',
        'sucursal',
    ];

    protected $casts = [
        'fecha' => 'date',
        'precio_original' => 'decimal:2',
        'cantidad' => 'decimal:3',
        'importe_original' => 'decimal:2',
        'precio_distribuidor' => 'decimal:2',
        'importe_distribuidor' => 'decimal:2',
        'match_score' => 'decimal:2',
    ];

    public function liquidacion()
    {
        return $this->belongsTo(LiqLiquidacionCliente::class, 'liquidacion_cliente_id');
    }

    public function distribuidor()
    {
        return $this->belongsTo(Persona::class, 'distribuidor_id');
    }
}

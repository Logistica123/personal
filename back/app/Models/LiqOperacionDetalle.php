<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqOperacionDetalle extends Model
{
    use HasFactory;

    protected $table = 'liq_operaciones_detalle';

    protected $fillable = [
        'operacion_id',
        'parada',
        'codigo_postal',
        'distrito',
        'bultos',
        'costo',
        'costo_productividad',
        // BUGFIX 31 v2
        'material_ycc',
        'cod_regio',
        'motivo',
    ];

    protected $casts = [
        'costo' => 'decimal:2',
        'costo_productividad' => 'decimal:2',
    ];

    public function operacion()
    {
        return $this->belongsTo(LiqOperacion::class, 'operacion_id');
    }
}

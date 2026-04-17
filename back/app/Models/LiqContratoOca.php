<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiqContratoOca extends Model
{
    protected $table = 'liq_contratos_oca';

    protected $fillable = [
        'cliente_id',
        'codigo',
        'descripcion_cruda',
        'descripcion_amigable',
        'unidad_recorrido',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    public function cliente()
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }
}

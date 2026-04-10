<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiqMapeoDistribuidor extends Model
{
    protected $table = 'liq_mapeos_distribuidor';

    protected $fillable = [
        'cliente_id',
        'nombre_pdf',
        'persona_id',
        'sucursal',
        'creado_por',
    ];

    public function persona()
    {
        return $this->belongsTo(Persona::class, 'persona_id');
    }
}

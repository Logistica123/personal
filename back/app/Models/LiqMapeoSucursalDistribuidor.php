<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiqMapeoSucursalDistribuidor extends Model
{
    protected $table = 'liq_mapeos_sucursal_distribuidor';

    protected $fillable = [
        'cliente_id',
        'sucursal',
        'persona_id',
        'es_unico',
        'creado_por',
    ];

    protected $casts = [
        'es_unico' => 'boolean',
    ];

    public function cliente()
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }

    public function persona()
    {
        return $this->belongsTo(Persona::class, 'persona_id');
    }
}

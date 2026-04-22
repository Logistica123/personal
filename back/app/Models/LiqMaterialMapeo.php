<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiqMaterialMapeo extends Model
{
    protected $table = 'liq_material_mapeo';

    protected $fillable = [
        'cliente_id',
        'codigo_ycc',
        'material_tarifario',
        'descripcion',
    ];

    public function cliente()
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }
}

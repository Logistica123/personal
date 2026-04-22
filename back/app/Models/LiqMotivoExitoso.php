<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiqMotivoExitoso extends Model
{
    protected $table = 'liq_motivos_exitosos';

    protected $fillable = [
        'cliente_id',
        'codigo',
        'es_exitoso',
        'descripcion',
    ];

    protected $casts = [
        'es_exitoso' => 'boolean',
    ];

    public function cliente()
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }
}

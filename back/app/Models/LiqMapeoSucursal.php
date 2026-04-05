<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqMapeoSucursal extends Model
{
    use HasFactory;

    protected $table = 'liq_mapeos_sucursal';

    protected $fillable = [
        'cliente_id',
        'patron_archivo',
        'sucursal_tarifa',
        'tipo_operacion',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function cliente()
    {
        return $this->belongsTo(\App\Models\LiqCliente::class, 'cliente_id');
    }

    // -------------------------------------------------------------------------
    // Scopes
    // -------------------------------------------------------------------------

    public function scopeActivo($q)
    {
        return $q->where('activo', true);
    }
}

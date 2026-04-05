<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqMapeoConcepto extends Model
{
    use HasFactory;

    protected $table = 'liq_mapeos_concepto';

    protected $fillable = [
        'cliente_id',
        'valor_excel',
        'dimension_destino',
        'valor_tarifa',
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

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqEsquemaTarifario extends Model
{
    use HasFactory;

    protected $table = 'liq_esquemas_tarifarios';

    protected $fillable = [
        'cliente_id',
        'nombre',
        'descripcion',
        'dimensiones',
        'activo',
    ];

    protected $casts = [
        'dimensiones' => 'array',
        'activo'      => 'boolean',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function cliente()
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }

    public function dimensionValores()
    {
        return $this->hasMany(LiqDimensionValor::class, 'esquema_id');
    }

    public function lineasTarifa()
    {
        return $this->hasMany(LiqLineaTarifa::class, 'esquema_id');
    }

    // -------------------------------------------------------------------------
    // Scopes
    // -------------------------------------------------------------------------

    public function scopeActivo($q)
    {
        return $q->where('activo', true);
    }
}

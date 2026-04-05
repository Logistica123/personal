<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqDimensionValor extends Model
{
    use HasFactory;

    protected $table = 'liq_dimension_valores';

    protected $fillable = [
        'esquema_id',
        'nombre_dimension',
        'valor',
        'orden_display',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function esquema()
    {
        return $this->belongsTo(LiqEsquemaTarifario::class, 'esquema_id');
    }

    // -------------------------------------------------------------------------
    // Scopes
    // -------------------------------------------------------------------------

    public function scopeActivo($q)
    {
        return $q->where('activo', true);
    }

    public function scopeDimension($q, string $dim)
    {
        return $q->where('nombre_dimension', $dim);
    }
}

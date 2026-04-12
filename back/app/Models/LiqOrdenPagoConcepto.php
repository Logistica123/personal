<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqOrdenPagoConcepto extends Model
{
    use HasFactory;

    protected $table = 'liq_ordenes_pago_conceptos';

    protected $fillable = [
        'nombre',
        'codigo',
        'ultimo_numero',
        'activo',
    ];

    protected $casts = [
        'ultimo_numero' => 'integer',
        'activo'        => 'boolean',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function ordenesPago()
    {
        return $this->hasMany(LiqOrdenPago::class, 'concepto_id');
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Devuelve el proximo numero correlativo sugerido para este concepto.
     */
    public function proximoNumero(): int
    {
        $max = $this->ordenesPago()->max('numero') ?? 0;

        return max($max, $this->ultimo_numero) + 1;
    }

    // -------------------------------------------------------------------------
    // Scopes
    // -------------------------------------------------------------------------

    public function scopeActivo($query)
    {
        return $query->where('activo', true);
    }
}

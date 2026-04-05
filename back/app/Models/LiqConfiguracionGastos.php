<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqConfiguracionGastos extends Model
{
    use HasFactory;

    protected $table = 'liq_configuracion_gastos';

    protected $fillable = [
        'cliente_id',
        'concepto_gasto',
        'monto',
        'tipo',
        'vigencia_desde',
        'vigencia_hasta',
        'activo',
    ];

    protected $casts = [
        'monto'          => 'decimal:2',
        'activo'         => 'boolean',
        'vigencia_desde' => 'date',
        'vigencia_hasta' => 'date',
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

    public function scopeVigente($q, string $fecha)
    {
        return $q->where('activo', true)
                 ->where('vigencia_desde', '<=', $fecha)
                 ->where(function ($sub) use ($fecha) {
                     $sub->whereNull('vigencia_hasta')
                         ->orWhere('vigencia_hasta', '>=', $fecha);
                 });
    }
}

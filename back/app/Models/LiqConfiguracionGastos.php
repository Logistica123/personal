<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiqConfiguracionGastos extends Model
{
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

    protected function casts(): array
    {
        return [
            'monto'          => 'decimal:2',
            'vigencia_desde' => 'date',
            'vigencia_hasta' => 'date',
            'activo'         => 'boolean',
        ];
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }
}

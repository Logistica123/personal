<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LiqPago extends Model
{
    protected $table = 'liq_pagos';

    protected $fillable = [
        'cliente_id',
        'periodo_desde',
        'periodo_hasta',
        'fecha_generacion',
        'usuario_id',
        'estado',
        'cantidad_items',
        'total_monto',
        'fecha_pago',
        'referencia',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'periodo_desde'    => 'date',
            'periodo_hasta'    => 'date',
            'fecha_generacion' => 'datetime',
            'fecha_pago'       => 'datetime',
            'cantidad_items'   => 'integer',
            'total_monto'      => 'decimal:2',
            'metadata'         => 'array',
        ];
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(LiqPagoItem::class, 'pago_id');
    }
}


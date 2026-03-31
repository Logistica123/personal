<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiqMapeoConcepto extends Model
{
    protected $table = 'liq_mapeos_concepto';

    protected $fillable = [
        'cliente_id',
        'valor_excel',
        'dimension_destino',
        'valor_tarifa',
        'activo',
    ];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }
}

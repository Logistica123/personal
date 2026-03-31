<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiqDimensionValor extends Model
{
    protected $table = 'liq_dimension_valores';

    protected $fillable = [
        'esquema_id',
        'nombre_dimension',
        'valor',
        'orden_display',
        'activo',
    ];

    protected function casts(): array
    {
        return [
            'orden_display' => 'integer',
            'activo'        => 'boolean',
        ];
    }

    public function esquema(): BelongsTo
    {
        return $this->belongsTo(LiqEsquemaTarifario::class, 'esquema_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiqPagoItem extends Model
{
    protected $table = 'liq_pago_items';

    protected $fillable = [
        'pago_id',
        'liquidacion_distribuidor_id',
        'distribuidor_id',
        'monto',
        'cbu_alias',
    ];

    protected function casts(): array
    {
        return [
            'monto' => 'decimal:2',
        ];
    }

    public function pago(): BelongsTo
    {
        return $this->belongsTo(LiqPago::class, 'pago_id');
    }

    public function liquidacionDistribuidor(): BelongsTo
    {
        return $this->belongsTo(LiqLiquidacionDistribuidor::class, 'liquidacion_distribuidor_id');
    }

    public function distribuidor(): BelongsTo
    {
        return $this->belongsTo(Persona::class, 'distribuidor_id');
    }
}


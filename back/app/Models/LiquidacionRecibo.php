<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiquidacionRecibo extends Model
{
    use HasFactory;

    protected $table = 'liquidacion_recibos';

    protected $fillable = [
        'punto_venta',
        'numero_recibo',
        'fecha',
        'estado',
        'draft',
        'total_cobro',
        'total_imputado',
        'emitido_por',
        'anulado_por',
        'anulado_at',
        'anulado_leyenda',
        'anulado_motivo',
    ];

    protected function casts(): array
    {
        return [
            'fecha' => 'date',
            'draft' => 'array',
            'total_cobro' => 'decimal:2',
            'total_imputado' => 'decimal:2',
            'anulado_at' => 'datetime',
        ];
    }

    public function emisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'emitido_por');
    }

    public function anulador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'anulado_por');
    }
}

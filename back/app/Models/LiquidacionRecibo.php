<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiquidacionRecibo extends Model
{
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

    public function emitidoPor()
    {
        return $this->belongsTo(User::class, 'emitido_por');
    }

    public function anuladoPor()
    {
        return $this->belongsTo(User::class, 'anulado_por');
    }
}

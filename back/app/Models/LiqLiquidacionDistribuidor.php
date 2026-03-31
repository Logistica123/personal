<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiqLiquidacionDistribuidor extends Model
{
    protected $table = 'liq_liquidaciones_distribuidor';

    protected $fillable = [
        'liquidacion_cliente_id',
        'distribuidor_id',
        'periodo_desde',
        'periodo_hasta',
        'fecha_generacion',
        'cantidad_operaciones',
        'subtotal',
        'gastos_administrativos',
        'total_a_pagar',
        'estado',
        'pago_id',
        'fecha_pago',
        'pagado_por',
        'pago_referencia',
        'pdf_path',
    ];

    protected function casts(): array
    {
        return [
            'periodo_desde'          => 'date',
            'periodo_hasta'          => 'date',
            'fecha_generacion'       => 'datetime',
            'fecha_pago'             => 'datetime',
            'cantidad_operaciones'   => 'integer',
            'subtotal'               => 'decimal:2',
            'gastos_administrativos' => 'decimal:2',
            'total_a_pagar'          => 'decimal:2',
        ];
    }

    public function liquidacionCliente(): BelongsTo
    {
        return $this->belongsTo(LiqLiquidacionCliente::class, 'liquidacion_cliente_id');
    }

    public function distribuidor(): BelongsTo
    {
        return $this->belongsTo(Persona::class, 'distribuidor_id');
    }

    public function pago(): BelongsTo
    {
        return $this->belongsTo(LiqPago::class, 'pago_id');
    }

    /** URL pública del PDF (si existe). */
    public function getPdfUrlAttribute(): ?string
    {
        return $this->pdf_path ? asset('storage/' . $this->pdf_path) : null;
    }
}

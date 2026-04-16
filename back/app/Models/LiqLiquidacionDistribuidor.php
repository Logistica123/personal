<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqLiquidacionDistribuidor extends Model
{
    use HasFactory;

    protected $table = 'liq_liquidaciones_distribuidor';

    // -------------------------------------------------------------------------
    // Estado constants
    // -------------------------------------------------------------------------

    const ESTADO_GENERADA  = 'generada';
    const ESTADO_APROBADA  = 'aprobada';
    const ESTADO_PAGADA    = 'pagada';
    const ESTADO_ANULADA   = 'anulada';

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
        'pdf_path',
        'beneficio_seguro',
        'subtotal_peajes',
    ];

    protected $casts = [
        'periodo_desde'          => 'date',
        'periodo_hasta'          => 'date',
        'fecha_generacion'       => 'datetime',
        'subtotal'               => 'decimal:2',
        'gastos_administrativos' => 'decimal:2',
        'total_a_pagar'          => 'decimal:2',
        'beneficio_seguro'       => 'decimal:2',
        'subtotal_peajes'        => 'decimal:2',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function liquidacionCliente()
    {
        return $this->belongsTo(LiqLiquidacionCliente::class, 'liquidacion_cliente_id');
    }

    public function distribuidor()
    {
        return $this->belongsTo(\App\Models\Persona::class, 'distribuidor_id');
    }

    public function ordenPagoDetalle()
    {
        return $this->hasOne(LiqOrdenPagoDetalle::class, 'liquidacion_distribuidor_id');
    }

    /**
     * Indica si esta liquidacion ya esta incluida en una OP activa (no anulada).
     */
    public function tieneOrdenPagoActiva(): bool
    {
        return $this->ordenPagoDetalle()
            ->whereHas('ordenPago', fn ($q) => $q->activas())
            ->exists();
    }

    /**
     * Indica si esta liquidacion esta disponible para incluir en una nueva OP.
     */
    public function disponibleParaPago(): bool
    {
        return in_array($this->estado, [self::ESTADO_GENERADA, self::ESTADO_APROBADA])
            && !$this->tieneOrdenPagoActiva();
    }
}

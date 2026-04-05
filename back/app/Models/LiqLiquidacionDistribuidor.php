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
    ];

    protected $casts = [
        'periodo_desde'          => 'date',
        'periodo_hasta'          => 'date',
        'fecha_generacion'       => 'datetime',
        'subtotal'               => 'decimal:2',
        'gastos_administrativos' => 'decimal:2',
        'total_a_pagar'          => 'decimal:2',
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
}

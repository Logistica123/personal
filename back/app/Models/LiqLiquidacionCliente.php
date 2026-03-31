<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LiqLiquidacionCliente extends Model
{
    protected $table = 'liq_liquidaciones_cliente';

    protected $fillable = [
        'cliente_id',
        'archivo_origen',
        'sucursal_tarifa',
        'periodo_desde',
        'periodo_hasta',
        'fecha_carga',
        'usuario_carga',
        'estado',
        'total_operaciones',
        'total_importe_cliente',
        'total_importe_correcto',
        'total_diferencia',
    ];

    protected function casts(): array
    {
        return [
            'periodo_desde'          => 'date',
            'periodo_hasta'          => 'date',
            'fecha_carga'            => 'datetime',
            'total_operaciones'      => 'integer',
            'total_importe_cliente'  => 'decimal:2',
            'total_importe_correcto' => 'decimal:2',
            'total_diferencia'       => 'decimal:2',
        ];
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }

    public function usuarioCarga(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_carga');
    }

    public function operaciones(): HasMany
    {
        return $this->hasMany(LiqOperacion::class, 'liquidacion_cliente_id');
    }

    public function liquidacionesDistribuidor(): HasMany
    {
        return $this->hasMany(LiqLiquidacionDistribuidor::class, 'liquidacion_cliente_id');
    }

    /** Recalcula los totales desde las operaciones y persiste. */
    public function recalcularTotales(): void
    {
        $ops = $this->operaciones()->where('excluida', false)->get();

        $this->total_operaciones      = $ops->count();
        $this->total_importe_cliente  = $ops->sum('valor_cliente');
        $this->total_importe_correcto = $ops->whereIn('estado', ['ok', 'diferencia'])->sum('valor_tarifa_original');
        $this->total_diferencia       = $ops->whereIn('estado', ['diferencia'])->sum('diferencia_cliente');
        $this->save();
    }
}

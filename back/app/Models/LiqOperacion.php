<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiqOperacion extends Model
{
    protected $table = 'liq_operaciones';

    protected $fillable = [
        'liquidacion_cliente_id',
        'campos_originales',
        'dominio',
        'concepto',
        'valor_cliente',
        'linea_tarifa_id',
        'valor_tarifa_original',
        'valor_tarifa_distribuidor',
        'porcentaje_agencia',
        'diferencia_cliente',
        'estado',
        'distribuidor_id',
        'observacion',
        'excluida',
        'motivo_exclusion',
        'excluida_at',
        'excluida_por',
    ];

    protected function casts(): array
    {
        return [
            'campos_originales'        => 'array',
            'valor_cliente'            => 'decimal:2',
            'valor_tarifa_original'    => 'decimal:2',
            'valor_tarifa_distribuidor'=> 'decimal:2',
            'porcentaje_agencia'       => 'decimal:2',
            'diferencia_cliente'       => 'decimal:2',
            'excluida'                 => 'boolean',
            'excluida_at'              => 'datetime',
        ];
    }

    public function liquidacionCliente(): BelongsTo
    {
        return $this->belongsTo(LiqLiquidacionCliente::class, 'liquidacion_cliente_id');
    }

    public function lineaTarifa(): BelongsTo
    {
        return $this->belongsTo(LiqLineaTarifa::class, 'linea_tarifa_id');
    }

    public function distribuidor(): BelongsTo
    {
        return $this->belongsTo(Persona::class, 'distribuidor_id');
    }

    /** Normaliza una patente: mayúsculas, sin espacios ni guiones. */
    public static function normalizarPatente(string $raw): string
    {
        return strtoupper(preg_replace('/[\s\-]/', '', $raw));
    }
}

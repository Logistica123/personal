<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LiqLineaTarifa extends Model
{
    protected $table = 'liq_lineas_tarifa';

    protected $fillable = [
        'esquema_id',
        'dimensiones_valores',
        'precio_original',
        'porcentaje_agencia',
        'precio_distribuidor',
        'vigencia_desde',
        'vigencia_hasta',
        'creado_por',
        'aprobado_por',
        'fecha_aprobacion',
        'activo',
    ];

    protected function casts(): array
    {
        return [
            'dimensiones_valores' => 'array',
            'precio_original'     => 'decimal:2',
            'porcentaje_agencia'  => 'decimal:2',
            'precio_distribuidor' => 'decimal:2',
            'vigencia_desde'      => 'date',
            'vigencia_hasta'      => 'date',
            'fecha_aprobacion'    => 'datetime',
            'activo'              => 'boolean',
        ];
    }

    /** Calcula y setea precio_distribuidor desde precio_original y porcentaje_agencia. */
    public static function calcularPrecioDistribuidor(float $precioOriginal, float $pctAgencia): float
    {
        return round($precioOriginal * (1 - $pctAgencia / 100), 2);
    }

    public function esquema(): BelongsTo
    {
        return $this->belongsTo(LiqEsquemaTarifario::class, 'esquema_id');
    }

    public function creadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    public function aprobadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'aprobado_por');
    }

    public function auditorias(): HasMany
    {
        return $this->hasMany(LiqAuditoriaTarifa::class, 'linea_tarifa_id');
    }
}

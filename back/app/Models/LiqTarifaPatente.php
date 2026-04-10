<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqTarifaPatente extends Model
{
    use HasFactory;

    protected $table = 'liq_tarifas_patente';

    protected $fillable = [
        'esquema_id',
        'patente_norm',
        'dimensiones_valores',
        'linea_tarifa_id',
        'vigencia_desde',
        'vigencia_hasta',
        'creado_por',
        'activo',
        'modo_calculo',
        'valor_referencia',
    ];

    protected $casts = [
        'dimensiones_valores' => 'array',
        'activo' => 'boolean',
        'vigencia_desde' => 'date',
        'vigencia_hasta' => 'date',
    ];

    public function esquema()
    {
        return $this->belongsTo(LiqEsquemaTarifario::class, 'esquema_id');
    }

    public function lineaTarifa()
    {
        return $this->belongsTo(LiqLineaTarifa::class, 'linea_tarifa_id');
    }

    public function creadoPor()
    {
        return $this->belongsTo(User::class, 'creado_por');
    }
}


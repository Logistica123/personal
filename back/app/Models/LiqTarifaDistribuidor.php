<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * SPEC v4 · Tarifa LA → Distribuidor configurable por dimensiones.
 *
 * Cada fila es una "tarjeta" con dimensiones opcionales. Más dimensiones especificadas
 * (NOT NULL) = más específica = mayor prioridad. El resolver toma la más específica
 * que matchee la op + parada YCC.
 */
class LiqTarifaDistribuidor extends Model
{
    protected $table = 'liq_tarifas_distribuidor';

    protected $fillable = [
        'cliente_id',
        'ruta',
        'sucursal',
        'distrito',
        'material_la',
        'zona',
        'motivo',
        'capacidad_vehiculo',
        'patente',
        'distribuidor_id',
        'tipo_tarifa',
        'valor',
        'aplica_multibulto',
        'vigencia_desde',
        'vigencia_hasta',
        'notas',
    ];

    protected $casts = [
        'valor'             => 'decimal:4',
        'aplica_multibulto' => 'boolean',
        'vigencia_desde'    => 'date',
        'vigencia_hasta'    => 'date',
        'capacidad_vehiculo'=> 'integer',
        'prioridad'         => 'integer',
    ];

    public function cliente()
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }
}

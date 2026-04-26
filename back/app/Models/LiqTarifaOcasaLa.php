<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * SPEC v4.2 · Tarifa OCASA → LA esperada por dimensiones.
 *
 * El detector de subpago compara YCC.costo (lo que OCASA pagó) contra `valor` (lo que
 * debería pagar según contrato). Si YCC.costo < valor × umbral, registra reclamo en
 * liq_reclamos_ocasa.
 */
class LiqTarifaOcasaLa extends Model
{
    protected $table = 'liq_tarifas_ocasa_la';

    protected $fillable = [
        'cliente_id',
        'ruta',
        'sucursal',
        'distrito',
        'material_la',
        'zona',
        'motivo',
        'capacidad_vehiculo',
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

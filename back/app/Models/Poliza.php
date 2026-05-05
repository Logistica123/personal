<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Poliza extends Model
{
    use HasFactory;

    protected $table = 'polizas';

    protected $fillable = [
        'aseguradora_id',
        'nombre_descriptivo',
        'ramo',
        'subramo',
        'tipo_asegurado',
        'numero_poliza',
        'numero_cuenta_cliente',
        'vigencia_desde',
        'vigencia_hasta',
        'tomador_cuit',
        'tomador_razon_social',
        'tomador_domicilio',
        'suma_asegurada_total',
        'premio_anual',
        'cantidad_vidas_unidades',
        'clausulas_especiales',
        'alerta_dias_antes_vencimiento',
        'activa',
        'notas',
    ];

    protected $casts = [
        'vigencia_desde'        => 'date',
        'vigencia_hasta'        => 'date',
        'suma_asegurada_total'  => 'decimal:2',
        'premio_anual'          => 'decimal:2',
        'activa'                => 'boolean',
    ];

    public function aseguradora()
    {
        return $this->belongsTo(PolizaAseguradora::class, 'aseguradora_id');
    }

    public function emailConfigs()
    {
        return $this->hasMany(PolizaEmailConfig::class, 'poliza_id');
    }

    public function endosos()
    {
        return $this->hasMany(PolizaEndoso::class, 'poliza_id')->orderByDesc('fecha_emision');
    }

    public function asegurados()
    {
        return $this->hasMany(PolizaAsegurado::class, 'poliza_id');
    }

    public function solicitudes()
    {
        return $this->hasMany(PolizaSolicitud::class, 'poliza_id');
    }

    public function clausulasAplicadas()
    {
        return $this->hasMany(PolizaClausulaAplicada::class, 'poliza_id');
    }

    /** Cláusulas vigentes (sin `aplicada_hasta` o futura). */
    public function clausulasVigentes()
    {
        return $this->hasMany(PolizaClausulaAplicada::class, 'poliza_id')
            ->whereNull('aplicada_hasta')
            ->with('clausula');
    }
}

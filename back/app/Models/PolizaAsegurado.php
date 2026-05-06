<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PolizaAsegurado extends Model
{
    use HasFactory;

    protected $table = 'polizas_asegurados';

    protected $fillable = [
        'poliza_id',
        'persona_id',
        'tipo_asegurado',
        'identificador',
        'identificador_tipo',
        'numero_orden_aseguradora',
        'nombre_apellido_pdf',
        'marca_modelo_pdf',
        'tipo_vehiculo_pdf',
        'localidad_pdf',
        'fecha_nacimiento_pdf',
        'suma_asegurada',
        'premio_individual',
        'alta_endoso_id',
        'baja_endoso_id',
        'fecha_alta_efectiva',
        'fecha_baja_efectiva',
        'estado',
        'match_score',
        'match_metodo',
        'persona_estado_al_matchear',
        'persona_alerta_estado',
        'sugerencia_fuzzy_persona_id',
        'sugerencia_fuzzy_score',
        'revision_manual_pendiente',
        'notas',
    ];

    protected $casts = [
        'fecha_nacimiento_pdf'      => 'date',
        'fecha_alta_efectiva'       => 'date',
        'fecha_baja_efectiva'       => 'date',
        'suma_asegurada'            => 'decimal:2',
        'premio_individual'         => 'decimal:2',
        'match_score'               => 'decimal:3',
        'sugerencia_fuzzy_score'    => 'decimal:3',
        'revision_manual_pendiente' => 'boolean',
    ];

    public function poliza()
    {
        return $this->belongsTo(Poliza::class, 'poliza_id');
    }

    public function persona()
    {
        return $this->belongsTo(Persona::class, 'persona_id');
    }

    public function sugerenciaFuzzyPersona()
    {
        return $this->belongsTo(Persona::class, 'sugerencia_fuzzy_persona_id');
    }

    public function altaEndoso()
    {
        return $this->belongsTo(PolizaEndoso::class, 'alta_endoso_id');
    }

    public function bajaEndoso()
    {
        return $this->belongsTo(PolizaEndoso::class, 'baja_endoso_id');
    }
}

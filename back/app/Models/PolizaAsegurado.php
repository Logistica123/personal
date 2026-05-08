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
        'eliminado_en',
        'eliminado_por_user_id',
        'motivo_eliminacion',
    ];

    /**
     * ADDENDUM 12 Parte E — global scope que excluye los asegurados eliminados
     * de TODAS las queries por default. Para auditoría se usa
     * `PolizaAsegurado::withTrashed()` (helper local abajo).
     */
    protected static function booted(): void
    {
        static::addGlobalScope('noEliminados', function ($q) {
            $q->whereNull('polizas_asegurados.eliminado_en');
        });
    }

    /** Equivalente a `withTrashed()` del trait nativo — incluye eliminados. */
    public function scopeIncluyendoEliminados($query)
    {
        return $query->withoutGlobalScope('noEliminados');
    }

    /** Solo eliminados — para la pantalla de auditoría. */
    public function scopeSoloEliminados($query)
    {
        return $query->withoutGlobalScope('noEliminados')->whereNotNull('eliminado_en');
    }

    protected $casts = [
        'fecha_nacimiento_pdf'      => 'date',
        'fecha_alta_efectiva'       => 'date',
        'fecha_baja_efectiva'       => 'date',
        'eliminado_en'              => 'datetime',
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

    /** ADDENDUM 10 Parte B — comentarios histórico (autor + timestamp). */
    public function comentarios()
    {
        return $this->hasMany(PolizaAseguradoComentario::class, 'asegurado_id')
            ->orderByDesc('created_at');
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

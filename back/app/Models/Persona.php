<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Cliente;
use App\Models\Unidad;
use App\Models\Sucursal;
use App\Models\User;
use App\Models\Estado;
use App\Models\Archivo;
use App\Models\Dueno;
use App\Models\PersonaComment;
use App\Models\PersonaHistory;
use App\Models\PersonaPatente;
use App\Models\TransportistaQrAccessLog;

class Persona extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'personas';

    protected $fillable = [
        'apellidos',
        'nombres',
        'legajo',
        'cuil',
        'telefono',
        'email',
        'pago',
        'cbu_alias',
        'medio_pago',
        'combustible',
        'combustible_estado',
        'es_cobrador',
        'cobrador_nombre',
        'cobrador_email',
        'cobrador_cuil',
        'cobrador_cbu_alias',
        'membresia_desde',
        'unidad_id',
        'cliente_id',
        'sucursal_id',
        'agente_id',
        'agente_responsable_id',
        'agentes_responsables_ids',
        'estado_id',
        'tipo',
        'patente',
        'capacidad_vehiculo_kg',
        'paga_peajes',
        'tarifaespecial',
        'observaciontarifa',
        'observaciones',
        'aprobado',
        'aprobado_at',
        'aprobado_por',
        'fecha_alta',
        'fecha_baja',
        'es_solicitud',
        'retener_pago',
        'retener_pago_motivo',
    ];

    protected $dates = [
        'fecha_alta',
        'fecha_baja',
        'aprobado_at',
        'membresia_desde',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected $casts = [
        'agentes_responsables_ids' => 'array',
        'paga_peajes' => 'boolean',
    ];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class);
    }

    public function unidad()
    {
        return $this->belongsTo(Unidad::class);
    }

    public function sucursal()
    {
        return $this->belongsTo(Sucursal::class);
    }

    public function agente()
    {
        return $this->belongsTo(User::class, 'agente_id');
    }

    public function agenteResponsable()
    {
        return $this->belongsTo(User::class, 'agente_responsable_id');
    }

    public function estado()
    {
        return $this->belongsTo(Estado::class, 'estado_id');
    }

    public function documentos()
    {
        return $this->hasMany(Archivo::class, 'persona_id');
    }

    public function documentosVencimientos()
    {
        return $this->hasMany(Archivo::class, 'persona_id');
    }

    public function dueno()
    {
        return $this->hasOne(Dueno::class, 'persona_id');
    }

    public function aprobadoPor()
    {
        return $this->belongsTo(User::class, 'aprobado_por');
    }

    public function comments()
    {
        return $this->hasMany(PersonaComment::class, 'persona_id')->orderByDesc('created_at');
    }

    public function histories()
    {
        return $this
            ->hasMany(PersonaHistory::class, 'persona_id')
            ->orderByDesc('created_at');
    }

    public function transportistaQrAccessLogs()
    {
        return $this
            ->hasMany(TransportistaQrAccessLog::class, 'persona_id')
            ->orderByDesc('created_at');
    }

    public function patentesAdicionales()
    {
        return $this->hasMany(PersonaPatente::class, 'persona_id')
            ->where('activo', true)
            ->orderBy('patente');
    }

    public function taxProfile()
    {
        return $this->hasOne(TaxProfile::class, 'entity_id')
            ->where('entity_type', 'persona');
    }

    public function ordenesPagoBeneficiario()
    {
        return $this->hasMany(LiqOrdenPago::class, 'beneficiario_id');
    }

    /**
     * ADDENDUM 9 Parte C — pólizas en las que el distribuidor figura como
     * asegurado activo (estado='activo'). Usada en el listado de /personal
     * para mostrar la columna "Pólizas vigentes" y los filtros de cobertura.
     */
    public function polizasVigentes()
    {
        return $this->hasMany(\App\Models\PolizaAsegurado::class, 'persona_id')
            ->where('estado', 'activo')
            ->with('poliza:id,nombre_descriptivo,numero_poliza,ramo,tipo_asegurado,aseguradora_id,activa',
                   'poliza.aseguradora:id,nombre,parser_perfil');
    }

    // ─── ADDENDUM 10 Parte C — relaciones titular ↔ chofer ────────────────────
    //
    // Cada Persona puede:
    //  - Ser titular de N choferes (vista "tab Choferes" del titular).
    //  - Ser chofer de N titulares (caso edge: maneja para varios dueños).
    //
    // Las relaciones se filtran por `activo=true` para excluir desvinculados.

    /** Relaciones donde ESTA persona es titular (sus choferes). */
    public function relacionesComoTitular()
    {
        return $this->hasMany(\App\Models\PersonaRelacionChofer::class, 'titular_persona_id')
            ->where('activo', true);
    }

    /**
     * ADDENDUM 13 Parte A — todas las relaciones (activas + históricas).
     * Necesario para el export CSV que incluye choferes desvinculados con su
     * `fecha_desvinculacion`.
     */
    public function relacionesComoTitularHistoricas()
    {
        return $this->hasMany(\App\Models\PersonaRelacionChofer::class, 'titular_persona_id')
            ->orderBy('fecha_vinculacion');
    }

    /** Relaciones donde ESTA persona es chofer (sus titulares). */
    public function relacionesComoChofer()
    {
        return $this->hasMany(\App\Models\PersonaRelacionChofer::class, 'chofer_persona_id')
            ->where('activo', true);
    }

    /** Choferes vinculados (atajo via belongsToMany). */
    public function choferes()
    {
        return $this->belongsToMany(
            self::class,
            'personas_relacion_chofer',
            'titular_persona_id',
            'chofer_persona_id'
        )
            ->withPivot(['id', 'fecha_vinculacion', 'fecha_desvinculacion', 'rol', 'notas', 'activo'])
            ->wherePivot('activo', true)
            ->withTimestamps();
    }

    /** Titulares para los que esta persona maneja como chofer. */
    public function titulares()
    {
        return $this->belongsToMany(
            self::class,
            'personas_relacion_chofer',
            'chofer_persona_id',
            'titular_persona_id'
        )
            ->withPivot(['id', 'fecha_vinculacion', 'fecha_desvinculacion', 'rol', 'notas', 'activo'])
            ->wherePivot('activo', true)
            ->withTimestamps();
    }

    /**
     * Determina si este distribuidor tiene un cobrador designado.
     */
    public function tieneCobrador(): bool
    {
        return $this->es_cobrador && !empty($this->cobrador_cuil) && !empty($this->cobrador_cbu_alias);
    }

    /**
     * Devuelve los datos del beneficiario real (cobrador si existe, sino el distribuidor).
     * Retorna [tipo, nombre, cuil, cbu].
     */
    public function datosBeneficiario(): array
    {
        if ($this->tieneCobrador()) {
            return [
                'tipo'   => 'COBRADOR',
                'nombre' => $this->cobrador_nombre ?? ($this->apellidos . ', ' . $this->nombres . ' (cobrador)'),
                'cuil'   => $this->cobrador_cuil,
                'cbu'    => $this->cobrador_cbu_alias,
            ];
        }

        return [
            'tipo'   => 'DISTRIBUIDOR',
            'nombre' => trim($this->apellidos . ', ' . $this->nombres),
            'cuil'   => $this->cuil,
            'cbu'    => $this->cbu_alias,
        ];
    }
}

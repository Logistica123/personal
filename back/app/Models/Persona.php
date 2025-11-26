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

class Persona extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'personas';

    protected $fillable = [
        'apellidos',
        'nombres',
        'cuil',
        'telefono',
        'email',
        'pago',
        'cbu_alias',
        'combustible',
        'combustible_estado',
        'unidad_id',
        'cliente_id',
        'sucursal_id',
        'agente_id',
        'agente_responsable_id',
        'agentes_responsables_ids',
        'estado_id',
        'tipo',
        'patente',
        'tarifaespecial',
        'observaciontarifa',
        'observaciones',
        'aprobado',
        'aprobado_at',
        'aprobado_por',
        'fecha_alta',
        'fecha_baja',
        'es_solicitud',
    ];

    protected $dates = [
        'fecha_alta',
        'fecha_baja',
        'aprobado_at',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected $casts = [
        'agentes_responsables_ids' => 'array',
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
}

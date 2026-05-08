<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PersonaRelacionChofer extends Model
{
    use HasFactory;

    protected $table = 'personas_relacion_chofer';

    protected $fillable = [
        'titular_persona_id',
        'chofer_persona_id',
        'fecha_vinculacion',
        'fecha_desvinculacion',
        'rol',
        'notas',
        'activo',
        'creado_por_user_id',
    ];

    protected $casts = [
        'fecha_vinculacion'    => 'date',
        'fecha_desvinculacion' => 'date',
        'activo'               => 'boolean',
    ];

    public function titular()
    {
        return $this->belongsTo(Persona::class, 'titular_persona_id');
    }

    public function chofer()
    {
        return $this->belongsTo(Persona::class, 'chofer_persona_id');
    }

    public function creadoPor()
    {
        return $this->belongsTo(User::class, 'creado_por_user_id');
    }
}

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
        'unidad_id',
        'cliente_id',
        'sucursal_id',
        'agente_id',
        'estado_id',
        'tipo',
        'patente',
        'tarifaespecial',
        'observaciontarifa',
        'observaciones',
        'fecha_alta',
    ];

    protected $dates = [
        'fecha_alta',
        'created_at',
        'updated_at',
        'deleted_at',
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

    public function estado()
    {
        return $this->belongsTo(Estado::class, 'estado_id');
    }

    public function documentos()
    {
        return $this->hasMany(Archivo::class, 'persona_id');
    }
}

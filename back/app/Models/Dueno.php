<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Dueno extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'duenos';

    protected $fillable = [
        'persona_id',
        'nombreapellido',
        'fecha_nacimiento',
        'cuil',
        'cuil_cobrador',
        'cbu_alias',
        'email',
        'telefono',
        'observaciones',
    ];

    protected $dates = [
        'fecha_nacimiento',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    public function persona()
    {
        return $this->belongsTo(Persona::class);
    }
}


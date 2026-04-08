<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PersonaPatente extends Model
{
    protected $table = 'persona_patentes';

    protected $fillable = [
        'persona_id',
        'patente',
        'patente_norm',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    public function persona()
    {
        return $this->belongsTo(Persona::class, 'persona_id');
    }
}

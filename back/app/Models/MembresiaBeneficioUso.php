<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MembresiaBeneficioUso extends Model
{
    protected $table = 'membresia_beneficio_usos';

    protected $fillable = [
        'persona_id',
        'tramo',
        'beneficio_key',
        'beneficio_label',
        'fecha_uso',
        'observaciones',
    ];

    protected $dates = ['fecha_uso'];

    public function persona(): BelongsTo
    {
        return $this->belongsTo(Persona::class);
    }
}

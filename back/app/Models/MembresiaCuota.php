<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MembresiaCuota extends Model
{
    protected $table = 'membresia_cuotas';

    protected $fillable = [
        'persona_id',
        'periodo',
        'monto',
        'pagado',
        'fecha_pago',
        'observaciones',
    ];

    protected $dates = ['fecha_pago'];

    public function persona(): BelongsTo
    {
        return $this->belongsTo(Persona::class);
    }
}

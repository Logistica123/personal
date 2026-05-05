<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PolizaClausulaAplicada extends Model
{
    use HasFactory;

    protected $table = 'polizas_clausulas_aplicadas';

    protected $fillable = [
        'poliza_id',
        'clausula_id',
        'tipo_aplicacion',
        'aplicada_desde',
        'aplicada_hasta',
        'notas',
    ];

    protected $casts = [
        'aplicada_desde' => 'date',
        'aplicada_hasta' => 'date',
    ];

    public function poliza()
    {
        return $this->belongsTo(Poliza::class, 'poliza_id');
    }

    public function clausula()
    {
        return $this->belongsTo(PolizaClausula::class, 'clausula_id');
    }
}

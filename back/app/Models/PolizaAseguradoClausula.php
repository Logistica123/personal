<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PolizaAseguradoClausula extends Model
{
    use HasFactory;

    protected $table = 'polizas_asegurados_clausulas';

    protected $fillable = [
        'asegurado_id',
        'clausula_id',
        'aplicada_desde',
        'aplicada_hasta',
        'notas',
    ];

    protected $casts = [
        'aplicada_desde' => 'date',
        'aplicada_hasta' => 'date',
    ];

    public function asegurado()
    {
        return $this->belongsTo(PolizaAsegurado::class, 'asegurado_id');
    }

    public function clausula()
    {
        return $this->belongsTo(PolizaClausula::class, 'clausula_id');
    }
}

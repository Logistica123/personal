<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PolizaSolicitudAsegurado extends Model
{
    use HasFactory;

    protected $table = 'polizas_solicitud_asegurados';

    public $timestamps = false;

    protected $fillable = [
        'solicitud_id',
        'asegurado_id',
        'observaciones',
    ];

    public function solicitud()
    {
        return $this->belongsTo(PolizaSolicitud::class, 'solicitud_id');
    }

    public function asegurado()
    {
        return $this->belongsTo(PolizaAsegurado::class, 'asegurado_id');
    }
}

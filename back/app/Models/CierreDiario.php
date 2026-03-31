<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CierreDiario extends Model
{
    use HasFactory;

    protected $table = 'cierres_diarios';

    protected $fillable = [
        'fecha_importacion',
        'fecha_lead',
        'lead_id',
        'contacto',
        'estatus_lead',
        'etiquetas_lead',
        'sucursal',
        'vehiculo',
        'empresa',
        'embudo',
        'nombre_distribuidor',
        'asesor_comercial',
        'mes',
        'semana',
        'dia',
        'importado_por',
    ];

    protected function casts(): array
    {
        return [
            'fecha_importacion' => 'date',
            'fecha_lead' => 'date',
            'lead_id' => 'integer',
            'mes' => 'integer',
            'semana' => 'integer',
            'dia' => 'integer',
        ];
    }
}

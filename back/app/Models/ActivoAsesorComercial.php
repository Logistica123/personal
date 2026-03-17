<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ActivoAsesorComercial extends Model
{
    use HasFactory;

    protected $table = 'activos_asesores_comerciales';

    protected $casts = [
        'fecha_ultima_asignacion' => 'datetime',
    ];

    protected $fillable = [
        'encargado',
        'lider',
        'asesor_comercial',
        'rol',
        'modalidad_trabajo',
        'transportista_activo',
        'numero',
        'comentarios',
        'cliente',
        'asesor_postventa',
        'sucursal',
        'vehiculo',
        'fecha_ultima_asignacion',
        'row_order',
    ];
}

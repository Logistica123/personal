<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ActivoAsesorComercial extends Model
{
    use HasFactory;

    protected $table = 'activos_asesores_comerciales';

    protected $fillable = [
        'encargado',
        'lider',
        'asesor_comercial',
        'rol',
        'transportista_activo',
        'numero',
        'row_order',
    ];
}

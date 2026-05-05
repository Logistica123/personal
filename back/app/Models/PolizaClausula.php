<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PolizaClausula extends Model
{
    use HasFactory;

    protected $table = 'polizas_clausulas';

    protected $fillable = [
        'nombre_corto',
        'alias',
        'cliente_id',
        'sucursal_id',
        'cuit_titular',
        'razon_social_titular',
        'tipo',
        'descripcion_corta',
        'activa',
        'notas',
    ];

    protected $casts = [
        'activa' => 'boolean',
    ];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function aplicaciones()
    {
        return $this->hasMany(PolizaClausulaAplicada::class, 'clausula_id');
    }
}

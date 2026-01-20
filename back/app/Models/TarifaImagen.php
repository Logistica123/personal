<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TarifaImagen extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'tarifa_imagenes';

    protected $fillable = [
        'cliente_id',
        'sucursal_id',
        'mes',
        'anio',
        'tipo',
        'nombre_original',
        'disk',
        'path',
        'url',
        'mime',
        'size',
        'template_data',
    ];

    protected $casts = [
        'template_data' => 'array',
    ];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function sucursal()
    {
        return $this->belongsTo(Sucursal::class, 'sucursal_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Sucursal extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'sucursals';

    protected $fillable = [
        'cliente_id',
        'nombre',
        'codigo_corto',
        'direccion',
        'encargado_deposito',
    ];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function requerimientos()
    {
        return $this->hasMany(ClienteRequerimiento::class, 'sucursal_id');
    }
}

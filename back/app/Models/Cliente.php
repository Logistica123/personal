<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Cliente extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'clientes';

    protected $fillable = [
        'codigo',
        'nombre',
        'direccion',
        'documento_fiscal',
    ];

    public function sucursales()
    {
        return $this->hasMany(Sucursal::class, 'cliente_id');
    }
}

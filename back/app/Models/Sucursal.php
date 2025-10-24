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
        'direccion',
    ];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }
}

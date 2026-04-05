<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ClienteRequerimiento extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'cliente_requerimientos';

    protected $fillable = [
        'cliente_id',
        'sucursal_id',
        'unidad_id',
        'source_type',
        'source_id',
        'requerimiento',
    ];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function sucursal()
    {
        return $this->belongsTo(Sucursal::class, 'sucursal_id');
    }

    public function unidad()
    {
        return $this->belongsTo(Unidad::class, 'unidad_id');
    }
}

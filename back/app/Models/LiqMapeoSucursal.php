<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiqMapeoSucursal extends Model
{
    protected $table = 'liq_mapeos_sucursal';

    protected $fillable = [
        'cliente_id',
        'patron_archivo',
        'sucursal_tarifa',
        'tipo_operacion',
        'activo',
    ];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }
}

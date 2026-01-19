<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FacturaValidacion extends Model
{
    protected $table = 'factura_validaciones';

    protected $fillable = [
        'factura_id',
        'regla',
        'resultado',
        'mensaje',
    ];

    protected $casts = [
        'resultado' => 'boolean',
    ];

    public function factura()
    {
        return $this->belongsTo(Factura::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FacturaCbteAsociado extends Model
{
    use HasFactory;

    protected $table = 'factura_cbte_asociado';

    protected $fillable = [
        'factura_id',
        'cbte_tipo',
        'pto_vta',
        'cbte_numero',
        'fecha_emision',
    ];

    protected function casts(): array
    {
        return [
            'fecha_emision' => 'date',
        ];
    }

    public function factura()
    {
        return $this->belongsTo(FacturaCabecera::class, 'factura_id');
    }
}


<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FacturaIva extends Model
{
    use HasFactory;

    protected $table = 'factura_iva';

    protected $fillable = [
        'factura_id',
        'iva_id',
        'base_imp',
        'importe',
    ];

    protected function casts(): array
    {
        return [
            'base_imp' => 'decimal:2',
            'importe' => 'decimal:2',
        ];
    }

    public function factura()
    {
        return $this->belongsTo(FacturaCabecera::class, 'factura_id');
    }
}

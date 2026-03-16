<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FacturaTributo extends Model
{
    use HasFactory;

    protected $table = 'factura_tributo';

    protected $fillable = [
        'factura_id',
        'tributo_id',
        'descr',
        'base_imp',
        'alic',
        'importe',
    ];

    protected function casts(): array
    {
        return [
            'base_imp' => 'decimal:2',
            'alic' => 'decimal:4',
            'importe' => 'decimal:2',
        ];
    }

    public function factura()
    {
        return $this->belongsTo(FacturaCabecera::class, 'factura_id');
    }
}

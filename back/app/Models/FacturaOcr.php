<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FacturaOcr extends Model
{
    protected $table = 'factura_ocr';

    protected $fillable = [
        'factura_id',
        'raw_text',
        'extracted_json',
        'model',
        'confidence',
    ];

    protected $casts = [
        'extracted_json' => 'array',
        'confidence' => 'decimal:2',
    ];

    public function factura()
    {
        return $this->belongsTo(Factura::class);
    }
}

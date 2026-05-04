<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PolizaEndoso extends Model
{
    use HasFactory;

    protected $table = 'polizas_endosos';

    protected $fillable = [
        'poliza_id',
        'numero_endoso',
        'tipo',
        'fecha_emision',
        'archivo_id',
        'descripcion',
        'premio_endoso',
    ];

    protected $casts = [
        'fecha_emision' => 'date',
        'premio_endoso' => 'decimal:2',
    ];

    public function poliza()
    {
        return $this->belongsTo(Poliza::class, 'poliza_id');
    }

    public function archivo()
    {
        return $this->belongsTo(Archivo::class, 'archivo_id');
    }
}

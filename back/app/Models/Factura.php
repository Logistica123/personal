<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Factura extends Model
{
    protected $table = 'facturas';

    protected $fillable = [
        'liquidacion_id',
        'persona_id',
        'archivo_path',
        'archivo_disk',
        'razon_social',
        'cuit_emisor',
        'numero_factura',
        'fecha_emision',
        'tipo_factura',
        'importe_total',
        'iva',
        'concepto',
        'cbu',
        'importe_esperado',
        'estado',
        'decision_motivo',
        'decision_mensaje',
    ];

    protected $casts = [
        'importe_total' => 'decimal:2',
        'iva' => 'decimal:2',
        'importe_esperado' => 'decimal:2',
        'fecha_emision' => 'date',
    ];

    public function liquidacion()
    {
        return $this->belongsTo(Archivo::class, 'liquidacion_id');
    }

    public function persona()
    {
        return $this->belongsTo(Persona::class);
    }

    public function validaciones()
    {
        return $this->hasMany(FacturaValidacion::class);
    }

    public function ocr()
    {
        return $this->hasOne(FacturaOcr::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TicketRequest extends Model
{
    protected $fillable = [
        'titulo',
        'categoria',
        'insumos',
        'cantidad',
        'notas',
        'monto',
        'factura_monto',
        'factura_archivos',
        'destinatario_id',
        'responsable_id',
        'hr_id',
        'solicitante_id',
        'estado',
    ];

    protected $casts = [
        'factura_archivos' => 'array',
        'monto' => 'decimal:2',
        'factura_monto' => 'decimal:2',
    ];
}

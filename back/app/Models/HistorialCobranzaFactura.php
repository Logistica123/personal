<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HistorialCobranzaFactura extends Model
{
    use HasFactory;

    public const UPDATED_AT = null;

    protected $table = 'historial_cobranza_factura';

    protected $fillable = [
        'factura_id',
        'fecha_evento',
        'estado_anterior',
        'estado_nuevo',
        'fecha_aprox_cobro_anterior',
        'fecha_aprox_cobro_nueva',
        'fecha_pago_anterior',
        'fecha_pago_nueva',
        'monto_pagado_anterior',
        'monto_pagado_nuevo',
        'observaciones',
        'usuario_id',
    ];

    protected function casts(): array
    {
        return [
            'fecha_evento' => 'datetime',
            'fecha_aprox_cobro_anterior' => 'date',
            'fecha_aprox_cobro_nueva' => 'date',
            'fecha_pago_anterior' => 'date',
            'fecha_pago_nueva' => 'date',
            'monto_pagado_anterior' => 'decimal:2',
            'monto_pagado_nuevo' => 'decimal:2',
        ];
    }

    public function factura()
    {
        return $this->belongsTo(FacturaCabecera::class, 'factura_id');
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}

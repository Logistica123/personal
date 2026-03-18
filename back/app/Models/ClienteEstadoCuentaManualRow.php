<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClienteEstadoCuentaManualRow extends Model
{
    protected $table = 'cliente_estado_cuenta_manual_rows';

    protected $fillable = [
        'cliente_id',
        'sucursal_id',
        'anio_facturado',
        'mes_facturado',
        'periodo_facturado',
        'neto_gravado',
        'no_gravado',
        'iva',
        'importe_a_cobrar',
        'observaciones',
        'numero_factura',
        'fecha_fact',
        'fecha_cobro',
        'importe_cobrado',
        'retenciones_gcias',
        'otras_retenciones',
        'op_cobro_recibo',
        'op_cobro_archivo_path',
        'op_cobro_archivo_nombre',
        'forma_cobro',
        'estado_cobranza',
    ];

    protected function casts(): array
    {
        return [
            'neto_gravado' => 'decimal:2',
            'no_gravado' => 'decimal:2',
            'iva' => 'decimal:2',
            'importe_a_cobrar' => 'decimal:2',
            'importe_cobrado' => 'decimal:2',
            'retenciones_gcias' => 'decimal:2',
            'otras_retenciones' => 'decimal:2',
            'fecha_fact' => 'date',
            'fecha_cobro' => 'date',
        ];
    }

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function sucursal()
    {
        return $this->belongsTo(Sucursal::class, 'sucursal_id');
    }
}

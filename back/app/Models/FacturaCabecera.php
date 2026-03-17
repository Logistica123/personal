<?php

namespace App\Models;

use App\Support\Facturacion\AmbienteArca;
use App\Support\Facturacion\CobranzaEstado;
use App\Support\Facturacion\FacturaEstado;
use App\Support\Facturacion\PeriodoFacturado;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FacturaCabecera extends Model
{
    use HasFactory;

    protected $table = 'factura_cabecera';

    protected $fillable = [
        'emisor_id',
        'certificado_id',
        'ambiente',
        'pto_vta',
        'cbte_tipo',
        'cbte_numero',
        'concepto',
        'doc_tipo',
        'doc_nro',
        'cliente_id',
        'sucursal_id',
        'cliente_nombre',
        'cliente_domicilio',
        'fecha_cbte',
        'fecha_serv_desde',
        'fecha_serv_hasta',
        'fecha_vto_pago',
        'condiciones_venta',
        'moneda_id',
        'moneda_cotiz',
        'imp_total',
        'imp_tot_conc',
        'imp_neto',
        'imp_op_ex',
        'imp_iva',
        'imp_trib',
        'resultado_arca',
        'reproceso',
        'cae',
        'cae_vto',
        'observaciones_arca_json',
        'errores_arca_json',
        'request_xml_path',
        'response_xml_path',
        'pdf_path',
        'estado',
        'hash_idempotencia',
        'anio_facturado',
        'mes_facturado',
        'periodo_facturado',
        'fecha_aprox_cobro',
        'fecha_pago_manual',
        'monto_pagado_manual',
        'estado_cobranza',
        'observaciones_cobranza',
    ];

    protected function casts(): array
    {
        return [
            'ambiente' => AmbienteArca::class,
            'estado' => FacturaEstado::class,
            'periodo_facturado' => PeriodoFacturado::class,
            'estado_cobranza' => CobranzaEstado::class,
            'fecha_cbte' => 'date',
            'fecha_serv_desde' => 'date',
            'fecha_serv_hasta' => 'date',
            'fecha_vto_pago' => 'date',
            'cae_vto' => 'date',
            'fecha_aprox_cobro' => 'date',
            'fecha_pago_manual' => 'date',
            'moneda_cotiz' => 'decimal:6',
            'imp_total' => 'decimal:2',
            'imp_tot_conc' => 'decimal:2',
            'imp_neto' => 'decimal:2',
            'imp_op_ex' => 'decimal:2',
            'imp_iva' => 'decimal:2',
            'imp_trib' => 'decimal:2',
            'monto_pagado_manual' => 'decimal:2',
            'observaciones_arca_json' => 'array',
            'errores_arca_json' => 'array',
            'condiciones_venta' => 'array',
        ];
    }

    public function emisor()
    {
        return $this->belongsTo(ArcaEmisor::class, 'emisor_id');
    }

    public function certificado()
    {
        return $this->belongsTo(ArcaCertificado::class, 'certificado_id');
    }

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function sucursal()
    {
        return $this->belongsTo(Sucursal::class, 'sucursal_id');
    }

    public function ivaItems()
    {
        return $this->hasMany(FacturaIva::class, 'factura_id')->orderBy('id');
    }

    public function tributos()
    {
        return $this->hasMany(FacturaTributo::class, 'factura_id')->orderBy('id');
    }

    public function detallePdf()
    {
        return $this->hasMany(FacturaDetallePdf::class, 'factura_id')->orderBy('orden');
    }

    public function cbtesAsoc()
    {
        return $this->hasMany(FacturaCbteAsociado::class, 'factura_id')->orderBy('id');
    }

    public function historialCobranza()
    {
        return $this->hasMany(HistorialCobranzaFactura::class, 'factura_id')->orderByDesc('fecha_evento');
    }

    public function canEditFiscalFields(): bool
    {
        return ! ($this->estado instanceof FacturaEstado
            ? $this->estado->isFiscallyLocked()
            : in_array($this->estado, [FacturaEstado::AUTORIZADA->value, FacturaEstado::PDF_GENERADO->value], true));
    }
}

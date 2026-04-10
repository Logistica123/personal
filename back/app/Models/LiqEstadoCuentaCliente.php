<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiqEstadoCuentaCliente extends Model
{
    protected $table = 'liq_estado_cuenta_cliente';

    // -------------------------------------------------------------------------
    // Estado constants
    // -------------------------------------------------------------------------

    const ESTADO_PENDIENTE   = 'PENDIENTE';
    const ESTADO_FACTURADA   = 'FACTURADA';
    const ESTADO_COBRADA     = 'COBRADA';
    const ESTADO_NC_EMITIDA  = 'NC_EMITIDA';

    const TIPO_FA = 'FA';
    const TIPO_NC = 'NC';
    const TIPO_ND = 'ND';

    const QUINCENA_MC = 'MC';
    const QUINCENA_Q1 = 'Q1';
    const QUINCENA_Q2 = 'Q2';

    protected $fillable = [
        'cliente_id',
        'sucursal',
        'jurisdiccion_id',
        'periodo',
        'quincena',
        'neto_gravado',
        'no_gravado',
        'iva',
        'importe_a_cobrar',
        'observaciones',
        'tipo_comprobante',
        'liquidacion_cliente_id',
        'factura_id',
        'numero_factura',
        'cae',
        'fecha_factura',
        'vencimiento_pago',
        'fecha_cobro',
        'importe_cobrado',
        'retenciones_gcias',
        'otras_retenciones',
        'numero_op_cobro',
        'forma_cobro',
        'diferencia',
        'estado',
        'usuario_id',
    ];

    protected function casts(): array
    {
        return [
            'neto_gravado'      => 'decimal:2',
            'no_gravado'        => 'decimal:2',
            'iva'               => 'decimal:2',
            'importe_a_cobrar'  => 'decimal:2',
            'importe_cobrado'   => 'decimal:2',
            'retenciones_gcias' => 'decimal:2',
            'otras_retenciones' => 'decimal:2',
            'diferencia'        => 'decimal:2',
            'fecha_factura'     => 'date',
            'vencimiento_pago'  => 'date',
            'fecha_cobro'       => 'date',
        ];
    }

    // -------------------------------------------------------------------------
    // Computed
    // -------------------------------------------------------------------------

    public function calcularImporteACobrar(): float
    {
        return round((float) $this->neto_gravado + (float) $this->no_gravado + (float) $this->iva, 2);
    }

    public function calcularIva(float $alicuota = 0.21): float
    {
        return round((float) $this->neto_gravado * $alicuota, 2);
    }

    public function calcularDiferencia(): float
    {
        return round(
            (float) $this->importe_a_cobrar
            - (float) $this->importe_cobrado
            - (float) $this->retenciones_gcias
            - (float) $this->otras_retenciones,
            2
        );
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    public function esPendiente(): bool
    {
        return $this->estado === self::ESTADO_PENDIENTE;
    }

    public function esFacturada(): bool
    {
        return $this->estado === self::ESTADO_FACTURADA;
    }

    public function mapCbteTipo(): int
    {
        return match ($this->tipo_comprobante) {
            self::TIPO_NC => 3,
            self::TIPO_ND => 2,
            default       => 1,
        };
    }

    public function jurisdiccionNombre(): ?string
    {
        return LiqJurisdiccionSucursal::nombreJurisdiccion((int) $this->jurisdiccion_id);
    }

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function cliente()
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }

    public function liquidacionCliente()
    {
        return $this->belongsTo(LiqLiquidacionCliente::class, 'liquidacion_cliente_id');
    }

    public function factura()
    {
        return $this->belongsTo(FacturaCabecera::class, 'factura_id');
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function jurisdiccionSucursal()
    {
        return LiqJurisdiccionSucursal::query()
            ->where('cliente_id', $this->cliente_id)
            ->where('sucursal', $this->sucursal)
            ->first();
    }
}

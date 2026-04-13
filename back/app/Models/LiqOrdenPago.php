<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqOrdenPago extends Model
{
    use HasFactory;

    protected $table = 'liq_ordenes_pago';

    // -------------------------------------------------------------------------
    // Estado constants
    // -------------------------------------------------------------------------

    const ESTADO_BORRADOR       = 'BORRADOR';
    const ESTADO_PENDIENTE_PAGO = 'PENDIENTE_PAGO';
    const ESTADO_ENVIADA_BANCO  = 'ENVIADA_BANCO';
    const ESTADO_CONFIRMADA     = 'CONFIRMADA';
    const ESTADO_RECHAZADA      = 'RECHAZADA';
    const ESTADO_ANULADA        = 'ANULADA';

    const AGRUPACION_INDIVIDUAL = 'INDIVIDUAL';
    const AGRUPACION_GLOBAL     = 'GLOBAL';

    const BENEFICIARIO_DISTRIBUIDOR = 'DISTRIBUIDOR';
    const BENEFICIARIO_COBRADOR     = 'COBRADOR';

    protected $fillable = [
        'concepto_id',
        'numero',
        'numero_display',
        'anio',
        'mes',
        'fecha_emision',
        'beneficiario_tipo',
        'beneficiario_id',
        'beneficiario_nombre',
        'beneficiario_cuil',
        'beneficiario_cbu',
        'subtotal',
        'total_descuentos',
        'total_a_pagar',
        'estado',
        'agrupacion',
        'medio_pago',
        'icbc_list_id',
        'icbc_ref_id',
        'icbc_estado',
        'icbc_estado_upload',
        'icbc_tx_id',
        'icbc_error_code',
        'icbc_error_msg',
        'icbc_enviado_at',
        'icbc_acreditado_at',
        'icbc_items_aceptados',
        'icbc_items_rechazados',
        'observaciones',
        'usuario_id',
    ];

    protected $casts = [
        'numero'           => 'integer',
        'anio'             => 'integer',
        'mes'              => 'integer',
        'fecha_emision'    => 'date',
        'subtotal'         => 'decimal:2',
        'total_descuentos' => 'decimal:2',
        'total_a_pagar'      => 'decimal:2',
        'icbc_enviado_at'    => 'datetime',
        'icbc_acreditado_at' => 'datetime',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function concepto()
    {
        return $this->belongsTo(LiqOrdenPagoConcepto::class, 'concepto_id');
    }

    public function detalles()
    {
        return $this->hasMany(LiqOrdenPagoDetalle::class, 'orden_pago_id');
    }

    public function beneficiario()
    {
        return $this->belongsTo(Persona::class, 'beneficiario_id');
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function transferencias()
    {
        return $this->hasMany(LiqTransferenciaBanco::class, 'orden_pago_id');
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    public function esEditable(): bool
    {
        return $this->estado === self::ESTADO_BORRADOR;
    }

    public function puedeEjecutarPago(): bool
    {
        return $this->estado === self::ESTADO_PENDIENTE_PAGO;
    }

    public function puedeAnularse(): bool
    {
        return in_array($this->estado, [
            self::ESTADO_BORRADOR,
            self::ESTADO_PENDIENTE_PAGO,
            self::ESTADO_RECHAZADA,
        ]);
    }

    public function puedeReintentarse(): bool
    {
        return $this->estado === self::ESTADO_RECHAZADA;
    }

    /**
     * Genera el numero_display a partir del concepto y numero.
     */
    public static function formatNumeroDisplay(string $conceptoNombre, int $numero): string
    {
        return "OP {$conceptoNombre} {$numero}";
    }

    // -------------------------------------------------------------------------
    // Scopes
    // -------------------------------------------------------------------------

    public function scopeByConcepto($query, int $conceptoId)
    {
        return $query->where('concepto_id', $conceptoId);
    }

    public function scopeByPeriodo($query, int $anio, ?int $mes = null)
    {
        $query->where('anio', $anio);
        if ($mes !== null) {
            $query->where('mes', $mes);
        }
        return $query;
    }

    public function scopeByEstado($query, string $estado)
    {
        return $query->where('estado', $estado);
    }

    public function scopeActivas($query)
    {
        return $query->whereNotIn('estado', [self::ESTADO_ANULADA]);
    }
}

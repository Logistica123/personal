<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqTransferenciaBanco extends Model
{
    use HasFactory;

    protected $table = 'liq_transferencias_banco';

    // -------------------------------------------------------------------------
    // Estado WS constants
    // -------------------------------------------------------------------------

    const ESTADO_PENDIENTE  = 'PENDIENTE';
    const ESTADO_ENVIADA    = 'ENVIADA';
    const ESTADO_CONFIRMADA = 'CONFIRMADA';
    const ESTADO_RECHAZADA  = 'RECHAZADA';
    const ESTADO_ERROR      = 'ERROR';

    protected $fillable = [
        'orden_pago_id',
        'referencia_interna',
        'banco_referencia',
        'cbu_origen',
        'cbu_destino',
        'cuil_destino',
        'nombre_beneficiario',
        'importe',
        'moneda',
        'concepto_bancario',
        'estado_ws',
        'codigo_respuesta',
        'mensaje_respuesta',
        'request_payload',
        'response_payload',
        'intentos',
        'fecha_envio',
        'fecha_confirmacion',
        'usuario_id',
    ];

    protected $casts = [
        'importe'             => 'decimal:2',
        'request_payload'     => 'array',
        'response_payload'    => 'array',
        'intentos'            => 'integer',
        'fecha_envio'         => 'datetime',
        'fecha_confirmacion'  => 'datetime',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function ordenPago()
    {
        return $this->belongsTo(LiqOrdenPago::class, 'orden_pago_id');
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    public function fueExitosa(): bool
    {
        return $this->estado_ws === self::ESTADO_CONFIRMADA;
    }

    public function puedeReintentarse(): bool
    {
        return in_array($this->estado_ws, [self::ESTADO_RECHAZADA, self::ESTADO_ERROR]);
    }
}

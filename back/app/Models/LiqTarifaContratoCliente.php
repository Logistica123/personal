<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * SPEC v4.4 · Tarifa contrato OCASA → LA por (sucursal × capacidad × concepto).
 *
 * Es la fuente de verdad de "cuánto debería pagarnos el cliente" — el detector de
 * subpago compara contra esta tabla para flaguear ops con diferencia.
 *
 * Pantalla CRUD: Liquidaciones → Configuración → Tarifas → Tarifas contrato cliente.
 */
class LiqTarifaContratoCliente extends Model
{
    protected $table = 'liq_tarifas_contrato_cliente';

    public $timestamps = false; // la tabla solo tiene created_at, no updated_at

    protected $fillable = [
        'cliente_id',
        'sucursal',
        'capacidad_vehiculo',
        'concepto',
        'importe_contrato',
        'vigencia_desde',
        'vigencia_hasta',
        'notas',
    ];

    protected $casts = [
        'capacidad_vehiculo' => 'integer',
        'importe_contrato'   => 'decimal:2',
        'vigencia_desde'     => 'date',
        'vigencia_hasta'     => 'date',
    ];

    public function cliente()
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }

    public function scopeVigentes($q, ?string $fecha = null)
    {
        $f = $fecha ?: now()->toDateString();
        return $q->where('vigencia_desde', '<=', $f)
            ->where(function ($w) use ($f) {
                $w->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $f);
            });
    }
}

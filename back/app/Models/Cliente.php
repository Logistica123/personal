<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Cliente extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'clientes';

    protected $fillable = [
        'codigo',
        'nombre',
        'direccion',
        'documento_fiscal',
        'logo_url',
        'liq_activo',
        'liq_tolerancia_porcentaje',
        'liq_configuracion_excel',
    ];

    protected $casts = [
        'liq_activo' => 'boolean',
        'liq_tolerancia_porcentaje' => 'decimal:2',
        'liq_configuracion_excel' => 'array',
    ];

    public function sucursales()
    {
        return $this->hasMany(Sucursal::class, 'cliente_id');
    }

    public function taxProfile()
    {
        return $this->hasOne(TaxProfile::class, 'entity_id')
            ->where('entity_type', 'cliente');
    }

    public function taxDocuments()
    {
        return $this->hasMany(ClientTaxDocument::class, 'cliente_id');
    }

    public function requerimientos()
    {
        return $this->hasMany(ClienteRequerimiento::class, 'cliente_id');
    }

    // ── Liquidaciones v2 ──────────────────────────────────────────────────────
    public function liqEsquemas()
    {
        return $this->hasMany(LiqEsquemaTarifario::class, 'cliente_id');
    }

    public function liqMapeoConceptos()
    {
        return $this->hasMany(LiqMapeoConcepto::class, 'cliente_id');
    }

    public function liqMapeoSucursales()
    {
        return $this->hasMany(LiqMapeoSucursal::class, 'cliente_id');
    }

    public function liqConfiguracionGastos()
    {
        return $this->hasMany(LiqConfiguracionGastos::class, 'cliente_id');
    }

    public function liqLiquidaciones()
    {
        return $this->hasMany(LiqLiquidacionCliente::class, 'cliente_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LiqCliente extends Model
{
    protected $table = 'liq_clientes';

    protected $fillable = [
        'razon_social',
        'nombre_corto',
        'cuit',
        'activo',
        'configuracion_excel',
    ];

    protected function casts(): array
    {
        return [
            'activo' => 'boolean',
            'configuracion_excel' => 'array',
        ];
    }

    public function esquemas(): HasMany
    {
        return $this->hasMany(LiqEsquemaTarifario::class, 'cliente_id');
    }

    public function mapeosConcepto(): HasMany
    {
        return $this->hasMany(LiqMapeoConcepto::class, 'cliente_id');
    }

    public function mapeosSucursal(): HasMany
    {
        return $this->hasMany(LiqMapeoSucursal::class, 'cliente_id');
    }

    public function configuracionGastos(): HasMany
    {
        return $this->hasMany(LiqConfiguracionGastos::class, 'cliente_id');
    }

    public function liquidaciones(): HasMany
    {
        return $this->hasMany(LiqLiquidacionCliente::class, 'cliente_id');
    }

    /** Devuelve el gasto administrativo fijo activo para una fecha dada. */
    public function gastoActivoPara(string $fecha): ?LiqConfiguracionGastos
    {
        return $this->configuracionGastos()
            ->where('activo', true)
            ->where('tipo', 'fijo')
            ->where('vigencia_desde', '<=', $fecha)
            ->where(fn ($q) => $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $fecha))
            ->orderByDesc('vigencia_desde')
            ->first();
    }

    /** Resuelve la sucursal de tarifa para un nombre de archivo dado. */
    public function resolverSucursalPorArchivo(string $nombreArchivo): ?LiqMapeoSucursal
    {
        return $this->mapeosSucursal()
            ->where('activo', true)
            ->get()
            ->first(fn (LiqMapeoSucursal $m) => stripos($nombreArchivo, $m->patron_archivo) !== false);
    }
}

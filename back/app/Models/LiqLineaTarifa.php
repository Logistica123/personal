<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqLineaTarifa extends Model
{
    use HasFactory;

    protected $table = 'liq_lineas_tarifa';

    protected $fillable = [
        'esquema_id',
        'dimensiones_valores',
        'precio_original',
        'porcentaje_agencia',
        'precio_distribuidor',
        'vigencia_desde',
        'vigencia_hasta',
        'creado_por',
        'aprobado_por',
        'fecha_aprobacion',
        'activo',
        // OCASA fields
        'modelo_tarifa',
        'costo_fijo_base',
        'tarifa_km_original',
        'tarifa_km_distribuidor',
        'umbral_km',
        'modo_productividad',
        'tarifa_parada_distrib',
        'tarifa_bulto_distrib',
        'capacidad_vehiculo_kg',
        // BUGFIX 31 v2
        'rango_distancia',
        'material_tarifario',
        'zona',
        'es_minimo',
        'codigo_sucursal',
        'factor_km',
        // Excel v5 OCASA unificado
        'ruta_codigo',
        'es_tarifa_base',
        'distribuidor_nombre',
        'patente_match',
        'factor_prod_distrib',
        'factor_cant_distrib',
        'n_ops_observadas',
        'observaciones_v5',
    ];

    protected $casts = [
        'dimensiones_valores'    => 'array',
        'activo'                 => 'boolean',
        'precio_original'        => 'decimal:2',
        'porcentaje_agencia'     => 'decimal:2',
        'precio_distribuidor'    => 'decimal:2',
        'vigencia_desde'         => 'date',
        'vigencia_hasta'         => 'date',
        'fecha_aprobacion'       => 'datetime',
        'costo_fijo_base'        => 'decimal:2',
        'tarifa_km_original'     => 'decimal:2',
        'tarifa_km_distribuidor' => 'decimal:2',
        'tarifa_parada_distrib'  => 'decimal:2',
        'tarifa_bulto_distrib'   => 'decimal:2',
        'es_minimo'              => 'boolean',
        'es_tarifa_base'         => 'boolean',
        'factor_km'              => 'decimal:4',
        'factor_prod_distrib'    => 'decimal:4',
        'factor_cant_distrib'    => 'decimal:4',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function esquema()
    {
        return $this->belongsTo(LiqEsquemaTarifario::class, 'esquema_id');
    }

    public function creadoPor()
    {
        return $this->belongsTo(\App\Models\User::class, 'creado_por');
    }

    public function aprobadoPor()
    {
        return $this->belongsTo(\App\Models\User::class, 'aprobado_por');
    }

    public function auditorias()
    {
        return $this->hasMany(LiqAuditoriaTarifa::class, 'linea_tarifa_id');
    }

    // -------------------------------------------------------------------------
    // Helper methods
    // -------------------------------------------------------------------------

    /**
     * Calculates the distributor price based on the original price and agency percentage.
     */
    public function calcularPrecioDistribuidor(): float
    {
        return round((float) $this->precio_original * (1 - (float) $this->porcentaje_agencia / 100), 2);
    }

    /**
     * Checks whether this tariff line is active and covers the given date.
     * Defaults to today if no date is provided.
     */
    public function estaVigente(Carbon $fecha = null): bool
    {
        $fecha = $fecha ?? Carbon::today();

        if (! $this->activo) {
            return false;
        }

        if ($this->vigencia_desde && $fecha->lt($this->vigencia_desde)) {
            return false;
        }

        if ($this->vigencia_hasta && $fecha->gt($this->vigencia_hasta)) {
            return false;
        }

        return true;
    }

    // -------------------------------------------------------------------------
    // Scopes
    // -------------------------------------------------------------------------

    public function scopeActivo($q)
    {
        return $q->where('activo', true);
    }

    public function scopeVigente($q, string $fecha)
    {
        return $q->where('activo', true)
                 ->where('vigencia_desde', '<=', $fecha)
                 ->where(function ($sub) use ($fecha) {
                     $sub->whereNull('vigencia_hasta')
                         ->orWhere('vigencia_hasta', '>=', $fecha);
                 });
    }
}

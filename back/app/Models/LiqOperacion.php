<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqOperacion extends Model
{
    use HasFactory;

    protected $table = 'liq_operaciones';

    protected $fillable = [
        'liquidacion_cliente_id',
        'archivo_entrada_id',
        'campos_originales',
        'dominio',
        'concepto',
        'sucursal_tarifa',
        'dimensiones_valores',
        'dimension_fallida',
        'valor_cliente',
        'linea_tarifa_id',
        'valor_tarifa_original',
        'valor_tarifa_distribuidor',
        'porcentaje_agencia',
        'diferencia_cliente',
        'estado',
        'distribuidor_id',
        'excluida',
        'motivo_exclusion',
        'observaciones',
        'id_operacion_cliente',
        'id_liquidacion_cliente_externo',
        'tipo_operacion',
        'origen',
        'operacion_referencia_id',
        'peaje_autorizado',
        'peaje_monto_ajustado',
        'peaje_motivo',
        // OCASA fields
        'modelo_tarifa',
        'costo_fijo',
        'costo_km',
        'costo_prod',
        'costo_cant',
        'distancia_km',
        'total_paradas',
        'capacidad_vehiculo_kg',
        'fraccion_jornada',
        'tarifa_jornada_distrib',
        'tarifa_km_distrib_valor',
        'tarifa_prod_distrib',
        'importe_gravado',
        'importe_no_gravado',
        // BUGFIX 31 v2
        'idtrack_tms',
        'modelo_calculo',
        'requiere_override_manual',
        // SPEC INTEGRAL Fase A — eficiencia persistida + penalidades
        'penalidades_tms',
        'paradas_ycc_total',
        'paradas_con_motivo',
        'paradas_exitosas',
        'eficiencia_pct',
        'eficiencia_calculada_at',
        // SPEC v3 · Resolver 4 ramas (A override · B factor · C error · D productividad)
        'modo_pago',
        'estado_calculo',
        'error_msg',
        'detalle_paradas',
    ];

    protected $casts = [
        'campos_originales'        => 'array',
        'dimensiones_valores'      => 'array',
        'valor_cliente'            => 'decimal:2',
        'valor_tarifa_original'    => 'decimal:2',
        'valor_tarifa_distribuidor' => 'decimal:2',
        'porcentaje_agencia'       => 'decimal:2',
        'diferencia_cliente'       => 'decimal:2',
        'excluida'                 => 'boolean',
        'costo_fijo'               => 'decimal:2',
        'costo_km'                 => 'decimal:2',
        'costo_prod'               => 'decimal:2',
        'costo_cant'               => 'decimal:2',
        'distancia_km'             => 'decimal:2',
        'fraccion_jornada'         => 'decimal:4',
        'tarifa_jornada_distrib'   => 'decimal:2',
        'tarifa_km_distrib_valor'  => 'decimal:2',
        'tarifa_prod_distrib'      => 'decimal:2',
        'importe_gravado'          => 'decimal:2',
        'importe_no_gravado'       => 'decimal:2',
        'penalidades_tms'          => 'decimal:2',
        'eficiencia_pct'           => 'decimal:2',
        'eficiencia_calculada_at'  => 'datetime',
        // SPEC v3
        'detalle_paradas'          => 'array',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function liquidacionCliente()
    {
        return $this->belongsTo(LiqLiquidacionCliente::class, 'liquidacion_cliente_id');
    }

    public function archivoEntrada()
    {
        return $this->belongsTo(LiqArchivoEntrada::class, 'archivo_entrada_id');
    }

    public function lineaTarifa()
    {
        return $this->belongsTo(LiqLineaTarifa::class, 'linea_tarifa_id');
    }

    public function distribuidor()
    {
        return $this->belongsTo(\App\Models\Persona::class, 'distribuidor_id');
    }

    public function detalles()
    {
        return $this->hasMany(LiqOperacionDetalle::class, 'operacion_id');
    }
}

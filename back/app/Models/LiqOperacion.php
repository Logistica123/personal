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
}

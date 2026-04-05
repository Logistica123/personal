<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqLiquidacionCliente extends Model
{
    use HasFactory;

    protected $table = 'liq_liquidaciones_cliente';

    // -------------------------------------------------------------------------
    // Estado constants
    // -------------------------------------------------------------------------

    const ESTADO_PENDIENTE   = 'pendiente';
    const ESTADO_EN_PROCESO  = 'en_proceso';
    const ESTADO_AUDITADA    = 'auditada';
    const ESTADO_APROBADA    = 'aprobada';
    const ESTADO_RECHAZADA   = 'rechazada';

    protected $fillable = [
        'cliente_id',
        'archivo_origen',
        'sucursal_tarifa',
        'periodo_desde',
        'periodo_hasta',
        'fecha_carga',
        'usuario_carga',
        'estado',
        'total_operaciones',
        'total_importe_cliente',
        'total_importe_correcto',
        'total_diferencia',
    ];

    protected $casts = [
        'periodo_desde'          => 'date',
        'periodo_hasta'          => 'date',
        'fecha_carga'            => 'datetime',
        'total_importe_cliente'  => 'decimal:2',
        'total_importe_correcto' => 'decimal:2',
        'total_diferencia'       => 'decimal:2',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function cliente()
    {
        return $this->belongsTo(\App\Models\LiqCliente::class, 'cliente_id');
    }

    public function usuarioCarga()
    {
        return $this->belongsTo(\App\Models\User::class, 'usuario_carga');
    }

    public function archivosEntrada()
    {
        return $this->hasMany(LiqArchivoEntrada::class, 'liquidacion_cliente_id');
    }

    public function operaciones()
    {
        return $this->hasMany(LiqOperacion::class, 'liquidacion_cliente_id');
    }

    public function liquidacionesDistribuidor()
    {
        return $this->hasMany(LiqLiquidacionDistribuidor::class, 'liquidacion_cliente_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiquidacionDistribuidorLinea extends Model
{
    protected $table = 'liq_distributor_lines';

    protected $fillable = [
        'distributor_id',
        'run_id',
        'staging_row_id',
        'row_number',
        'fecha',
        'id_ruta',
        'svc',
        'turno_norm',
        'factor_jornada',
        'tarifa_dist_calculada',
        'plus_calculado',
        'importe_calculado',
        'tarifa_override',
        'plus_override',
        'importe_override',
        'importe_final',
        'motivo_override',
        'alertas',
    ];

    protected $casts = [
        'fecha' => 'datetime',
        'factor_jornada' => 'float',
        'tarifa_dist_calculada' => 'float',
        'plus_calculado' => 'float',
        'importe_calculado' => 'float',
        'tarifa_override' => 'float',
        'plus_override' => 'float',
        'importe_override' => 'float',
        'importe_final' => 'float',
        'alertas' => 'array',
    ];

    public function distributor()
    {
        return $this->belongsTo(LiquidacionDistribuidor::class, 'distributor_id');
    }

    public function run()
    {
        return $this->belongsTo(LiquidacionImportRun::class, 'run_id');
    }

    public function stagingRow()
    {
        return $this->belongsTo(LiquidacionStagingRow::class, 'staging_row_id');
    }
}


<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiquidacionDistribuidor extends Model
{
    protected $table = 'liq_distributors';

    protected $fillable = [
        'run_id',
        'distributor_key',
        'provider_id',
        'patente_norm',
        'distributor_code',
        'distributor_name',
        'categoria_vehiculo',
        'subtotal_calculado',
        'subtotal_final',
        'gastos_admin_default',
        'gastos_admin_override',
        'gastos_admin_final',
        'ajuste_manual',
        'total_final',
        'has_overrides',
        'alerts_count',
        'status',
    ];

    protected $casts = [
        'subtotal_calculado' => 'float',
        'subtotal_final' => 'float',
        'gastos_admin_default' => 'float',
        'gastos_admin_override' => 'float',
        'gastos_admin_final' => 'float',
        'ajuste_manual' => 'float',
        'total_final' => 'float',
        'has_overrides' => 'boolean',
    ];

    public function run()
    {
        return $this->belongsTo(LiquidacionImportRun::class, 'run_id');
    }

    public function lines()
    {
        return $this->hasMany(LiquidacionDistribuidorLinea::class, 'distributor_id');
    }
}


<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiqAjusteImporte extends Model
{
    protected $table = 'liq_ajustes_importe';
    public $timestamps = false;

    protected $fillable = [
        'liq_id',
        'importe_antes',
        'importe_despues',
        'diferencia',
        'diferencia_pct',
        'motivo',
        'user_id',
        'requiere_revision_dual',
        'aprobado_por',
        'aprobado_at',
    ];

    protected $casts = [
        'importe_antes'          => 'decimal:2',
        'importe_despues'        => 'decimal:2',
        'diferencia'             => 'decimal:2',
        'diferencia_pct'         => 'decimal:2',
        'requiere_revision_dual' => 'boolean',
        'aprobado_at'            => 'datetime',
        'created_at'             => 'datetime',
    ];

    public function liquidacion()
    {
        return $this->belongsTo(LiqLiquidacionDistribuidor::class, 'liq_id');
    }

    public function usuario()
    {
        return $this->belongsTo(\App\Models\User::class, 'user_id');
    }

    public function aprobador()
    {
        return $this->belongsTo(\App\Models\User::class, 'aprobado_por');
    }
}

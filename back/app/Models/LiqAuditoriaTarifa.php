<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqAuditoriaTarifa extends Model
{
    use HasFactory;

    protected $table = 'liq_auditoria_tarifa';

    /** Managed manually; no updated_at column on this table. */
    public $timestamps = false;

    protected $fillable = [
        'linea_tarifa_id',
        'accion',
        'valores_anteriores',
        'valores_nuevos',
        'usuario_id',
        'motivo',
        'created_at',
    ];

    protected $casts = [
        'valores_anteriores' => 'array',
        'valores_nuevos'     => 'array',
    ];

    /** Treat created_at as a date so Carbon handles it automatically. */
    protected $dates = ['created_at'];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function lineaTarifa()
    {
        return $this->belongsTo(LiqLineaTarifa::class, 'linea_tarifa_id');
    }

    public function usuario()
    {
        return $this->belongsTo(\App\Models\User::class, 'usuario_id');
    }
}

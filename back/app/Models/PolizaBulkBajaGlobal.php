<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * ADDENDUM 14 Parte C — registro maestro de una ejecución de "Baja masiva global".
 *
 * Cada bulk agrupa N solicitudes (una por póliza afectada). Permite auditar
 * el input original, qué encontró, cuántos correos se enviaron y qué falló.
 */
class PolizaBulkBajaGlobal extends Model
{
    use HasFactory;

    protected $table = 'polizas_bulk_bajas_global';

    protected $fillable = [
        'administrativo_user_id',
        'fecha_ejecucion',
        'input_raw',
        'cantidad_identificadores',
        'cantidad_encontrados',
        'cantidad_no_encontrados',
        'cantidad_solicitudes_creadas',
        'cantidad_correos_enviados',
        'cantidad_correos_fallidos',
        'estado',
        'completado_en',
        'metadata',
    ];

    protected $casts = [
        'fecha_ejecucion' => 'datetime',
        'completado_en'   => 'datetime',
        'metadata'        => 'array',
    ];

    public function administrativo()
    {
        return $this->belongsTo(User::class, 'administrativo_user_id');
    }

    public function solicitudes()
    {
        return $this->hasMany(PolizaSolicitud::class, 'bulk_baja_global_id');
    }
}

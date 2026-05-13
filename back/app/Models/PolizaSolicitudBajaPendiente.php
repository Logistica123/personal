<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * ADDENDUM 15 Bloque 1 — solicitudes de baja que requieren revisión humana
 * caso a caso por un admin. NO se procesa automáticamente: el admin decide
 * qué pólizas dar de baja y genera los correos correspondientes.
 */
class PolizaSolicitudBajaPendiente extends Model
{
    use HasFactory;

    protected $table = 'polizas_solicitudes_baja_pendientes';

    protected $fillable = [
        'persona_id',
        'solicitada_por_user_id',
        'fecha_solicitud',
        'motivo_baja',
        'comentarios_adicionales',
        'polizas_sugeridas',
        'estado',
        'procesada_por_user_id',
        'procesada_en',
        'polizas_dadas_de_baja',
        'motivo_rechazo',
        'bulk_baja_global_id',
    ];

    protected $casts = [
        'fecha_solicitud'        => 'datetime',
        'procesada_en'           => 'datetime',
        'polizas_sugeridas'      => 'array',
        'polizas_dadas_de_baja'  => 'array',
    ];

    public function persona()
    {
        return $this->belongsTo(Persona::class, 'persona_id');
    }

    public function solicitadaPor()
    {
        return $this->belongsTo(User::class, 'solicitada_por_user_id');
    }

    public function procesadaPor()
    {
        return $this->belongsTo(User::class, 'procesada_por_user_id');
    }

    public function bulkBajaGlobal()
    {
        return $this->belongsTo(PolizaBulkBajaGlobal::class, 'bulk_baja_global_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * ADDENDUM 13 Parte D — cache de emails enviados/recibidos de cada solicitud.
 * Se hidrata desde Microsoft Graph por el cron `polizas:sincronizar-inbox`.
 */
class PolizaSolicitudEmail extends Model
{
    use HasFactory;

    protected $table = 'polizas_solicitud_emails';

    protected $fillable = [
        'solicitud_id',
        'direccion',
        'microsoft_message_id',
        'conversation_id',
        'fecha_email',
        'de_email',
        'de_nombre',
        'para_emails',
        'cc_emails',
        'asunto',
        'body_preview',
        'body_completo',
        'tiene_adjuntos',
        'procesado',
    ];

    protected $casts = [
        'fecha_email'    => 'datetime',
        'para_emails'    => 'array',
        'cc_emails'      => 'array',
        'tiene_adjuntos' => 'boolean',
        'procesado'      => 'boolean',
    ];

    public function solicitud()
    {
        return $this->belongsTo(PolizaSolicitud::class, 'solicitud_id');
    }

    public function adjuntos()
    {
        return $this->hasMany(PolizaSolicitudEmailAdjunto::class, 'email_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PolizaSolicitud extends Model
{
    use HasFactory;

    protected $table = 'polizas_solicitudes';

    protected $fillable = [
        'poliza_id',
        'tipo',
        'administrativo_user_id',
        'fecha_solicitud',
        'destinatarios_to_resueltos',
        'destinatarios_cc_resueltos',
        'asunto',
        'body',
        'adjuntos',
        'estado',
        'enviado_en',
        'respuesta_recibida_en',
        'respuesta_resumen',
        'email_message_id',
        'microsoft_conversation_id',
        'tipo_clausula_global',
        'clausula_global_id',
        'clausulas_individuales',
    ];

    protected $casts = [
        'fecha_solicitud'             => 'datetime',
        'destinatarios_to_resueltos'  => 'array',
        'destinatarios_cc_resueltos'  => 'array',
        'adjuntos'                    => 'array',
        'enviado_en'                  => 'datetime',
        'respuesta_recibida_en'       => 'datetime',
        'clausulas_individuales'      => 'array',
    ];

    public function poliza()
    {
        return $this->belongsTo(Poliza::class, 'poliza_id');
    }

    public function administrativo()
    {
        return $this->belongsTo(User::class, 'administrativo_user_id');
    }

    public function asegurados()
    {
        return $this->hasMany(PolizaSolicitudAsegurado::class, 'solicitud_id');
    }

    public function clausulaGlobal()
    {
        return $this->belongsTo(PolizaClausula::class, 'clausula_global_id');
    }

    /** ADDENDUM 13 Parte D — emails enviados/recibidos cacheados de esta solicitud. */
    public function emails()
    {
        return $this->hasMany(PolizaSolicitudEmail::class, 'solicitud_id')->orderByDesc('fecha_email');
    }
}

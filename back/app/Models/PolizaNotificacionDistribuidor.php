<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PolizaNotificacionDistribuidor extends Model
{
    use HasFactory;

    protected $table = 'polizas_notificaciones_distribuidor';

    protected $fillable = [
        'asegurado_id',
        'poliza_id',
        'persona_id',
        'tipo',
        'email_destinatario',
        'asunto',
        'body',
        'estado',
        'enviado_en',
        'error_envio',
        'enviado_por_user_id',
    ];

    protected $casts = [
        'enviado_en' => 'datetime',
    ];

    public function asegurado()
    {
        return $this->belongsTo(PolizaAsegurado::class, 'asegurado_id');
    }

    public function poliza()
    {
        return $this->belongsTo(Poliza::class, 'poliza_id');
    }

    public function persona()
    {
        return $this->belongsTo(Persona::class, 'persona_id');
    }

    public function enviadoPor()
    {
        return $this->belongsTo(User::class, 'enviado_por_user_id');
    }
}

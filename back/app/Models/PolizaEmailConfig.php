<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PolizaEmailConfig extends Model
{
    use HasFactory;

    protected $table = 'polizas_email_config';

    protected $fillable = [
        'poliza_id',
        'tipo',
        'destinatarios_to',
        'destinatarios_cc',
        'destinatarios_bcc',
        'contacto_nombre',
        'asunto_template',
        'body_template',
        'asegurado_template',
        'separador_entre_asegurados',
        'adjuntos_requeridos',
        'activo',
    ];

    protected $casts = [
        'destinatarios_to'    => 'array',
        'destinatarios_cc'    => 'array',
        'destinatarios_bcc'   => 'array',
        'adjuntos_requeridos' => 'array',
        'activo'              => 'boolean',
    ];

    public function poliza()
    {
        return $this->belongsTo(Poliza::class, 'poliza_id');
    }
}

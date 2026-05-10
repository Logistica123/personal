<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * ADDENDUM 13 Parte D — adjunto (típicamente PDF) de un email del Inbox.
 * Si `es_endoso=true` el cron sugiere vincularlo automáticamente a un
 * `polizas_endosos`. Si `endoso_id` está poblado, ya fue vinculado.
 */
class PolizaSolicitudEmailAdjunto extends Model
{
    use HasFactory;

    protected $table = 'polizas_solicitud_email_adjuntos';

    protected $fillable = [
        'email_id',
        'nombre_archivo',
        'mime_type',
        'tamano_bytes',
        'contenido_base64',
        'microsoft_attachment_id',
        'storage_path',
        'es_endoso',
        'endoso_id',
        'descargado_en',
    ];

    protected $casts = [
        'es_endoso'      => 'boolean',
        'descargado_en'  => 'datetime',
    ];

    protected $hidden = [
        // No exponer el blob via API por default (es muy pesado).
        'contenido_base64',
    ];

    public function email()
    {
        return $this->belongsTo(PolizaSolicitudEmail::class, 'email_id');
    }

    public function endoso()
    {
        return $this->belongsTo(PolizaEndoso::class, 'endoso_id');
    }
}

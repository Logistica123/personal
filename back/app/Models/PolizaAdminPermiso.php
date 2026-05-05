<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PolizaAdminPermiso extends Model
{
    use HasFactory;

    protected $table = 'polizas_admin_permisos';

    protected $fillable = [
        'user_id',
        'puede_cargar_pdf',
        'puede_solicitar_alta',
        'puede_solicitar_baja',
        'puede_confirmar_respuesta',
        'puede_editar_email_config',
        'puede_gestionar_clausulas',
        'recibe_alertas_vencimiento',
        'notas',
    ];

    protected $casts = [
        'puede_cargar_pdf'           => 'boolean',
        'puede_solicitar_alta'       => 'boolean',
        'puede_solicitar_baja'       => 'boolean',
        'puede_confirmar_respuesta'  => 'boolean',
        'puede_editar_email_config'  => 'boolean',
        'puede_gestionar_clausulas'  => 'boolean',
        'recibe_alertas_vencimiento' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}

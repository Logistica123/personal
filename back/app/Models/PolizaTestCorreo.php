<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * ADDENDUM 14 Parte A — auditoría de cada test E2E del flujo de correos.
 * Cada fila representa un intento de validación del admin contra Microsoft Graph.
 */
class PolizaTestCorreo extends Model
{
    use HasFactory;

    protected $table = 'polizas_tests_correos';

    protected $fillable = [
        'user_id',
        'tipo_test',
        'fecha_inicio',
        'fecha_fin',
        'estado',
        'paso_fallo',
        'detalle_error',
        'metadata',
    ];

    protected $casts = [
        'fecha_inicio' => 'datetime',
        'fecha_fin'    => 'datetime',
        'metadata'     => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiqTarifasImportLog extends Model
{
    protected $table = 'liq_tarifas_import_log';

    protected $fillable = [
        'usuario_id',
        'cliente_id',
        'esquema_id',
        'archivo_nombre',
        'filas_totales',
        'filas_ok',
        'filas_error',
        'tipo_import',
        'resumen_json',
    ];

    protected $casts = [
        'resumen_json' => 'array',
    ];

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function cliente()
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }

    public function esquema()
    {
        return $this->belongsTo(LiqEsquemaTarifario::class, 'esquema_id');
    }
}

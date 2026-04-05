<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqArchivoEntrada extends Model
{
    use HasFactory;

    protected $table = 'liq_archivos_entrada';

    protected $fillable = [
        'liquidacion_cliente_id',
        'tipo_archivo',
        'nombre_original',
        'nombre_interno',
        'disk',
        'ruta_storage',
        'tamano',
        'cant_registros',
        'sucursal',
    ];

    protected $casts = [
        'tamano' => 'integer',
        'cant_registros' => 'integer',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function liquidacionCliente()
    {
        return $this->belongsTo(LiqLiquidacionCliente::class, 'liquidacion_cliente_id');
    }

    public function operaciones()
    {
        return $this->hasMany(LiqOperacion::class, 'archivo_entrada_id');
    }
}

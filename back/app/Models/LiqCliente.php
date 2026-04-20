<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqCliente extends Model
{
    use HasFactory;

    protected $table = 'liq_clientes';

    protected $fillable = [
        'distriapp_cliente_id',
        'razon_social',
        'nombre_corto',
        'codigo_corto',
        'cuit',
        'activo',
        'configuracion_excel',
        'configuracion_duplicados',
        'tolerancia_facturacion',
        'mostrar_eficiencia_en_pdf',
        'pagar_peajes_a_distribuidor',
    ];

    protected $casts = [
        'activo' => 'boolean',
        'configuracion_excel' => 'array',
        'configuracion_duplicados' => 'array',
        'mostrar_eficiencia_en_pdf' => 'boolean',
        'pagar_peajes_a_distribuidor' => 'boolean',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function clienteBase()
    {
        return $this->belongsTo(\App\Models\Cliente::class, 'distriapp_cliente_id');
    }

    public function esquemas()
    {
        return $this->hasMany(LiqEsquemaTarifario::class, 'cliente_id');
    }
}


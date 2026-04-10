<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiqJurisdiccionSucursal extends Model
{
    protected $table = 'liq_jurisdicciones_sucursal';

    protected $fillable = [
        'cliente_id',
        'sucursal',
        'jurisdiccion_id',
        'jurisdiccion_nombre',
    ];

    // -------------------------------------------------------------------------
    // Catalogo fijo de jurisdicciones IIBB (901-924)
    // -------------------------------------------------------------------------

    public const JURISDICCIONES = [
        901 => 'Ciudad Autonoma de Buenos Aires',
        902 => 'Buenos Aires',
        903 => 'Catamarca',
        904 => 'Cordoba',
        905 => 'Corrientes',
        906 => 'Chaco',
        907 => 'Chubut',
        908 => 'Entre Rios',
        909 => 'Formosa',
        910 => 'Jujuy',
        911 => 'La Pampa',
        912 => 'La Rioja',
        913 => 'Mendoza',
        914 => 'Misiones',
        915 => 'Neuquen',
        916 => 'Rio Negro',
        917 => 'Salta',
        918 => 'San Juan',
        919 => 'San Luis',
        920 => 'Santa Cruz',
        921 => 'Santa Fe',
        922 => 'Santiago del Estero',
        923 => 'Tierra del Fuego',
        924 => 'Tucuman',
    ];

    public static function nombreJurisdiccion(int $id): ?string
    {
        return self::JURISDICCIONES[$id] ?? null;
    }

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function cliente()
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PolizaAseguradora extends Model
{
    use HasFactory;

    protected $table = 'polizas_aseguradoras';

    protected $fillable = [
        'nombre',
        'parser_perfil',
        'cuit',
        'domicilio',
        'web',
        'email_general',
        'notas',
        'activa',
    ];

    protected $casts = [
        'activa' => 'boolean',
    ];

    public function polizas()
    {
        return $this->hasMany(Poliza::class, 'aseguradora_id');
    }
}

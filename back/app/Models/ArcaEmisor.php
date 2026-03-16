<?php

namespace App\Models;

use App\Support\Facturacion\AmbienteArca;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ArcaEmisor extends Model
{
    use HasFactory;

    protected $table = 'arca_emisor';

    protected $fillable = [
        'razon_social',
        'cuit',
        'condicion_iva',
        'ambiente_default',
        'activo',
    ];

    protected function casts(): array
    {
        return [
            'activo' => 'boolean',
            'ambiente_default' => AmbienteArca::class,
        ];
    }

    public function certificados()
    {
        return $this->hasMany(ArcaCertificado::class, 'emisor_id');
    }

    public function puntosVenta()
    {
        return $this->hasMany(ArcaPuntoVenta::class, 'emisor_id');
    }
}

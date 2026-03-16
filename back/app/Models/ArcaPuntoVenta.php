<?php

namespace App\Models;

use App\Support\Facturacion\AmbienteArca;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ArcaPuntoVenta extends Model
{
    use HasFactory;

    protected $table = 'arca_punto_venta';

    protected $fillable = [
        'emisor_id',
        'ambiente',
        'nro',
        'sistema_arca',
        'emision_tipo',
        'bloqueado',
        'fch_baja',
        'habilitado_para_erp',
        'default_para_cbte_tipo',
    ];

    protected function casts(): array
    {
        return [
            'ambiente' => AmbienteArca::class,
            'bloqueado' => 'boolean',
            'habilitado_para_erp' => 'boolean',
            'fch_baja' => 'date',
        ];
    }

    public function emisor()
    {
        return $this->belongsTo(ArcaEmisor::class, 'emisor_id');
    }
}

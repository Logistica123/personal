<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientesFacturacionConsolidado extends Model
{
    protected $table = 'vw_clientes_facturacion_consolidado';

    public $timestamps = false;

    protected $guarded = [];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function sucursal()
    {
        return $this->belongsTo(Sucursal::class, 'sucursal_id');
    }
}

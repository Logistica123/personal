<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiqConceptoFacturacion extends Model
{
    use HasFactory;

    protected $table = 'liq_conceptos_facturacion';

    protected $fillable = [
        'cliente_id',
        'tipo',
        'concepto_template',
        'orden',
        'solo_si_importe',
        'activo',
    ];

    protected $casts = [
        'solo_si_importe' => 'boolean',
        'activo' => 'boolean',
    ];

    public function cliente()
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }

    /**
     * Reemplaza variables dinámicas en el template del concepto.
     */
    public function renderConcepto(array $variables): string
    {
        $template = $this->concepto_template;

        foreach ($variables as $key => $value) {
            $template = str_replace('{' . $key . '}', (string) $value, $template);
        }

        return $template;
    }
}

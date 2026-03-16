<?php

namespace App\Models;

use App\Support\Facturacion\AmbienteArca;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ArcaTaCache extends Model
{
    use HasFactory;

    protected $table = 'arca_ta_cache';

    protected $fillable = [
        'certificado_id',
        'ambiente',
        'service_name',
        'token',
        'sign',
        'generation_time',
        'expiration_time',
    ];

    protected function casts(): array
    {
        return [
            'ambiente' => AmbienteArca::class,
            'generation_time' => 'datetime',
            'expiration_time' => 'datetime',
        ];
    }

    public function certificado()
    {
        return $this->belongsTo(ArcaCertificado::class, 'certificado_id');
    }
}

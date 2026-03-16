<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AuditoriaFacturacion extends Model
{
    use HasFactory;

    public const UPDATED_AT = null;

    protected $table = 'auditoria_facturacion';

    protected $fillable = [
        'entidad',
        'entidad_id',
        'evento',
        'payload_before_json',
        'payload_after_json',
        'usuario_id',
        'ip',
    ];

    protected function casts(): array
    {
        return [
            'payload_before_json' => 'array',
            'payload_after_json' => 'array',
        ];
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}

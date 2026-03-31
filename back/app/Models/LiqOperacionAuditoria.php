<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiqOperacionAuditoria extends Model
{
    protected $table = 'liq_operacion_auditorias';

    protected $fillable = [
        'operacion_id',
        'accion',
        'usuario_id',
        'valores_anteriores',
        'valores_nuevos',
        'motivo',
    ];

    protected function casts(): array
    {
        return [
            'valores_anteriores' => 'array',
            'valores_nuevos' => 'array',
        ];
    }

    public function operacion(): BelongsTo
    {
        return $this->belongsTo(LiqOperacion::class, 'operacion_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}


<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiqAuditoriaTarifa extends Model
{
    protected $table = 'liq_auditoria_tarifa';

    protected $fillable = [
        'linea_tarifa_id',
        'accion',
        'valores_anteriores',
        'valores_nuevos',
        'usuario_id',
        'motivo',
    ];

    protected function casts(): array
    {
        return [
            'valores_anteriores' => 'array',
            'valores_nuevos'     => 'array',
        ];
    }

    public function lineaTarifa(): BelongsTo
    {
        return $this->belongsTo(LiqLineaTarifa::class, 'linea_tarifa_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}

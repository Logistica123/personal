<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiqAuditoriaTarifaLog extends Model
{
    protected $table = 'liq_auditoria_tarifa_log';

    protected $fillable = [
        'esquema_id',
        'linea_id',
        'override_id',
        'campo',
        'valor_anterior',
        'valor_nuevo',
        'tipo',
        'motivo',
        'usuario_id',
    ];

    public static function registrar(
        int $esquemaId,
        string $campo,
        ?float $valorAnterior,
        ?float $valorNuevo,
        string $tipo,
        ?string $motivo = null,
        ?int $lineaId = null,
        ?int $overrideId = null,
        ?int $usuarioId = null,
    ): self {
        return self::create([
            'esquema_id' => $esquemaId,
            'linea_id' => $lineaId,
            'override_id' => $overrideId,
            'campo' => $campo,
            'valor_anterior' => $valorAnterior,
            'valor_nuevo' => $valorNuevo,
            'tipo' => $tipo,
            'motivo' => $motivo,
            'usuario_id' => $usuarioId,
        ]);
    }
}

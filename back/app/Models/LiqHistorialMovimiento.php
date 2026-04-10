<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiqHistorialMovimiento extends Model
{
    protected $table = 'liq_historial_movimientos';

    protected $fillable = [
        'liquidacion_cliente_id',
        'liquidacion_distribuidor_id',
        'persona_id',
        'user_id',
        'evento',
        'descripcion',
        'datos_json',
    ];

    protected $casts = [
        'datos_json' => 'array',
    ];

    public static function registrar(
        string $evento,
        string $descripcion,
        ?int $userId = null,
        ?int $liquidacionClienteId = null,
        ?int $liquidacionDistribuidorId = null,
        ?int $personaId = null,
        ?array $datos = null,
    ): self {
        return self::create([
            'liquidacion_cliente_id' => $liquidacionClienteId,
            'liquidacion_distribuidor_id' => $liquidacionDistribuidorId,
            'persona_id' => $personaId,
            'user_id' => $userId,
            'evento' => $evento,
            'descripcion' => $descripcion,
            'datos_json' => $datos,
        ]);
    }
}

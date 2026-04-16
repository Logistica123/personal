<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiqHistorialAuditoria extends Model
{
    public $timestamps = false;

    protected $table = 'liq_historial_auditoria';

    protected $fillable = [
        'entidad_tipo',
        'entidad_id',
        'accion',
        'valores_anteriores',
        'valores_nuevos',
        'motivo',
        'usuario_id',
        'usuario_nombre',
        'ip_address',
        'created_at',
    ];

    protected $casts = [
        'valores_anteriores' => 'array',
        'valores_nuevos' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * Registra una entrada de auditoria.
     */
    public static function registrar(
        string $entidadTipo,
        int $entidadId,
        string $accion,
        ?array $valoresAnteriores = null,
        ?array $valoresNuevos = null,
        ?string $motivo = null,
        ?\App\Models\User $usuario = null,
        ?string $ip = null,
    ): self {
        return self::create([
            'entidad_tipo' => $entidadTipo,
            'entidad_id' => $entidadId,
            'accion' => $accion,
            'valores_anteriores' => $valoresAnteriores,
            'valores_nuevos' => $valoresNuevos,
            'motivo' => $motivo,
            'usuario_id' => $usuario?->id,
            'usuario_nombre' => $usuario?->name ?? 'Sistema',
            'ip_address' => $ip,
            'created_at' => now(),
        ]);
    }
}

<?php

namespace App\Services\Facturacion;

use App\Models\AuditoriaFacturacion;

class FacturacionAuditService
{
    public function record(
        string $entidad,
        int $entidadId,
        string $evento,
        array|null $before = null,
        array|null $after = null,
        ?int $usuarioId = null,
        ?string $ip = null
    ): AuditoriaFacturacion {
        return AuditoriaFacturacion::query()->create([
            'entidad' => $entidad,
            'entidad_id' => $entidadId,
            'evento' => $evento,
            'payload_before_json' => $before,
            'payload_after_json' => $after,
            'usuario_id' => $usuarioId,
            'ip' => $ip,
        ]);
    }
}

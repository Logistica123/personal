<?php

namespace App\Repositories\Arca;

use App\Models\ArcaCertificado;
use App\Support\Facturacion\AmbienteArca;

class ArcaCertificadoRepository
{
    public function findActiveForEmisor(int $emisorId, AmbienteArca|string $ambiente): ?ArcaCertificado
    {
        $target = $ambiente instanceof AmbienteArca ? $ambiente : AmbienteArca::fromMixed((string) $ambiente);

        return ArcaCertificado::query()
            ->with('emisor')
            ->where('emisor_id', $emisorId)
            ->where('ambiente', $target->value)
            ->where('activo', true)
            ->orderByDesc('valid_to')
            ->orderByDesc('id')
            ->first();
    }
}

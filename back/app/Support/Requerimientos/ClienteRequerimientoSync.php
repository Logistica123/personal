<?php

namespace App\Support\Requerimientos;

use App\Models\ClienteRequerimiento;
use App\Models\Persona;
use App\Models\SolicitudPersonal;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ClienteRequerimientoSync
{
    private const CONSUMO_MARKER = '[CONSUMO]';

    private static function isReady(): bool
    {
        if (! Schema::hasTable('cliente_requerimientos')) {
            return false;
        }
        return Schema::hasColumn('cliente_requerimientos', 'source_type')
            && Schema::hasColumn('cliente_requerimientos', 'source_id')
            && Schema::hasColumn('cliente_requerimientos', 'cliente_id')
            && Schema::hasColumn('cliente_requerimientos', 'sucursal_id')
            && Schema::hasColumn('cliente_requerimientos', 'unidad_id')
            && Schema::hasColumn('cliente_requerimientos', 'requerimiento');
    }

    public static function syncFromPersonaSolicitud(Persona $persona): void
    {
        if (! self::isReady()) {
            return;
        }

        $clienteId = $persona->cliente_id ? (int) $persona->cliente_id : null;
        $sucursalId = $persona->sucursal_id ? (int) $persona->sucursal_id : null;
        $unidadId = $persona->unidad_id ? (int) $persona->unidad_id : null;

        if (! $clienteId) {
            return;
        }

        $source = ClienteRequerimiento::query()
            ->where('source_type', 'persona')
            ->where('source_id', (int) $persona->id)
            ->first();

        if ($source && $source->requerimiento === self::CONSUMO_MARKER) {
            return;
        }

        if (! $persona->es_solicitud && ! $source) {
            return;
        }

        $shouldApply = false;
        if (! $source) {
            $source = new ClienteRequerimiento();
            $source->source_type = 'persona';
            $source->source_id = (int) $persona->id;
            $shouldApply = true;
        } else {
            // Legacy sources (e.g., "Solicitud de alta: ...") should be applied once.
            $shouldApply = true;
        }

        $source->cliente_id = $clienteId;
        $source->sucursal_id = $sucursalId;
        $source->unidad_id = $unidadId;
        $source->requerimiento = self::CONSUMO_MARKER;
        $source->save();

        if ($shouldApply) {
            self::decrementManualRequirement($clienteId, $sucursalId, $unidadId);
        }
    }

    public static function syncFromSolicitudPersonal(SolicitudPersonal $solicitud): void
    {
        // No-op for now: los requerimientos se consumen desde solicitudes de alta (Persona).
        // Mantenemos el hook por compatibilidad, pero evitamos ensuciar la tabla/lista.
    }

    public static function deleteSource(string $type, int $id): void
    {
        if (! self::isReady()) {
            return;
        }

        ClienteRequerimiento::query()
            ->where('source_type', $type)
            ->where('source_id', $id)
            ->delete();
    }

    private static function decrementManualRequirement(int $clienteId, ?int $sucursalId, ?int $unidadId): void
    {
        $manual = ClienteRequerimiento::query()
            ->whereNull('source_type')
            ->where('cliente_id', $clienteId)
            ->when($sucursalId !== null, fn ($q) => $q->where('sucursal_id', $sucursalId), fn ($q) => $q->whereNull('sucursal_id'))
            ->when($unidadId !== null, fn ($q) => $q->where('unidad_id', $unidadId), fn ($q) => $q->whereNull('unidad_id'))
            ->orderBy('id')
            ->first();

        if (! $manual) {
            return;
        }

        $current = trim((string) ($manual->requerimiento ?? ''));
        if ($current === '') {
            return;
        }

        if (! preg_match('/^(\d+)\s+(.*)$/u', $current, $matches)) {
            return;
        }

        $count = (int) $matches[1];
        $rest = trim((string) ($matches[2] ?? ''));
        if ($count <= 0) {
            return;
        }

        $next = max(0, $count - 1);
        $manual->requerimiento = $rest !== '' ? "{$next} {$rest}" : (string) $next;
        $manual->save();
    }
}

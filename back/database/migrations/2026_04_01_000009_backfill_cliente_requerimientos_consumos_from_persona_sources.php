<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Models\ClienteRequerimiento;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('cliente_requerimientos')) {
            return;
        }

        foreach (['source_type', 'source_id', 'cliente_id', 'sucursal_id', 'unidad_id', 'requerimiento'] as $column) {
            if (! Schema::hasColumn('cliente_requerimientos', $column)) {
                return;
            }
        }

        ClienteRequerimiento::query()
            ->where('source_type', 'persona')
            ->whereNotNull('source_id')
            ->where('requerimiento', '!=', '[CONSUMO]')
            ->orderBy('id')
            ->chunkById(200, function ($rows) {
                foreach ($rows as $source) {
                    $clienteId = (int) ($source->cliente_id ?? 0);
                    if ($clienteId <= 0) {
                        $source->requerimiento = '[CONSUMO]';
                        $source->save();
                        continue;
                    }

                    $sucursalId = $source->sucursal_id !== null ? (int) $source->sucursal_id : null;
                    $unidadId = $source->unidad_id !== null ? (int) $source->unidad_id : null;

                    $manual = ClienteRequerimiento::query()
                        ->whereNull('source_type')
                        ->where('cliente_id', $clienteId)
                        ->when($sucursalId !== null, fn ($q) => $q->where('sucursal_id', $sucursalId), fn ($q) => $q->whereNull('sucursal_id'))
                        ->when($unidadId !== null, fn ($q) => $q->where('unidad_id', $unidadId), fn ($q) => $q->whereNull('unidad_id'))
                        ->orderBy('id')
                        ->first();

                    if ($manual) {
                        $current = trim((string) ($manual->requerimiento ?? ''));
                        if (preg_match('/^(\d+)\s+(.*)$/u', $current, $matches)) {
                            $count = (int) $matches[1];
                            $rest = trim((string) ($matches[2] ?? ''));
                            if ($count > 0) {
                                $next = max(0, $count - 1);
                                $manual->requerimiento = $rest !== '' ? "{$next} {$rest}" : (string) $next;
                                $manual->save();
                            }
                        }
                    }

                    $source->requerimiento = '[CONSUMO]';
                    $source->save();
                }
            });
    }

    public function down(): void
    {
        // No reversible: no conocemos los valores previos.
    }
};


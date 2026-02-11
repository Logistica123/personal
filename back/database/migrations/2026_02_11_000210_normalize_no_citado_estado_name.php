<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('estados')) {
            return;
        }

        $estadoNoCitado = DB::table('estados')
            ->select('id')
            ->whereRaw('LOWER(TRIM(nombre)) = ?', ['no citado'])
            ->first();

        $estadoNoSitadoIds = DB::table('estados')
            ->whereRaw('LOWER(TRIM(nombre)) = ?', ['no sitado'])
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        if ($estadoNoCitado && $estadoNoSitadoIds->isNotEmpty()) {
            if (Schema::hasTable('personas') && Schema::hasColumn('personas', 'estado_id')) {
                DB::table('personas')
                    ->whereIn('estado_id', $estadoNoSitadoIds->all())
                    ->update(['estado_id' => (int) $estadoNoCitado->id]);
            }

            DB::table('estados')
                ->whereIn('id', $estadoNoSitadoIds->all())
                ->delete();

            return;
        }

        if (! $estadoNoCitado && $estadoNoSitadoIds->isNotEmpty()) {
            $keepId = (int) $estadoNoSitadoIds->first();

            DB::table('estados')
                ->where('id', $keepId)
                ->update(['nombre' => 'No citado']);

            $redundantIds = $estadoNoSitadoIds
                ->filter(fn ($id) => (int) $id !== $keepId)
                ->values();

            if ($redundantIds->isNotEmpty()) {
                if (Schema::hasTable('personas') && Schema::hasColumn('personas', 'estado_id')) {
                    DB::table('personas')
                        ->whereIn('estado_id', $redundantIds->all())
                        ->update(['estado_id' => $keepId]);
                }

                DB::table('estados')
                    ->whereIn('id', $redundantIds->all())
                    ->delete();
            }

            return;
        }

        if (! $estadoNoCitado) {
            DB::table('estados')->insert([
                'nombre' => 'No citado',
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('estados')) {
            return;
        }

        DB::table('estados')
            ->whereRaw('LOWER(TRIM(nombre)) = ?', ['no citado'])
            ->update(['nombre' => 'No sitado']);
    }
};


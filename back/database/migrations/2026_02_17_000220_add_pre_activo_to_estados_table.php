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

        $exists = DB::table('estados')
            ->whereRaw("LOWER(REPLACE(REPLACE(TRIM(nombre), '-', ' '), '_', ' ')) = ?", ['pre activo'])
            ->exists();

        if (! $exists) {
            DB::table('estados')->insert([
                'nombre' => 'Pre activo',
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('estados')) {
            return;
        }

        $preActivoIds = DB::table('estados')
            ->whereRaw("LOWER(REPLACE(REPLACE(TRIM(nombre), '-', ' '), '_', ' ')) = ?", ['pre activo'])
            ->pluck('id');

        if ($preActivoIds->isEmpty()) {
            return;
        }

        if (Schema::hasTable('personas') && Schema::hasColumn('personas', 'estado_id')) {
            $inUse = DB::table('personas')
                ->whereIn('estado_id', $preActivoIds->all())
                ->exists();

            if ($inUse) {
                return;
            }
        }

        DB::table('estados')
            ->whereIn('id', $preActivoIds->all())
            ->delete();
    }
};

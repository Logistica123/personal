<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('reclamo_types')) {
            return;
        }

        $now = now();
        $slug = 'reclamos-y-adelantos';

        $exists = DB::table('reclamo_types')
            ->where('slug', $slug)
            ->exists();

        if ($exists) {
            DB::table('reclamo_types')
                ->where('slug', $slug)
                ->update([
                    'nombre' => 'Reclamos y Adelantos',
                    'updated_at' => $now,
                ]);

            return;
        }

        DB::table('reclamo_types')->insert([
            'nombre' => 'Reclamos y Adelantos',
            'slug' => $slug,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('reclamo_types')) {
            return;
        }

        DB::table('reclamo_types')
            ->where('slug', 'reclamos-y-adelantos')
            ->delete();
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('reclamo_types')) {
            return;
        }

        $now = now();

        $tipos = [
            [
                'nombre' => 'Dis faltantes',
                'slug' => 'dis-faltantes',
            ],
            [
                'nombre' => 'Diferencia de tarifa',
                'slug' => 'diferencia-de-tarifa',
            ],
        ];

        foreach ($tipos as $tipo) {
            $exists = DB::table('reclamo_types')
                ->where('slug', $tipo['slug'])
                ->exists();

            if ($exists) {
                DB::table('reclamo_types')
                    ->where('slug', $tipo['slug'])
                    ->update([
                        'nombre' => $tipo['nombre'],
                        'updated_at' => $now,
                    ]);

                continue;
            }

            DB::table('reclamo_types')->insert([
                'nombre' => $tipo['nombre'],
                'slug' => $tipo['slug'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('reclamo_types')) {
            return;
        }

        DB::table('reclamo_types')
            ->whereIn('slug', ['dis-faltantes', 'diferencia-de-tarifa'])
            ->delete();
    }
};

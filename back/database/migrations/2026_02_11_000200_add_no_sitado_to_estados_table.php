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
            ->whereRaw('LOWER(TRIM(nombre)) = ?', ['no citado'])
            ->exists();

        if (! $exists) {
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
            ->delete();
    }
};

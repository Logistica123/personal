<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('reclamos') || ! Schema::hasColumn('reclamos', 'persona_id')) {
            return;
        }

        DB::statement('ALTER TABLE reclamos MODIFY persona_id BIGINT UNSIGNED NULL');
    }

    public function down(): void
    {
        if (! Schema::hasTable('reclamos') || ! Schema::hasColumn('reclamos', 'persona_id')) {
            return;
        }

        $hasNulls = DB::table('reclamos')->whereNull('persona_id')->exists();
        if ($hasNulls) {
            return;
        }

        DB::statement('ALTER TABLE reclamos MODIFY persona_id BIGINT UNSIGNED NOT NULL');
    }
};

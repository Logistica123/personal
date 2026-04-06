<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('reclamos') || ! Schema::hasColumn('reclamos', 'detalle')) {
            return;
        }

        DB::statement('ALTER TABLE reclamos MODIFY detalle TEXT NULL');
    }

    public function down(): void
    {
        if (! Schema::hasTable('reclamos') || ! Schema::hasColumn('reclamos', 'detalle')) {
            return;
        }

        DB::statement('ALTER TABLE reclamos MODIFY detalle VARCHAR(250) NULL');
    }
};


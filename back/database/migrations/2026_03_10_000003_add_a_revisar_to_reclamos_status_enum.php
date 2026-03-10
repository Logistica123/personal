<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('reclamos') || ! Schema::hasColumn('reclamos', 'status')) {
            return;
        }

        DB::statement(
            "ALTER TABLE reclamos MODIFY status ENUM('creado','en_proceso','a_revisar','aceptado','rechazado','finalizado') NOT NULL DEFAULT 'creado'"
        );
    }

    public function down(): void
    {
        if (! Schema::hasTable('reclamos') || ! Schema::hasColumn('reclamos', 'status')) {
            return;
        }

        $hasARevisar = DB::table('reclamos')->where('status', 'a_revisar')->exists();
        if ($hasARevisar) {
            return;
        }

        DB::statement(
            "ALTER TABLE reclamos MODIFY status ENUM('creado','en_proceso','aceptado','rechazado','finalizado') NOT NULL DEFAULT 'creado'"
        );
    }
};

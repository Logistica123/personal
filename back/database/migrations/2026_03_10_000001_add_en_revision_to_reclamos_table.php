<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('reclamos') || Schema::hasColumn('reclamos', 'en_revision')) {
            return;
        }

        Schema::table('reclamos', function (Blueprint $table) {
            $table->boolean('en_revision')->default(false)->after('bloqueado_en');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('reclamos') || ! Schema::hasColumn('reclamos', 'en_revision')) {
            return;
        }

        Schema::table('reclamos', function (Blueprint $table) {
            $table->dropColumn('en_revision');
        });
    }
};

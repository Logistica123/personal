<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            if (! Schema::hasColumn('archivos', 'es_pendiente')) {
                $table->boolean('es_pendiente')->default(false)->after('parent_document_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            if (Schema::hasColumn('archivos', 'es_pendiente')) {
                $table->dropColumn('es_pendiente');
            }
        });
    }
};

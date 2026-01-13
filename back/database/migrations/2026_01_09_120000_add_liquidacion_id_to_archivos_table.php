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
            if (! Schema::hasColumn('archivos', 'liquidacion_id')) {
                $table->unsignedBigInteger('liquidacion_id')->nullable()->after('parent_document_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            if (Schema::hasColumn('archivos', 'liquidacion_id')) {
                $table->dropColumn('liquidacion_id');
            }
        });
    }
};

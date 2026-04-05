<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cliente_requerimientos', function (Blueprint $table) {
            if (! Schema::hasColumn('cliente_requerimientos', 'source_type')) {
                $table->string('source_type')->nullable()->after('sucursal_id');
            }
            if (! Schema::hasColumn('cliente_requerimientos', 'source_id')) {
                $table->unsignedBigInteger('source_id')->nullable()->after('source_type');
            }

            $table->index(['source_type', 'source_id'], 'cliente_requerimientos_source_idx');
            $table->unique(['source_type', 'source_id'], 'cliente_requerimientos_source_unique');
        });
    }

    public function down(): void
    {
        Schema::table('cliente_requerimientos', function (Blueprint $table) {
            if (Schema::hasColumn('cliente_requerimientos', 'source_type')) {
                $table->dropUnique('cliente_requerimientos_source_unique');
                $table->dropIndex('cliente_requerimientos_source_idx');
                $table->dropColumn('source_type');
            }
            if (Schema::hasColumn('cliente_requerimientos', 'source_id')) {
                $table->dropColumn('source_id');
            }
        });
    }
};


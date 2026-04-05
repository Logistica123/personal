<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cliente_requerimientos', function (Blueprint $table) {
            if (Schema::hasColumn('cliente_requerimientos', 'cantidad')) {
                $table->dropColumn('cantidad');
            }
        });
    }

    public function down(): void
    {
        Schema::table('cliente_requerimientos', function (Blueprint $table) {
            if (! Schema::hasColumn('cliente_requerimientos', 'cantidad')) {
                $table->unsignedInteger('cantidad')->default(1)->after('requerimiento');
            }
        });
    }
};


<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            if (! Schema::hasColumn('personas', 'fecha_baja')) {
                $table->date('fecha_baja')->nullable()->after('fecha_alta');
            }
        });
    }

    public function down(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            if (Schema::hasColumn('personas', 'fecha_baja')) {
                $table->dropColumn('fecha_baja');
            }
        });
    }
};

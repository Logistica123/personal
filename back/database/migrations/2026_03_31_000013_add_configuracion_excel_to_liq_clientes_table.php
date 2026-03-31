<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_clientes', function (Blueprint $table) {
            if (! Schema::hasColumn('liq_clientes', 'configuracion_excel')) {
                $table->json('configuracion_excel')->nullable()->after('activo');
            }
        });
    }

    public function down(): void
    {
        Schema::table('liq_clientes', function (Blueprint $table) {
            if (Schema::hasColumn('liq_clientes', 'configuracion_excel')) {
                $table->dropColumn('configuracion_excel');
            }
        });
    }
};


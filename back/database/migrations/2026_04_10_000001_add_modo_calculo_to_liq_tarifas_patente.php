<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_tarifas_patente', function (Blueprint $table) {
            $table->string('modo_calculo', 20)->nullable()->after('activo');
            $table->decimal('valor_referencia', 12, 4)->nullable()->after('modo_calculo');
        });
    }

    public function down(): void
    {
        Schema::table('liq_tarifas_patente', function (Blueprint $table) {
            $table->dropColumn(['modo_calculo', 'valor_referencia']);
        });
    }
};

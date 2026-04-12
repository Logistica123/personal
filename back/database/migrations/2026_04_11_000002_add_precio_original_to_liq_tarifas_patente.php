<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_tarifas_patente', function (Blueprint $table) {
            $table->decimal('precio_original', 12, 2)->nullable()->after('valor_referencia')
                ->comment('Tarifa del cliente para este distribuidor. NULL = usar liq_lineas_tarifa.precio_original');
        });
    }

    public function down(): void
    {
        Schema::table('liq_tarifas_patente', function (Blueprint $table) {
            $table->dropColumn('precio_original');
        });
    }
};

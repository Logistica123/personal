<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clientes', function (Blueprint $table) {
            $table->json('liq_configuracion_excel')->nullable();
            $table->boolean('liq_activo')->default(false);
            $table->decimal('liq_tolerancia_porcentaje', 5, 2)->default(2.00);
        });
    }

    public function down(): void
    {
        Schema::table('clientes', function (Blueprint $table) {
            $table->dropColumn(['liq_configuracion_excel', 'liq_activo', 'liq_tolerancia_porcentaje']);
        });
    }
};

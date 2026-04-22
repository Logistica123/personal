<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agranda liq_operaciones.modelo_calculo de VARCHAR(10) a VARCHAR(20).
 * El motor v5 usa tags "DISTRIBUIDOR", "PATENTE", "BASE" que eran más cortos en M1/M2/M3
 * pero "DISTRIBUIDOR" (12 chars) excede los 10 actuales y rompe updates.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_operaciones', function (Blueprint $table) {
            $table->string('modelo_calculo', 20)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('liq_operaciones', function (Blueprint $table) {
            $table->string('modelo_calculo', 10)->nullable()->change();
        });
    }
};

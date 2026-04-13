<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            $table->string('medio_pago', 50)->nullable()->after('cbu_alias');
        });

        Schema::table('liq_ordenes_pago', function (Blueprint $table) {
            $table->string('medio_pago', 50)->nullable()->after('agrupacion');
        });

        Schema::table('liq_ordenes_pago_detalle', function (Blueprint $table) {
            $table->string('medio_pago', 50)->nullable()->after('fuente');
        });
    }

    public function down(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            $table->dropColumn('medio_pago');
        });
        Schema::table('liq_ordenes_pago', function (Blueprint $table) {
            $table->dropColumn('medio_pago');
        });
        Schema::table('liq_ordenes_pago_detalle', function (Blueprint $table) {
            $table->dropColumn('medio_pago');
        });
    }
};

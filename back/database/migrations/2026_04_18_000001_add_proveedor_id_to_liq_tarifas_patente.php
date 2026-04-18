<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_tarifas_patente', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_tarifas_patente', 'proveedor_id')) {
                $table->unsignedBigInteger('proveedor_id')->nullable()->after('patente_norm');
                $table->foreign('proveedor_id')->references('id')->on('personas')->nullOnDelete();
                $table->index('proveedor_id', 'idx_tp_proveedor');
            }
        });
    }

    public function down(): void
    {
        Schema::table('liq_tarifas_patente', function (Blueprint $table) {
            if (Schema::hasColumn('liq_tarifas_patente', 'proveedor_id')) {
                $table->dropForeign(['proveedor_id']);
                $table->dropIndex('idx_tp_proveedor');
                $table->dropColumn('proveedor_id');
            }
        });
    }
};

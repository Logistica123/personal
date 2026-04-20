<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'eficiencia_pct')) {
                $table->decimal('eficiencia_pct', 6, 2)->nullable()->after('total_a_pagar');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'eficiencia_detalle')) {
                $table->json('eficiencia_detalle')->nullable()->after('eficiencia_pct');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'eficiencia_calculada_at')) {
                $table->timestamp('eficiencia_calculada_at')->nullable()->after('eficiencia_detalle');
            }
        });

        Schema::table('liq_clientes', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_clientes', 'mostrar_eficiencia_en_pdf')) {
                $table->boolean('mostrar_eficiencia_en_pdf')->default(true)->after('tolerancia_facturacion');
            }
        });
    }

    public function down(): void
    {
        Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            $table->dropColumn(['eficiencia_pct', 'eficiencia_detalle', 'eficiencia_calculada_at']);
        });
        Schema::table('liq_clientes', function (Blueprint $table) {
            $table->dropColumn('mostrar_eficiencia_en_pdf');
        });
    }
};

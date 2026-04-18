<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_operaciones', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_operaciones', 'peaje_autorizado')) {
                $table->boolean('peaje_autorizado')->default(false)->after('importe_no_gravado');
            }
            if (!Schema::hasColumn('liq_operaciones', 'peaje_monto_ajustado')) {
                $table->decimal('peaje_monto_ajustado', 12, 2)->nullable()->after('peaje_autorizado');
            }
            if (!Schema::hasColumn('liq_operaciones', 'peaje_motivo')) {
                $table->string('peaje_motivo', 255)->nullable()->after('peaje_monto_ajustado');
            }
        });

        Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'total_reembolso_peajes')) {
                $table->decimal('total_reembolso_peajes', 12, 2)->default(0)->after('total_a_pagar');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'peajes_autorizados_at')) {
                $table->timestamp('peajes_autorizados_at')->nullable()->after('total_reembolso_peajes');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'peajes_autorizados_por')) {
                $table->unsignedBigInteger('peajes_autorizados_por')->nullable()->after('peajes_autorizados_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('liq_operaciones', function (Blueprint $table) {
            $table->dropColumn(['peaje_autorizado', 'peaje_monto_ajustado', 'peaje_motivo']);
        });
        Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            $table->dropColumn(['total_reembolso_peajes', 'peajes_autorizados_at', 'peajes_autorizados_por']);
        });
    }
};

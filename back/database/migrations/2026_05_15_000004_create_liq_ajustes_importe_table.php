<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM Pagos — Feature C (ajuste manual de importe a pagar).
 *
 * Tabla dedicada de auditoria de ajustes para mostrar tooltip "ajustes historicos"
 * directo en la fila sin tener que abrir la auditoria generica. Cada ajuste guarda
 * importe antes/despues + motivo + usuario.
 *
 * Tambien agrega flags en liq_liquidaciones_distribuidor:
 *   total_a_pagar_overridido  → indica que el importe fue tocado manualmente
 *   requiere_revision_dual    → ajuste >20%, espera aprobacion de un 2do admin
 */
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('liq_ajustes_importe')) {
            Schema::create('liq_ajustes_importe', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('liq_id');
                $table->decimal('importe_antes', 15, 2);
                $table->decimal('importe_despues', 15, 2);
                $table->decimal('diferencia', 15, 2);
                $table->decimal('diferencia_pct', 8, 2);
                $table->string('motivo', 500);
                $table->unsignedBigInteger('user_id');
                $table->boolean('requiere_revision_dual')->default(false);
                $table->unsignedBigInteger('aprobado_por')->nullable();
                $table->timestamp('aprobado_at')->nullable();
                $table->timestamp('created_at')->useCurrent();

                $table->index('liq_id', 'idx_ajustes_liq');
                $table->index('user_id', 'idx_ajustes_user');
                $table->foreign('liq_id')
                    ->references('id')->on('liq_liquidaciones_distribuidor')
                    ->onDelete('cascade');
            });
        }

        Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'total_a_pagar_overridido')) {
                $table->boolean('total_a_pagar_overridido')->default(false)->after('total_a_pagar');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'requiere_revision_dual')) {
                $table->boolean('requiere_revision_dual')->default(false)->after('total_a_pagar_overridido');
            }
        });
    }

    public function down(): void
    {
        Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            foreach (['requiere_revision_dual', 'total_a_pagar_overridido'] as $col) {
                if (Schema::hasColumn('liq_liquidaciones_distribuidor', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
        if (Schema::hasTable('liq_ajustes_importe')) {
            Schema::drop('liq_ajustes_importe');
        }
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC TÉCNICO INTEGRAL — Fase A
 *
 * Eficiencia persistida a nivel liq_operaciones (antes vivía agregada en liq_liquidaciones_distribuidor).
 * Esto permite ver eficiencia por operación en la tabla Auditoría y calcular la del período
 * como SUM(paradas_exitosas)/SUM(paradas_con_motivo) en vez de promedio de promedios.
 *
 * Además: persistir penalidades del TMS (Pen.POD + Pen.NO.POD + Penalidad + Pen.Hs.Caídas)
 * en columna dedicada para restarlas en el motor de cálculo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_operaciones', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_operaciones', 'penalidades_tms')) {
                $table->decimal('penalidades_tms', 12, 2)->default(0)->after('costo_cant')
                    ->comment('Suma Pen.POD + Pen.NO.POD + Penalidad + Pen.Hs.Caídas del TMS (se resta del pago distrib)');
            }
            if (!Schema::hasColumn('liq_operaciones', 'paradas_ycc_total')) {
                $table->unsignedInteger('paradas_ycc_total')->nullable()->after('penalidades_tms');
            }
            if (!Schema::hasColumn('liq_operaciones', 'paradas_con_motivo')) {
                $table->unsignedInteger('paradas_con_motivo')->nullable()->after('paradas_ycc_total')
                    ->comment('Denominador de eficiencia — paradas con motivo != NULL/""');
            }
            if (!Schema::hasColumn('liq_operaciones', 'paradas_exitosas')) {
                $table->unsignedInteger('paradas_exitosas')->nullable()->after('paradas_con_motivo')
                    ->comment('Numerador — paradas con motivo en liq_motivos_exitosos es_exitoso=1');
            }
            if (!Schema::hasColumn('liq_operaciones', 'eficiencia_pct')) {
                $table->decimal('eficiencia_pct', 5, 2)->nullable()->after('paradas_exitosas')
                    ->comment('100 × paradas_exitosas / paradas_con_motivo');
            }
            if (!Schema::hasColumn('liq_operaciones', 'eficiencia_calculada_at')) {
                $table->timestamp('eficiencia_calculada_at')->nullable()->after('eficiencia_pct');
            }
        });

        if (!Schema::hasTable('liq_auditoria_eficiencia')) {
            Schema::create('liq_auditoria_eficiencia', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('operacion_id')->index();
                $table->decimal('eficiencia_anterior', 5, 2)->nullable();
                $table->decimal('eficiencia_nueva', 5, 2)->nullable();
                $table->unsignedInteger('paradas_exitosas_ant')->nullable();
                $table->unsignedInteger('paradas_exitosas_nue')->nullable();
                $table->unsignedInteger('paradas_con_motivo_ant')->nullable();
                $table->unsignedInteger('paradas_con_motivo_nue')->nullable();
                $table->string('motivo_recalculo', 200)->nullable();
                $table->unsignedBigInteger('usuario_id')->nullable();
                $table->timestamp('created_at')->useCurrent();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_auditoria_eficiencia');
        Schema::table('liq_operaciones', function (Blueprint $table) {
            $table->dropColumn([
                'penalidades_tms', 'paradas_ycc_total', 'paradas_con_motivo',
                'paradas_exitosas', 'eficiencia_pct', 'eficiencia_calculada_at',
            ]);
        });
    }
};

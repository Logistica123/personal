<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // B1: Campo origen en liq_operaciones
        if (!Schema::hasColumn('liq_operaciones', 'origen')) {
            Schema::table('liq_operaciones', function (Blueprint $table) {
                $table->string('origen', 20)->default('parser')->after('tipo_operacion');
            });
        }

        // D1: Campo origen en liq_liquidaciones_distribuidor
        if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'origen')) {
            Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
                $table->string('origen', 20)->default('automatica')->after('estado');
                $table->string('referencia_externa', 255)->nullable()->after('origen');
                $table->text('observaciones_manual')->nullable()->after('referencia_externa');
            });
        }

        // D2: Hacer liquidacion_cliente_id nullable para liquidaciones manuales
        if (Schema::hasColumn('liq_liquidaciones_distribuidor', 'liquidacion_cliente_id')) {
            // Drop FK, modify column, re-add FK
            Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
                $table->dropForeign(['liquidacion_cliente_id']);
            });
            Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
                $table->unsignedBigInteger('liquidacion_cliente_id')->nullable()->change();
            });
            Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
                $table->foreign('liquidacion_cliente_id')
                    ->references('id')->on('liq_liquidaciones_cliente')
                    ->nullOnDelete();
            });
            // Drop the unique constraint that requires liquidacion_cliente_id
            try {
                Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
                    $table->dropUnique(['liquidacion_cliente_id', 'distribuidor_id']);
                });
            } catch (\Throwable $e) {
                // Already dropped or doesn't exist
            }
        }

        // D: Campo cliente_id directo en liq_liquidaciones_distribuidor para manuales
        if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'cliente_id')) {
            Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
                $table->unsignedBigInteger('cliente_id')->nullable()->after('liquidacion_cliente_id');
                $table->foreign('cliente_id')->references('id')->on('liq_clientes')->nullOnDelete();
            });
        }

        // C1: Tabla liq_mapeos_sucursal_distribuidor (ALL clients)
        if (!Schema::hasTable('liq_mapeos_sucursal_distribuidor')) {
            Schema::create('liq_mapeos_sucursal_distribuidor', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('cliente_id');
                $table->string('sucursal', 50);
                $table->unsignedBigInteger('persona_id');
                $table->boolean('es_unico')->default(false);
                $table->unsignedBigInteger('creado_por')->nullable();
                $table->timestamps();

                $table->foreign('cliente_id')->references('id')->on('liq_clientes')->cascadeOnDelete();
                $table->foreign('persona_id')->references('id')->on('personas')->cascadeOnDelete();
                $table->foreign('creado_por')->references('id')->on('users')->nullOnDelete();
                $table->unique(['cliente_id', 'sucursal', 'persona_id'], 'uk_cliente_suc_persona');
                $table->index(['cliente_id', 'sucursal']);
            });
        }

        // D: Tabla liq_liquidacion_manual_detalle para lineas de liquidaciones manuales
        if (!Schema::hasTable('liq_liquidacion_manual_detalle')) {
            Schema::create('liq_liquidacion_manual_detalle', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('liquidacion_distribuidor_id');
                $table->string('concepto', 200);
                $table->string('descripcion', 500)->nullable();
                $table->decimal('cantidad', 15, 3)->default(1);
                $table->decimal('tarifa_unitaria', 15, 2)->default(0);
                $table->decimal('total_linea', 15, 2)->default(0);
                $table->timestamps();

                $table->foreign('liquidacion_distribuidor_id', 'fk_lmd_liq_dist')
                    ->references('id')->on('liq_liquidaciones_distribuidor')->cascadeOnDelete();
                $table->index('liquidacion_distribuidor_id', 'idx_lmd_liq_dist');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_liquidacion_manual_detalle');
        Schema::dropIfExists('liq_mapeos_sucursal_distribuidor');

        if (Schema::hasColumn('liq_liquidaciones_distribuidor', 'cliente_id')) {
            Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
                $table->dropForeign(['cliente_id']);
                $table->dropColumn('cliente_id');
            });
        }

        if (Schema::hasColumn('liq_liquidaciones_distribuidor', 'origen')) {
            Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
                $table->dropColumn(['origen', 'referencia_externa', 'observaciones_manual']);
            });
        }

        if (Schema::hasColumn('liq_operaciones', 'origen')) {
            Schema::table('liq_operaciones', function (Blueprint $table) {
                $table->dropColumn('origen');
            });
        }
    }
};

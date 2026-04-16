<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Campos nuevos en liq_operaciones
        Schema::table('liq_operaciones', function (Blueprint $table) {
            $table->string('id_operacion_cliente', 100)->nullable()->after('campos_originales');
            $table->string('tipo_operacion', 20)->default('normal')->after('estado');
            $table->unsignedBigInteger('operacion_referencia_id')->nullable()->after('tipo_operacion');

            $table->index('id_operacion_cliente', 'idx_op_cliente_id');
        });

        // 2. Expandir ENUM estado (agregar ignorado, anulado)
        DB::statement("ALTER TABLE liq_operaciones MODIFY COLUMN estado ENUM('pendiente','ok','diferencia','sin_tarifa','sin_distribuidor','duplicado','observado','excluida','ignorado','anulado') NOT NULL DEFAULT 'pendiente'");

        // 3. Campo configuracion_duplicados en liq_clientes
        if (!Schema::hasColumn('liq_clientes', 'configuracion_duplicados')) {
            Schema::table('liq_clientes', function (Blueprint $table) {
                $table->json('configuracion_duplicados')->nullable()->after('configuracion_excel');
            });
        }
    }

    public function down(): void
    {
        Schema::table('liq_operaciones', function (Blueprint $table) {
            $table->dropIndex('idx_op_cliente_id');
            $table->dropColumn(['id_operacion_cliente', 'tipo_operacion', 'operacion_referencia_id']);
        });

        DB::statement("ALTER TABLE liq_operaciones MODIFY COLUMN estado ENUM('pendiente','ok','diferencia','sin_tarifa','sin_distribuidor','duplicado','observado','excluida') NOT NULL DEFAULT 'pendiente'");

        if (Schema::hasColumn('liq_clientes', 'configuracion_duplicados')) {
            Schema::table('liq_clientes', function (Blueprint $table) {
                $table->dropColumn('configuracion_duplicados');
            });
        }
    }
};

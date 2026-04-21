<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * BUGFIX 27.1 — Agregar:
 *   - Estado 'preparada' a liq_liquidaciones_distribuidor.estado (ENUM extendido).
 *   - Campos de promoción: preparada_at, preparada_por, factura_cargada_at.
 *   - Soft delete (deleted_at, deleted_by, delete_motivo) en liq_liquidaciones_distribuidor
 *     y liq_liquidaciones_cliente. Permite auditar borrados con motivo.
 */
return new class extends Migration
{
    public function up(): void
    {
        // --- liq_liquidaciones_distribuidor ----------------------------------
        // Extender el ENUM 'estado' para aceptar 'preparada'. Mantenemos los valores existentes.
        // Dialecto MySQL/MariaDB: MODIFY COLUMN con la lista completa de valores.
        DB::statement("
            ALTER TABLE liq_liquidaciones_distribuidor
            MODIFY COLUMN estado ENUM('generada','preparada','aprobada','pagada','anulada')
            NOT NULL DEFAULT 'generada'
        ");

        Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'preparada_at')) {
                $table->timestamp('preparada_at')->nullable()->after('estado');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'preparada_por')) {
                $table->unsignedBigInteger('preparada_por')->nullable()->after('preparada_at');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'factura_cargada_at')) {
                $table->timestamp('factura_cargada_at')->nullable()->after('preparada_por');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'deleted_at')) {
                $table->softDeletes();
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'deleted_by')) {
                $table->unsignedBigInteger('deleted_by')->nullable()->after('deleted_at');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'delete_motivo')) {
                $table->string('delete_motivo', 500)->nullable()->after('deleted_by');
            }
        });

        // --- liq_liquidaciones_cliente ---------------------------------------
        Schema::table('liq_liquidaciones_cliente', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_liquidaciones_cliente', 'deleted_at')) {
                $table->softDeletes();
            }
            if (!Schema::hasColumn('liq_liquidaciones_cliente', 'deleted_by')) {
                $table->unsignedBigInteger('deleted_by')->nullable()->after('deleted_at');
            }
            if (!Schema::hasColumn('liq_liquidaciones_cliente', 'delete_motivo')) {
                $table->string('delete_motivo', 500)->nullable()->after('deleted_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            $table->dropColumn([
                'preparada_at', 'preparada_por', 'factura_cargada_at',
                'deleted_at', 'deleted_by', 'delete_motivo',
            ]);
        });
        DB::statement("
            ALTER TABLE liq_liquidaciones_distribuidor
            MODIFY COLUMN estado ENUM('generada','aprobada','pagada','anulada')
            NOT NULL DEFAULT 'generada'
        ");

        Schema::table('liq_liquidaciones_cliente', function (Blueprint $table) {
            $table->dropColumn(['deleted_at', 'deleted_by', 'delete_motivo']);
        });
    }
};

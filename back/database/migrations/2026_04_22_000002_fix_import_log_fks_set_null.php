<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Corrige los FKs de liq_tarifas_import_log para no bloquear eliminaciones de
 * esquemas/clientes/usuarios. La auditoría de importaciones debe sobrevivir aunque
 * desaparezcan las entidades referenciadas — usamos ON DELETE SET NULL.
 *
 * Contexto: sin esta corrección, intentar borrar un esquema daba:
 *   "Cannot delete or update a parent row: a foreign key constraint fails
 *    (liq_tarifas_import_log_esquema_id_foreign)"
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_tarifas_import_log', function (Blueprint $table) {
            $table->dropForeign('liq_tarifas_import_log_usuario_id_foreign');
            $table->dropForeign('liq_tarifas_import_log_cliente_id_foreign');
            $table->dropForeign('liq_tarifas_import_log_esquema_id_foreign');

            $table->unsignedBigInteger('usuario_id')->nullable()->change();
            $table->unsignedBigInteger('cliente_id')->nullable()->change();
            $table->unsignedBigInteger('esquema_id')->nullable()->change();

            $table->foreign('usuario_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('cliente_id')->references('id')->on('liq_clientes')->nullOnDelete();
            $table->foreign('esquema_id')->references('id')->on('liq_esquemas_tarifarios')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('liq_tarifas_import_log', function (Blueprint $table) {
            $table->dropForeign(['usuario_id']);
            $table->dropForeign(['cliente_id']);
            $table->dropForeign(['esquema_id']);

            $table->foreign('usuario_id')->references('id')->on('users');
            $table->foreign('cliente_id')->references('id')->on('liq_clientes');
            $table->foreign('esquema_id')->references('id')->on('liq_esquemas_tarifarios');
        });
    }
};

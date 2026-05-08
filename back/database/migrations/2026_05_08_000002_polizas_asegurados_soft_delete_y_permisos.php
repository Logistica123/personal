<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM 12 Parte E — soft delete de asegurados + permisos.
 *
 *  - Soft delete con auditoría: quién/cuándo/motivo. Las queries normales
 *    excluyen `eliminado_en IS NOT NULL`; super admin puede restaurar desde
 *    `/polizas/auditoria/asegurados-eliminados`.
 *  - Dos permisos: individual (operativo común) vs masivo (peligroso, super admin).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('polizas_asegurados', function (Blueprint $table) {
            $table->timestamp('eliminado_en')->nullable()->after('updated_at');
            $table->foreignId('eliminado_por_user_id')->nullable()->after('eliminado_en')->constrained('users')->nullOnDelete();
            $table->string('motivo_eliminacion', 255)->nullable()->after('eliminado_por_user_id');
            $table->index('eliminado_en', 'idx_aseg_eliminado');
        });

        Schema::table('polizas_admin_permisos', function (Blueprint $table) {
            $table->boolean('puede_eliminar_asegurados')->default(false)->after('puede_notificar_distribuidores');
            $table->boolean('puede_eliminar_asegurados_masivo')->default(false)->after('puede_eliminar_asegurados');
        });
    }

    public function down(): void
    {
        Schema::table('polizas_admin_permisos', function (Blueprint $table) {
            $table->dropColumn(['puede_eliminar_asegurados', 'puede_eliminar_asegurados_masivo']);
        });
        Schema::table('polizas_asegurados', function (Blueprint $table) {
            $table->dropForeign(['eliminado_por_user_id']);
            $table->dropIndex('idx_aseg_eliminado');
            $table->dropColumn(['eliminado_en', 'eliminado_por_user_id', 'motivo_eliminacion']);
        });
    }
};

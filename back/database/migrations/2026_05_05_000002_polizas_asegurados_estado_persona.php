<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM 14 — guardar estado de la persona al momento del match.
 *
 *  - `persona_estado_al_matchear` snapshot del estado de la persona ('activo',
 *    'baja', 'suspendido', 'solicitud_pendiente', 'sin_aprobar').
 *  - `persona_alerta_estado` el flag de inconsistencia (NULL si todo OK).
 *
 * También extiende `polizas_endosos.tipo` con `'asegurados_adherentes'`
 * (addendum 13).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('polizas_asegurados', function (Blueprint $table) {
            $table->string('persona_estado_al_matchear', 50)->nullable()->after('match_metodo');
            $table->string('persona_alerta_estado', 80)->nullable()->after('persona_estado_al_matchear');
            $table->index('persona_alerta_estado', 'idx_aseg_alerta');
        });

        // ENUM extendido para soportar 'asegurados_adherentes' (addendum 13).
        DB::statement("ALTER TABLE polizas_endosos
            MODIFY COLUMN tipo ENUM('constancia','incorporacion','baja','modificacion','asegurados_adherentes') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE polizas_endosos
            MODIFY COLUMN tipo ENUM('constancia','incorporacion','baja','modificacion') NOT NULL");

        Schema::table('polizas_asegurados', function (Blueprint $table) {
            $table->dropIndex('idx_aseg_alerta');
            $table->dropColumn(['persona_estado_al_matchear', 'persona_alerta_estado']);
        });
    }
};

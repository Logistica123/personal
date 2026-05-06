<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * BUGFIX 02 Issue 1 — Match estricto.
 *
 * El matching solo debe vincular por `cuil_exacto`, `dni_exacto` o `patente_exacto`.
 * Hasta acá `MatchingService` también vinculaba por `fuzzy_nombre` con score >= 0.95
 * (ej. caso BENITEZ JUAN RAMON, persona #511 sin CUIL → match incorrecto).
 *
 * Esta migración:
 *  1) Agrega `sugerencia_fuzzy_persona_id` y `sugerencia_fuzzy_score` para que la UI
 *     pueda mostrar al admin un "candidato por nombre" sin que el sistema vincule
 *     automáticamente.
 *  2) Migra los matches `fuzzy_nombre` históricos: la persona vinculada se mueve a
 *     `sugerencia_fuzzy_persona_id`, `persona_id` queda NULL, el asegurado pasa a
 *     `estado='no_matcheado'` y se marca `revision_manual_pendiente=true` para que
 *     aparezca en el reporte de auditoría (`/polizas/auditoria/matches-fuzzy`).
 *  3) Elimina `fuzzy_nombre` del ENUM `match_metodo` para que ningún registro nuevo
 *     pueda usarlo (los históricos ya están limpios).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('polizas_asegurados', function (Blueprint $table) {
            $table->foreignId('sugerencia_fuzzy_persona_id')
                  ->nullable()
                  ->after('persona_alerta_estado')
                  ->constrained('personas')
                  ->nullOnDelete();
            $table->decimal('sugerencia_fuzzy_score', 4, 3)
                  ->nullable()
                  ->after('sugerencia_fuzzy_persona_id');
        });

        // 2) Cleanup de matches `fuzzy_nombre` históricos.
        DB::table('polizas_asegurados')
            ->where('match_metodo', 'fuzzy_nombre')
            ->whereNotNull('persona_id')
            ->update([
                'sugerencia_fuzzy_persona_id' => DB::raw('persona_id'),
                'sugerencia_fuzzy_score'      => DB::raw('match_score'),
                'persona_id'                  => null,
                'estado'                      => DB::raw("CASE WHEN estado = 'activo' THEN 'no_matcheado' ELSE estado END"),
                'match_metodo'                => null,
                'match_score'                 => null,
                'persona_estado_al_matchear'  => null,
                'persona_alerta_estado'       => null,
                'revision_manual_pendiente'   => true,
                'updated_at'                  => now(),
            ]);

        // 3) Eliminar `fuzzy_nombre` del ENUM. El cleanup anterior garantiza que
        //    no queden filas con ese valor.
        DB::statement("ALTER TABLE polizas_asegurados
            MODIFY COLUMN match_metodo ENUM('cuil_exacto','dni_exacto','patente_exacto','manual') NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE polizas_asegurados
            MODIFY COLUMN match_metodo ENUM('cuil_exacto','dni_exacto','patente_exacto','fuzzy_nombre','manual') NULL");

        Schema::table('polizas_asegurados', function (Blueprint $table) {
            $table->dropForeign(['sugerencia_fuzzy_persona_id']);
            $table->dropColumn(['sugerencia_fuzzy_persona_id', 'sugerencia_fuzzy_score']);
        });
    }
};

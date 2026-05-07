<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM 9 Parte C — índice complementario para filtrar pólizas vigentes por
 * persona. La tabla ya tiene `idx_aseg_poliza_estado (poliza_id, estado)` para
 * la query "asegurados de esta póliza", y `idx_persona` (persona_id) que viene
 * de la FK. Sumamos uno compuesto (persona_id, estado) para que el listado de
 * `/api/personal` con filtros tipo `?con_cobertura_ap=true` o
 * `?poliza_id=X` no haga seq scan al armar `polizasVigentes` por cada fila.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('polizas_asegurados', function (Blueprint $table) {
            $table->index(['persona_id', 'estado'], 'idx_aseg_persona_estado');
        });
    }

    public function down(): void
    {
        Schema::table('polizas_asegurados', function (Blueprint $table) {
            $table->dropIndex('idx_aseg_persona_estado');
        });
    }
};

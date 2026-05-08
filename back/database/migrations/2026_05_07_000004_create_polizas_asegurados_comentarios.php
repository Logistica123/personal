<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM 10 Parte B — comentarios histórico por asegurado.
 *
 * `polizas_asegurados.notas` (TEXT, ya existente) NO se elimina; queda como
 * último comentario / nota libre. Esta tabla histórica suma cada intervención
 * con autor + timestamp para auditoría.
 *
 * El frontend muestra:
 *  - Badge `[💬 N]` con la cantidad por fila.
 *  - Modal con histórico cronológico (más reciente arriba).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('polizas_asegurados_comentarios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asegurado_id')->constrained('polizas_asegurados')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users');
            $table->text('comentario');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['asegurado_id', 'created_at'], 'idx_comentarios_asegurado_created');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('polizas_asegurados_comentarios');
    }
};

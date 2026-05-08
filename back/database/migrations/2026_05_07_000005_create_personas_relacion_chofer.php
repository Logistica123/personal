<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM 10 Parte C — vínculo titular ↔ chofer.
 *
 * Cada relación une dos `personas`: un titular (dueño del vehículo / proveedor
 * principal) con un chofer (también persona) que maneja para él. Modelo N:N:
 *  - Un titular puede tener N choferes.
 *  - Un chofer puede manejar para N titulares.
 *  - Una persona puede ser titular en una relación y chofer en otra (caso
 *    edge: Carlos titular de su Ford Fiesta + chofer del Mercedes de Pedro).
 *
 * `activo=false` se usa para soft-disable (preserva histórico). Para borrar
 * realmente, hard delete del registro.
 *
 * Constraints:
 *  - UNIQUE (titular, chofer) — no se duplican vínculos.
 *  - El chequeo "no vincular consigo mismo" lo hace la app (CHECK
 *    constraint a nivel SQL no es portable cross-engine).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('personas_relacion_chofer', function (Blueprint $table) {
            $table->id();
            $table->foreignId('titular_persona_id')->constrained('personas')->cascadeOnDelete();
            $table->foreignId('chofer_persona_id')->constrained('personas')->cascadeOnDelete();
            $table->date('fecha_vinculacion');
            $table->date('fecha_desvinculacion')->nullable();
            $table->string('rol', 50)->default('chofer');  // 'chofer' | 'reemplazo' | 'familiar'
            $table->text('notas')->nullable();
            $table->boolean('activo')->default(true);
            $table->foreignId('creado_por_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['titular_persona_id', 'chofer_persona_id'], 'uniq_titular_chofer');
            $table->index(['titular_persona_id', 'activo'], 'idx_rel_titular');
            $table->index(['chofer_persona_id', 'activo'], 'idx_rel_chofer');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('personas_relacion_chofer');
    }
};

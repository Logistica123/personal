<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM 14 — 3 features adicionales.
 *
 *  A) Test de correos: tabla de auditoría con cada test E2E (envío básico,
 *     loop completo, con adjunto) — guarda el resultado para diagnóstico.
 *
 *  C) Bulk bajas global: tabla maestra que agrupa las N solicitudes generadas
 *     en una sola ejecución + FK reverse desde `polizas_solicitudes` +
 *     permiso `puede_bulk_bajas_global`.
 */
return new class extends Migration {
    public function up(): void
    {
        // ─── A) Tests de correos ────────────────────────────────────────────
        Schema::create('polizas_tests_correos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('tipo_test', ['envio_basico', 'loop_completo', 'con_adjunto']);
            $table->timestamp('fecha_inicio')->useCurrent();
            $table->timestamp('fecha_fin')->nullable();
            $table->enum('estado', ['en_progreso', 'ok', 'error'])->default('en_progreso');
            $table->string('paso_fallo', 50)->nullable();
            $table->text('detalle_error')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'fecha_inicio'], 'idx_test_user_fecha');
        });

        // ─── C) Bulk bajas global ───────────────────────────────────────────
        Schema::create('polizas_bulk_bajas_global', function (Blueprint $table) {
            $table->id();
            $table->foreignId('administrativo_user_id')->constrained('users');
            $table->timestamp('fecha_ejecucion')->useCurrent();
            $table->longText('input_raw');           // lo que pegó el admin
            $table->integer('cantidad_identificadores')->default(0);
            $table->integer('cantidad_encontrados')->default(0);
            $table->integer('cantidad_no_encontrados')->default(0);
            $table->integer('cantidad_solicitudes_creadas')->default(0);
            $table->integer('cantidad_correos_enviados')->default(0);
            $table->integer('cantidad_correos_fallidos')->default(0);
            $table->enum('estado', ['en_progreso', 'completado', 'con_errores'])
                  ->default('en_progreso');
            $table->timestamp('completado_en')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['administrativo_user_id', 'fecha_ejecucion'], 'idx_bulk_admin_fecha');
        });

        Schema::table('polizas_solicitudes', function (Blueprint $table) {
            $table->foreignId('bulk_baja_global_id')->nullable()->after('email_message_id')
                  ->constrained('polizas_bulk_bajas_global')->nullOnDelete();
        });

        Schema::table('polizas_admin_permisos', function (Blueprint $table) {
            $table->boolean('puede_bulk_bajas_global')->default(false)
                  ->after('puede_eliminar_asegurados_masivo');
        });
    }

    public function down(): void
    {
        Schema::table('polizas_admin_permisos', function (Blueprint $table) {
            $table->dropColumn('puede_bulk_bajas_global');
        });

        Schema::table('polizas_solicitudes', function (Blueprint $table) {
            $table->dropForeign(['bulk_baja_global_id']);
            $table->dropColumn('bulk_baja_global_id');
        });

        Schema::dropIfExists('polizas_bulk_bajas_global');
        Schema::dropIfExists('polizas_tests_correos');
    }
};

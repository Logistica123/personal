<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM 15 — 3 bloques de features.
 *
 *  Bloque 1: bandeja de bajas pendientes (decisión humana caso a caso, distinto
 *            del bulk masivo de ADD 14 Parte C).
 *  Bloque 2: importes mensuales del endoso (premio LA vs. precio a descontar
 *            al distribuidor, con descuento default 20%).
 *  Bloque 3: aprobaciones del CRM con choferes adicionales + datos de pólizas
 *            a solicitar (precarga al disparar el wizard de alta múltiple).
 */
return new class extends Migration {
    public function up(): void
    {
        // ── Bloque 1.A ── Bandeja de bajas pendientes ────────────────────────
        // Idempotente: si quedó a medias por una corrida previa, dropea antes.
        Schema::dropIfExists('polizas_solicitudes_baja_pendientes');
        Schema::create('polizas_solicitudes_baja_pendientes', function (Blueprint $table) {
            // MySQL tiene límite de 64 chars en nombres de índices/constraints.
            // El nombre de la tabla ya es largo (38 chars), por eso forzamos
            // nombres custom cortos en cada FK/index.
            $table->id();
            $table->unsignedBigInteger('persona_id');
            $table->unsignedBigInteger('solicitada_por_user_id');
            $table->timestamp('fecha_solicitud')->useCurrent();
            $table->text('motivo_baja');
            $table->text('comentarios_adicionales')->nullable();
            $table->json('polizas_sugeridas')->nullable();   // poliza_ids sugeridos por el solicitante
            $table->enum('estado', ['pendiente', 'procesada', 'rechazada', 'cancelada'])
                  ->default('pendiente');
            $table->unsignedBigInteger('procesada_por_user_id')->nullable();
            $table->timestamp('procesada_en')->nullable();
            $table->json('polizas_dadas_de_baja')->nullable();   // poliza_ids efectivamente procesados
            $table->text('motivo_rechazo')->nullable();
            $table->unsignedBigInteger('bulk_baja_global_id')->nullable();
            $table->timestamps();

            $table->foreign('persona_id', 'fk_bajapend_persona')
                  ->references('id')->on('personas');
            $table->foreign('solicitada_por_user_id', 'fk_bajapend_solicita')
                  ->references('id')->on('users');
            $table->foreign('procesada_por_user_id', 'fk_bajapend_procesa')
                  ->references('id')->on('users');
            $table->foreign('bulk_baja_global_id', 'fk_bajapend_bulk')
                  ->references('id')->on('polizas_bulk_bajas_global')->nullOnDelete();

            $table->index('estado', 'idx_baja_pend_estado');
            $table->index(['persona_id', 'estado'], 'idx_baja_pend_persona');
        });

        // ── Bloque 2.D ── Importes mensuales en asegurados ───────────────────
        Schema::table('polizas_asegurados', function (Blueprint $table) {
            $table->decimal('importe_mensual_la', 14, 2)->nullable()->after('premio_individual');
            $table->decimal('importe_mensual_distribuidor', 14, 2)->nullable()->after('importe_mensual_la');
            $table->decimal('porcentaje_descuento_distribuidor', 5, 2)->default(20.00)
                  ->after('importe_mensual_distribuidor');
            $table->enum('importe_mensual_origen', ['endoso', 'manual', 'editado'])->nullable()
                  ->after('porcentaje_descuento_distribuidor');
        });

        Schema::table('polizas_endosos', function (Blueprint $table) {
            $table->integer('cantidad_asegurados_incorporados')->nullable()->after('premio_endoso');
        });

        // ── Bloque 1.B + 2.D ── Permisos nuevos ──────────────────────────────
        Schema::table('polizas_admin_permisos', function (Blueprint $table) {
            $table->boolean('puede_procesar_bajas')->default(false)->after('puede_bulk_bajas_global');
            $table->boolean('puede_editar_importes')->default(false)->after('puede_procesar_bajas');
        });

        // ── Bloque 3.E + 3.F ── Datos extendidos de la solicitud de alta ─────
        Schema::table('personas', function (Blueprint $table) {
            $table->json('solicitud_choferes_json')->nullable()->after('es_solicitud');
            $table->json('solicitud_polizas_json')->nullable()->after('solicitud_choferes_json');
        });
    }

    public function down(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            $table->dropColumn(['solicitud_choferes_json', 'solicitud_polizas_json']);
        });
        Schema::table('polizas_admin_permisos', function (Blueprint $table) {
            $table->dropColumn(['puede_procesar_bajas', 'puede_editar_importes']);
        });
        Schema::table('polizas_endosos', function (Blueprint $table) {
            $table->dropColumn('cantidad_asegurados_incorporados');
        });
        Schema::table('polizas_asegurados', function (Blueprint $table) {
            $table->dropColumn([
                'importe_mensual_la', 'importe_mensual_distribuidor',
                'porcentaje_descuento_distribuidor', 'importe_mensual_origen',
            ]);
        });
        Schema::dropIfExists('polizas_solicitudes_baja_pendientes');
    }
};

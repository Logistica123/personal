<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo Pólizas — schema base (Fase 1).
 *
 * Crea las 8 tablas que soportan: catálogo de aseguradoras, pólizas, configuración
 * de email por póliza × tipo (alta/baja), endosos (PDFs cargados), asegurados con
 * matching contra `personas`, solicitudes de alta/baja y permisos administrativos.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('polizas_aseguradoras', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 100);
            $table->string('parser_perfil', 50)->unique();
            $table->string('cuit', 15)->nullable();
            $table->string('domicilio')->nullable();
            $table->string('web')->nullable();
            $table->string('email_general', 150)->nullable();
            $table->text('notas')->nullable();
            $table->boolean('activa')->default(true);
            $table->timestamps();

            $table->index('activa', 'idx_aseg_activa');
        });

        Schema::create('polizas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('aseguradora_id')->constrained('polizas_aseguradoras');
            $table->string('nombre_descriptivo', 150);
            $table->enum('ramo', ['accidentes_personales', 'vehiculos']);
            $table->string('subramo', 100)->nullable();
            $table->enum('tipo_asegurado', ['persona', 'vehiculo']);
            $table->string('numero_poliza', 50);
            $table->string('numero_cuenta_cliente', 50)->nullable();
            $table->date('vigencia_desde');
            $table->date('vigencia_hasta');
            $table->string('tomador_cuit', 15)->nullable();
            $table->string('tomador_razon_social', 150)->nullable();
            $table->string('tomador_domicilio')->nullable();
            $table->decimal('suma_asegurada_total', 18, 2)->nullable();
            $table->decimal('premio_anual', 14, 2)->nullable();
            $table->unsignedInteger('cantidad_vidas_unidades')->default(0);
            $table->text('clausulas_especiales')->nullable();
            $table->unsignedInteger('alerta_dias_antes_vencimiento')->default(15);
            $table->boolean('activa')->default(true);
            $table->text('notas')->nullable();
            $table->timestamps();

            $table->unique(['aseguradora_id', 'numero_poliza'], 'uniq_poliza_numero');
            $table->index(['vigencia_desde', 'vigencia_hasta'], 'idx_pol_vigencia');
            $table->index('activa', 'idx_pol_activa');
        });

        Schema::create('polizas_email_config', function (Blueprint $table) {
            $table->id();
            $table->foreignId('poliza_id')->constrained('polizas')->cascadeOnDelete();
            $table->enum('tipo', ['alta', 'baja']);
            $table->json('destinatarios_to');
            $table->json('destinatarios_cc')->nullable();
            $table->json('destinatarios_bcc')->nullable();
            $table->string('contacto_nombre', 100)->nullable();
            $table->string('asunto_template');
            $table->text('body_template');
            $table->text('asegurado_template');
            $table->json('adjuntos_requeridos')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->unique(['poliza_id', 'tipo'], 'uniq_poliza_tipo');
        });

        Schema::create('polizas_endosos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('poliza_id')->constrained('polizas')->cascadeOnDelete();
            $table->string('numero_endoso', 50);
            $table->enum('tipo', ['constancia', 'incorporacion', 'baja', 'modificacion']);
            $table->date('fecha_emision');
            $table->foreignId('archivo_id')->nullable()->constrained('archivos')->nullOnDelete();
            $table->text('descripcion')->nullable();
            $table->decimal('premio_endoso', 14, 2)->nullable();
            $table->timestamps();

            $table->index('fecha_emision', 'idx_end_fecha');
        });

        Schema::create('polizas_asegurados', function (Blueprint $table) {
            $table->id();
            $table->foreignId('poliza_id')->constrained('polizas')->cascadeOnDelete();
            $table->foreignId('persona_id')->nullable()->constrained('personas')->nullOnDelete();
            $table->enum('tipo_asegurado', ['persona', 'vehiculo']);
            $table->string('identificador', 50);
            $table->enum('identificador_tipo', ['dni', 'cuil', 'patente']);
            $table->string('numero_orden_aseguradora', 20)->nullable();
            $table->string('nombre_apellido_pdf', 200)->nullable();
            $table->string('marca_modelo_pdf', 150)->nullable();
            $table->string('tipo_vehiculo_pdf', 50)->nullable();
            $table->string('localidad_pdf', 100)->nullable();
            $table->decimal('suma_asegurada', 14, 2)->nullable();
            $table->decimal('premio_individual', 14, 2)->nullable();
            $table->foreignId('alta_endoso_id')->nullable()->constrained('polizas_endosos')->nullOnDelete();
            $table->foreignId('baja_endoso_id')->nullable()->constrained('polizas_endosos')->nullOnDelete();
            $table->date('fecha_alta_efectiva')->nullable();
            $table->date('fecha_baja_efectiva')->nullable();
            $table->enum('estado', [
                'activo',
                'alta_solicitada',
                'baja_solicitada',
                'dado_de_baja',
                'no_matcheado',
            ])->default('activo');
            $table->decimal('match_score', 4, 3)->nullable();
            $table->enum('match_metodo', [
                'cuil_exacto',
                'dni_exacto',
                'patente_exacto',
                'fuzzy_nombre',
                'manual',
            ])->nullable();
            $table->boolean('revision_manual_pendiente')->default(false);
            $table->text('notas')->nullable();
            $table->timestamps();

            $table->unique(['poliza_id', 'identificador'], 'uniq_poliza_identificador');
            $table->index(['poliza_id', 'estado'], 'idx_aseg_poliza_estado');
            $table->index('identificador', 'idx_aseg_identificador');
        });

        Schema::create('polizas_solicitudes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('poliza_id')->constrained('polizas');
            $table->enum('tipo', ['alta', 'baja']);
            $table->foreignId('administrativo_user_id')->constrained('users');
            $table->timestamp('fecha_solicitud')->useCurrent();
            $table->json('destinatarios_to_resueltos');
            $table->json('destinatarios_cc_resueltos')->nullable();
            $table->string('asunto');
            $table->longText('body');
            $table->json('adjuntos')->nullable();
            $table->enum('estado', [
                'borrador',
                'enviado',
                'respondida_ok',
                'respondida_rechazada',
                'cancelada',
            ])->default('borrador');
            $table->timestamp('enviado_en')->nullable();
            $table->timestamp('respuesta_recibida_en')->nullable();
            $table->text('respuesta_resumen')->nullable();
            $table->string('email_message_id')->nullable();
            $table->timestamps();

            $table->index('estado', 'idx_sol_estado');
        });

        Schema::create('polizas_solicitud_asegurados', function (Blueprint $table) {
            $table->id();
            $table->foreignId('solicitud_id')->constrained('polizas_solicitudes')->cascadeOnDelete();
            $table->foreignId('asegurado_id')->constrained('polizas_asegurados');
            $table->text('observaciones')->nullable();

            $table->unique(['solicitud_id', 'asegurado_id'], 'uniq_solicitud_asegurado');
        });

        Schema::create('polizas_admin_permisos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->boolean('puede_cargar_pdf')->default(false);
            $table->boolean('puede_solicitar_alta')->default(false);
            $table->boolean('puede_solicitar_baja')->default(false);
            $table->boolean('puede_confirmar_respuesta')->default(false);
            $table->boolean('puede_editar_email_config')->default(false);
            $table->boolean('recibe_alertas_vencimiento')->default(false);
            $table->text('notas')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('polizas_admin_permisos');
        Schema::dropIfExists('polizas_solicitud_asegurados');
        Schema::dropIfExists('polizas_solicitudes');
        Schema::dropIfExists('polizas_asegurados');
        Schema::dropIfExists('polizas_endosos');
        Schema::dropIfExists('polizas_email_config');
        Schema::dropIfExists('polizas');
        Schema::dropIfExists('polizas_aseguradoras');
    }
};

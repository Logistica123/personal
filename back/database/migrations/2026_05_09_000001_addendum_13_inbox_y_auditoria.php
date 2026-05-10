<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM 13 — schema consolidado.
 *
 *  - Parte D: tablas `polizas_solicitud_emails` (cache de emails enviados/
 *    recibidos por solicitud) y `polizas_solicitud_email_adjuntos` (adjuntos
 *    PDF detectables como endosos). `polizas_solicitudes.microsoft_conversation_id`
 *    para correlacionar via Graph.
 *  - Parte B: `polizas_admin_permisos.puede_ver_auditoria` (default true) y
 *    `puede_ver_inbox_otros_admins` (default false; super-admin ve a todos).
 *  - Parte D config: `polizas.auto_guardar_endosos_recibidos` (default true).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            $table->boolean('auto_guardar_endosos_recibidos')
                  ->default(true)
                  ->after('dias_alerta_sin_respuesta');
        });

        Schema::table('polizas_admin_permisos', function (Blueprint $table) {
            $table->boolean('puede_ver_auditoria')->default(true)->after('puede_eliminar_asegurados_masivo');
            $table->boolean('puede_ver_inbox_otros_admins')->default(false)->after('puede_ver_auditoria');
        });

        Schema::table('polizas_solicitudes', function (Blueprint $table) {
            // ID de conversación de Microsoft Graph: agrupa el email enviado +
            // todas las respuestas en una misma cadena. Capturado al hacer
            // sendMail; usado para sincronizar Inbox por solicitud.
            $table->string('microsoft_conversation_id', 255)->nullable()->after('email_message_id');
            $table->index('microsoft_conversation_id', 'idx_sol_conversation');
        });

        Schema::create('polizas_solicitud_emails', function (Blueprint $table) {
            $table->id();
            $table->foreignId('solicitud_id')->constrained('polizas_solicitudes')->cascadeOnDelete();
            $table->enum('direccion', ['enviado', 'recibido']);
            $table->string('microsoft_message_id', 255)->nullable();
            $table->string('conversation_id', 255)->nullable();
            $table->timestamp('fecha_email');
            $table->string('de_email', 150);
            $table->string('de_nombre', 150)->nullable();
            $table->json('para_emails')->nullable();
            $table->json('cc_emails')->nullable();
            $table->string('asunto', 500);
            $table->text('body_preview')->nullable();
            $table->longText('body_completo')->nullable();
            $table->boolean('tiene_adjuntos')->default(false);
            $table->boolean('procesado')->default(false);  // si auto-confirm ya lo procesó
            $table->timestamps();

            $table->index(['solicitud_id', 'fecha_email'], 'idx_email_solicitud');
            $table->unique('microsoft_message_id', 'uniq_email_msg_id');
        });

        Schema::create('polizas_solicitud_email_adjuntos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('email_id')->constrained('polizas_solicitud_emails')->cascadeOnDelete();
            $table->string('nombre_archivo', 255);
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('tamano_bytes')->default(0);
            $table->longText('contenido_base64')->nullable();   // solo si tamaño <1MB; si no, descarga on-demand
            $table->string('microsoft_attachment_id', 255)->nullable();
            $table->string('storage_path', 500)->nullable();    // si se guardó en disco al "vincular a endoso"
            $table->boolean('es_endoso')->default(false);       // detectado por nombre/regex
            $table->foreignId('endoso_id')->nullable()->constrained('polizas_endosos')->nullOnDelete();
            $table->timestamp('descargado_en')->nullable();
            $table->timestamps();

            $table->index('email_id', 'idx_adj_email');
            $table->index('es_endoso', 'idx_adj_endoso');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('polizas_solicitud_email_adjuntos');
        Schema::dropIfExists('polizas_solicitud_emails');

        Schema::table('polizas_solicitudes', function (Blueprint $table) {
            $table->dropIndex('idx_sol_conversation');
            $table->dropColumn('microsoft_conversation_id');
        });

        Schema::table('polizas_admin_permisos', function (Blueprint $table) {
            $table->dropColumn(['puede_ver_auditoria', 'puede_ver_inbox_otros_admins']);
        });

        Schema::table('polizas', function (Blueprint $table) {
            $table->dropColumn('auto_guardar_endosos_recibidos');
        });
    }
};

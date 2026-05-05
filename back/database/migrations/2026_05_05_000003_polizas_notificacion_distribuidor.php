<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM 13B — Notificación al distribuidor.
 *
 *  - `polizas_notificaciones_distribuidor`     1 fila por (asegurado × póliza × tipo)
 *  - `polizas_notif_distribuidor_config`       template por póliza (asunto + body)
 *  - `polizas_admin_permisos.puede_notificar_distribuidores`   nuevo permiso
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('polizas_notificaciones_distribuidor', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asegurado_id')->constrained('polizas_asegurados')->cascadeOnDelete();
            $table->foreignId('poliza_id')->constrained('polizas');
            $table->foreignId('persona_id')->constrained('personas');
            $table->enum('tipo', ['alta', 'baja'])->default('alta');
            $table->string('email_destinatario', 150);
            $table->string('asunto');
            $table->text('body');
            $table->enum('estado', ['pendiente', 'enviado', 'rebotado', 'sin_email'])->default('pendiente');
            $table->timestamp('enviado_en')->nullable();
            $table->text('error_envio')->nullable();
            $table->foreignId('enviado_por_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('persona_id', 'idx_notif_persona');
            $table->index('estado', 'idx_notif_estado');
            $table->index('poliza_id', 'idx_notif_poliza');
        });

        Schema::create('polizas_notif_distribuidor_config', function (Blueprint $table) {
            $table->id();
            $table->foreignId('poliza_id')->unique()->constrained('polizas')->cascadeOnDelete();
            $table->boolean('activo')->default(true);
            $table->string('asunto_template');
            $table->text('body_template');
            $table->string('cc_admin_email', 150)->nullable();
            $table->timestamps();
        });

        Schema::table('polizas_admin_permisos', function (Blueprint $table) {
            $table->boolean('puede_notificar_distribuidores')->default(false)->after('puede_gestionar_clausulas');
        });
    }

    public function down(): void
    {
        Schema::table('polizas_admin_permisos', function (Blueprint $table) {
            $table->dropColumn('puede_notificar_distribuidores');
        });
        Schema::dropIfExists('polizas_notif_distribuidor_config');
        Schema::dropIfExists('polizas_notificaciones_distribuidor');
    }
};

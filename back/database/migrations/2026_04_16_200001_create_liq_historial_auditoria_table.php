<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_historial_auditoria')) {
            return;
        }

        Schema::create('liq_historial_auditoria', function (Blueprint $table) {
            $table->id();
            $table->string('entidad_tipo', 40);
            $table->unsignedBigInteger('entidad_id');
            $table->string('accion', 40);
            $table->json('valores_anteriores')->nullable();
            $table->json('valores_nuevos')->nullable();
            $table->text('motivo')->nullable();
            $table->unsignedBigInteger('usuario_id')->nullable();
            $table->string('usuario_nombre', 100)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['entidad_tipo', 'entidad_id'], 'idx_audit_entidad');
            $table->index('accion', 'idx_audit_accion');
            $table->index('usuario_id', 'idx_audit_usuario');
            $table->index('created_at', 'idx_audit_fecha');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_historial_auditoria');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_auditoria_tarifa')) {
            return;
        }

        Schema::create('liq_auditoria_tarifa', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('linea_tarifa_id');
            $table->enum('accion', ['creacion', 'modificacion', 'desactivacion', 'aprobacion']);
            $table->json('valores_anteriores')->nullable();
            $table->json('valores_nuevos')->nullable();
            $table->unsignedBigInteger('usuario_id')->nullable();
            $table->text('motivo')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->foreign('linea_tarifa_id')->references('id')->on('liq_lineas_tarifa')->cascadeOnDelete();
            $table->foreign('usuario_id')->references('id')->on('users')->nullOnDelete();
            $table->index(['linea_tarifa_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_auditoria_tarifa');
    }
};

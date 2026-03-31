<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_operacion_auditorias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('operacion_id')->constrained('liq_operaciones')->cascadeOnDelete();
            $table->string('accion', 40); // exclusion, inclusion, asignar_tarifa, limpiar_tarifa, etc.
            $table->foreignId('usuario_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('valores_anteriores')->nullable();
            $table->json('valores_nuevos')->nullable();
            $table->text('motivo')->nullable();
            $table->timestamps();

            $table->index(['operacion_id', 'accion'], 'liq_op_aud_op_acc_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_operacion_auditorias');
    }
};


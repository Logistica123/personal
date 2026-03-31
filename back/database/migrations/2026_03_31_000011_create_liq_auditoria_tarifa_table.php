<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_auditoria_tarifa', function (Blueprint $table) {
            $table->id();
            $table->foreignId('linea_tarifa_id')
                ->constrained('liq_lineas_tarifa')
                ->cascadeOnDelete();
            $table->enum('accion', ['creacion', 'modificacion', 'desactivacion', 'aprobacion']);
            $table->json('valores_anteriores')->nullable();
            $table->json('valores_nuevos')->nullable();
            $table->foreignId('usuario_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('motivo')->nullable();
            $table->timestamps();

            $table->index(['linea_tarifa_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_auditoria_tarifa');
    }
};

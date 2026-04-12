<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_transferencias_banco')) {
            return;
        }

        Schema::create('liq_transferencias_banco', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('orden_pago_id');

            // --- Datos de la transferencia ---
            $table->string('banco_referencia', 100)->nullable();
            $table->string('cbu_origen', 22);
            $table->string('cbu_destino', 22);
            $table->string('cuil_destino', 13);
            $table->decimal('importe', 15, 2);
            $table->string('concepto_bancario', 200);

            // --- Estado y respuesta del WS ---
            $table->enum('estado_ws', ['PENDIENTE', 'ENVIADA', 'CONFIRMADA', 'RECHAZADA', 'ERROR'])->default('PENDIENTE');
            $table->string('codigo_respuesta', 50)->nullable();
            $table->text('mensaje_respuesta')->nullable();
            $table->json('request_payload')->nullable();
            $table->json('response_payload')->nullable();

            // --- Control ---
            $table->unsignedSmallInteger('intentos')->default(1);
            $table->timestamp('fecha_envio')->nullable();
            $table->timestamp('fecha_confirmacion')->nullable();
            $table->unsignedBigInteger('usuario_id')->nullable();
            $table->timestamps();

            // --- Constraints ---
            $table->foreign('orden_pago_id')->references('id')->on('liq_ordenes_pago')->cascadeOnDelete();
            $table->foreign('usuario_id')->references('id')->on('users')->nullOnDelete();

            // --- Indexes ---
            $table->index(['orden_pago_id']);
            $table->index(['estado_ws']);
            $table->index(['banco_referencia']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_transferencias_banco');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_pagos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('liq_clientes')->cascadeOnDelete();
            $table->date('periodo_desde');
            $table->date('periodo_hasta');
            $table->timestamp('fecha_generacion')->useCurrent();
            $table->foreignId('usuario_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('estado', ['generado', 'pagado', 'anulado'])->default('generado');
            $table->unsignedInteger('cantidad_items')->default(0);
            $table->decimal('total_monto', 14, 2)->default(0);
            $table->timestamp('fecha_pago')->nullable();
            $table->string('referencia')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['cliente_id', 'estado'], 'liq_pagos_cliente_estado_idx');
            $table->index(['cliente_id', 'periodo_desde', 'periodo_hasta'], 'liq_pagos_cliente_periodo_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_pagos');
    }
};


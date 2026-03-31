<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_configuracion_gastos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('liq_clientes')->cascadeOnDelete();
            $table->string('concepto_gasto');
            $table->decimal('monto', 12, 2);
            // 'fijo' = monto fijo por período | 'porcentual' = % sobre subtotal
            $table->enum('tipo', ['fijo', 'porcentual'])->default('fijo');
            $table->date('vigencia_desde');
            $table->date('vigencia_hasta')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->index(['cliente_id', 'activo', 'vigencia_desde']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_configuracion_gastos');
    }
};

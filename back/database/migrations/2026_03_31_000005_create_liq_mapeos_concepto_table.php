<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_mapeos_concepto', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('liq_clientes')->cascadeOnDelete();
            // Valor tal cual aparece en el Excel del cliente
            $table->string('valor_excel');
            // Dimensión de la tarifa a la que mapea (ej: 'concepto')
            $table->string('dimension_destino', 80);
            // Valor de esa dimensión en la tarifa (ej: 'Ut. Corto AM')
            $table->string('valor_tarifa');
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->index(['cliente_id', 'activo']);
            $table->unique(['cliente_id', 'valor_excel', 'dimension_destino'], 'liq_mapeo_concepto_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_mapeos_concepto');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_configuracion_gastos')) {
            return;
        }

        Schema::create('liq_configuracion_gastos', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cliente_id');
            $table->string('concepto_gasto', 150);
            $table->decimal('monto', 15, 2);
            $table->enum('tipo', ['fijo', 'porcentual'])->default('fijo');
            $table->date('vigencia_desde');
            $table->date('vigencia_hasta')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->foreign('cliente_id')->references('id')->on('liq_clientes')->cascadeOnDelete();
            $table->index(['cliente_id', 'activo', 'vigencia_desde']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_configuracion_gastos');
    }
};

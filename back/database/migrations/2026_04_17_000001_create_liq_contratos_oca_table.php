<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_contratos_oca', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cliente_id');
            $table->string('codigo', 10);
            $table->string('descripcion_cruda', 255);
            $table->string('descripcion_amigable', 100);
            $table->enum('unidad_recorrido', ['paquete', 'kilometros', 'horas', 'pickup', 'clearing', 'otro'])->default('paquete');
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->unique(['cliente_id', 'codigo'], 'uk_cliente_codigo');
            $table->foreign('cliente_id')->references('id')->on('liq_clientes')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_contratos_oca');
    }
};

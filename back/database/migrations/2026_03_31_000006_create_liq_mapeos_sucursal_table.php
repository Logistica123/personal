<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_mapeos_sucursal', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('liq_clientes')->cascadeOnDelete();
            // Patrón: parte del nombre del archivo (case-insensitive match)
            $table->string('patron_archivo');
            // Sucursal de la tarifa a la que corresponde este archivo
            $table->string('sucursal_tarifa');
            // Tipo de operación: 'Colecta', 'Ultima Milla', etc.
            $table->string('tipo_operacion')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->index(['cliente_id', 'activo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_mapeos_sucursal');
    }
};

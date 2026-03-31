<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_esquemas_tarifarios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('liq_clientes')->cascadeOnDelete();
            $table->string('nombre');
            $table->text('descripcion')->nullable();
            // JSON array de strings: ['sucursal', 'concepto']
            $table->json('dimensiones');
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->index(['cliente_id', 'activo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_esquemas_tarifarios');
    }
};

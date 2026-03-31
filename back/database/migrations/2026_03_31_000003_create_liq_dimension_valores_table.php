<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_dimension_valores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('esquema_id')->constrained('liq_esquemas_tarifarios')->cascadeOnDelete();
            // nombre de la dimensión: 'sucursal', 'concepto', 'zona', etc.
            $table->string('nombre_dimension', 80);
            // valor posible: 'AMBA', 'Ut. Corto AM', etc.
            $table->string('valor');
            $table->unsignedSmallInteger('orden_display')->default(0);
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->index(['esquema_id', 'nombre_dimension', 'activo']);
            // Unicidad lógica: no dos valores iguales activos en la misma dimensión del mismo esquema
            $table->unique(['esquema_id', 'nombre_dimension', 'valor'], 'liq_dim_val_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_dimension_valores');
    }
};

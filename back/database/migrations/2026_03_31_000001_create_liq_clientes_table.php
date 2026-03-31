<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_clientes', function (Blueprint $table) {
            $table->id();
            $table->string('razon_social');
            $table->string('nombre_corto', 80)->unique();
            $table->string('cuit', 20)->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->index('activo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_clientes');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_mapeos_distribuidor', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cliente_id');
            $table->string('nombre_pdf', 150);
            $table->unsignedBigInteger('persona_id');
            $table->string('sucursal', 20)->nullable();
            $table->unsignedBigInteger('creado_por')->nullable();
            $table->timestamps();

            $table->foreign('cliente_id')->references('id')->on('liq_clientes')->cascadeOnDelete();
            $table->foreign('persona_id')->references('id')->on('personas')->cascadeOnDelete();
            $table->unique(['cliente_id', 'nombre_pdf', 'sucursal'], 'mapeo_dist_unique');
            $table->index(['cliente_id', 'nombre_pdf'], 'mapeo_dist_lookup');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_mapeos_distribuidor');
    }
};

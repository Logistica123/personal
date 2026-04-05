<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_clientes')) {
            return;
        }

        Schema::create('liq_clientes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('distriapp_cliente_id')->nullable();
            $table->string('razon_social', 255);
            $table->string('nombre_corto', 80);
            $table->string('codigo_corto', 3)->nullable();
            $table->string('cuit', 20)->nullable();
            $table->boolean('activo')->default(true);
            $table->json('configuracion_excel')->nullable();
            $table->timestamps();

            $table->foreign('distriapp_cliente_id')->references('id')->on('clientes')->nullOnDelete();
            $table->unique(['nombre_corto']);
            $table->unique(['codigo_corto']);
            $table->index(['activo']);
            $table->index(['distriapp_cliente_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_clientes');
    }
};


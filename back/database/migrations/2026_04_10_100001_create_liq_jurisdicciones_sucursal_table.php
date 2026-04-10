<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_jurisdicciones_sucursal')) {
            return;
        }

        Schema::create('liq_jurisdicciones_sucursal', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cliente_id');
            $table->string('sucursal', 100);
            $table->unsignedSmallInteger('jurisdiccion_id');
            $table->string('jurisdiccion_nombre', 100);
            $table->timestamps();

            $table->foreign('cliente_id')->references('id')->on('liq_clientes')->cascadeOnDelete();
            $table->unique(['cliente_id', 'sucursal']);
            $table->index(['cliente_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_jurisdicciones_sucursal');
    }
};

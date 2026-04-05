<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_mapeos_sucursal')) {
            return;
        }

        Schema::create('liq_mapeos_sucursal', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cliente_id');
            $table->string('patron_archivo', 200);
            $table->string('sucursal_tarifa', 150);
            $table->string('tipo_operacion', 80)->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->foreign('cliente_id')->references('id')->on('liq_clientes')->cascadeOnDelete();
            $table->index(['cliente_id', 'activo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_mapeos_sucursal');
    }
};

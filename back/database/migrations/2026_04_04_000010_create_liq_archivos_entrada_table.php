<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_archivos_entrada')) {
            return;
        }

        Schema::create('liq_archivos_entrada', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('liquidacion_cliente_id');
            $table->enum('tipo_archivo', ['DATA_CLIENTE', 'DETALLE_SUCURSAL', 'TARIFARIO', 'BASE_DISTRIB', 'VARIABLES']);
            $table->string('nombre_original', 255);
            $table->string('nombre_interno', 255);
            $table->string('disk', 255)->default('local');
            $table->string('ruta_storage', 255);
            $table->unsignedBigInteger('tamano')->default(0);
            $table->unsignedInteger('cant_registros')->nullable();
            $table->string('sucursal', 255)->nullable();
            $table->timestamps();

            $table->foreign('liquidacion_cliente_id')->references('id')->on('liq_liquidaciones_cliente')->cascadeOnDelete();
            $table->unique(['liquidacion_cliente_id', 'nombre_interno']);
            $table->index(['liquidacion_cliente_id', 'tipo_archivo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_archivos_entrada');
    }
};

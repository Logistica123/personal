<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_operaciones')) {
            return;
        }

        Schema::create('liq_operaciones', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('liquidacion_cliente_id');
            $table->unsignedBigInteger('archivo_entrada_id')->nullable();
            $table->json('campos_originales');
            $table->string('dominio', 20)->nullable();
            $table->string('concepto', 200)->nullable();
            $table->string('sucursal_tarifa', 150)->nullable();
            $table->json('dimensiones_valores')->nullable();
            $table->string('dimension_fallida', 80)->nullable();
            $table->decimal('valor_cliente', 15, 2)->default(0);
            $table->unsignedBigInteger('linea_tarifa_id')->nullable();
            $table->decimal('valor_tarifa_original', 15, 2)->nullable();
            $table->decimal('valor_tarifa_distribuidor', 15, 2)->nullable();
            $table->decimal('porcentaje_agencia', 5, 2)->nullable();
            $table->decimal('diferencia_cliente', 15, 2)->nullable();
            $table->enum('estado', ['pendiente', 'ok', 'diferencia', 'sin_tarifa', 'sin_distribuidor', 'duplicado', 'observado', 'excluida'])->default('pendiente');
            $table->unsignedBigInteger('distribuidor_id')->nullable();
            $table->boolean('excluida')->default(false);
            $table->string('motivo_exclusion', 255)->nullable();
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->foreign('liquidacion_cliente_id')->references('id')->on('liq_liquidaciones_cliente')->cascadeOnDelete();
            $table->foreign('archivo_entrada_id')->references('id')->on('liq_archivos_entrada')->nullOnDelete();
            $table->foreign('linea_tarifa_id')->references('id')->on('liq_lineas_tarifa')->nullOnDelete();
            $table->foreign('distribuidor_id')->references('id')->on('personas')->nullOnDelete();
            $table->index(['liquidacion_cliente_id', 'estado']);
            $table->index(['liquidacion_cliente_id', 'excluida']);
            $table->index(['liquidacion_cliente_id', 'distribuidor_id']);
            $table->index(['dominio']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_operaciones');
    }
};

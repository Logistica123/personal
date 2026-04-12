<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_ordenes_pago_detalle')) {
            return;
        }

        Schema::create('liq_ordenes_pago_detalle', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('orden_pago_id');
            $table->unsignedBigInteger('liquidacion_distribuidor_id');

            // --- Datos desnormalizados para el resumen ---
            $table->string('cliente_nombre', 100);
            $table->string('sucursal', 100);
            $table->string('periodo', 20);
            $table->string('distribuidor_nombre', 200);
            $table->string('cobrador_nombre', 200)->nullable();

            // --- Desglose de importes ---
            $table->decimal('subtotal_liquidacion', 15, 2)->default(0);
            $table->decimal('gastos_admin', 15, 2)->default(0);
            $table->decimal('descuento_combustible', 15, 2)->default(0);
            $table->decimal('descuento_paquete', 15, 2)->default(0);
            $table->decimal('descuento_ajuste', 15, 2)->default(0);
            $table->decimal('otros_descuentos', 15, 2)->default(0);
            $table->text('detalle_otros_descuentos')->nullable();
            $table->decimal('importe_final', 15, 2)->default(0);

            $table->timestamps();

            // --- Constraints ---
            $table->foreign('orden_pago_id')->references('id')->on('liq_ordenes_pago')->cascadeOnDelete();
            $table->foreign('liquidacion_distribuidor_id')->references('id')->on('liq_liquidaciones_distribuidor')->restrictOnDelete();
            $table->unique('liquidacion_distribuidor_id');

            // --- Indexes ---
            $table->index(['orden_pago_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_ordenes_pago_detalle');
    }
};

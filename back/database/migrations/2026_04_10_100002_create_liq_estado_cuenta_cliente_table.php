<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_estado_cuenta_cliente')) {
            return;
        }

        Schema::create('liq_estado_cuenta_cliente', function (Blueprint $table) {
            $table->id();

            // --- Identificacion ---
            $table->unsignedBigInteger('cliente_id');
            $table->string('sucursal', 100);
            $table->unsignedSmallInteger('jurisdiccion_id')->nullable();
            $table->string('periodo', 10);
            $table->enum('quincena', ['MC', 'Q1', 'Q2'])->default('MC');

            // --- Datos previos a facturar ---
            $table->decimal('neto_gravado', 15, 2)->default(0);
            $table->decimal('no_gravado', 15, 2)->default(0);
            $table->decimal('iva', 15, 2)->default(0);
            $table->decimal('importe_a_cobrar', 15, 2)->default(0);
            $table->text('observaciones')->nullable();
            $table->enum('tipo_comprobante', ['FA', 'NC', 'ND'])->default('FA');
            $table->unsignedBigInteger('liquidacion_cliente_id')->nullable();

            // --- Datos post-facturacion ---
            $table->unsignedBigInteger('factura_id')->nullable();
            $table->string('numero_factura', 20)->nullable();
            $table->string('cae', 20)->nullable();
            $table->date('fecha_factura')->nullable();
            $table->date('vencimiento_pago')->nullable();

            // --- Datos de cobranza ---
            $table->date('fecha_cobro')->nullable();
            $table->decimal('importe_cobrado', 15, 2)->nullable();
            $table->decimal('retenciones_gcias', 15, 2)->default(0);
            $table->decimal('otras_retenciones', 15, 2)->default(0);
            $table->string('numero_op_cobro', 50)->nullable();
            $table->string('forma_cobro', 50)->nullable();
            $table->decimal('diferencia', 15, 2)->default(0);

            // --- Metadata ---
            $table->enum('estado', ['PENDIENTE', 'FACTURADA', 'COBRADA', 'NC_EMITIDA'])->default('PENDIENTE');
            $table->unsignedBigInteger('usuario_id')->nullable();
            $table->timestamps();

            // --- Foreign keys ---
            $table->foreign('cliente_id')->references('id')->on('liq_clientes')->cascadeOnDelete();
            $table->foreign('liquidacion_cliente_id')->references('id')->on('liq_liquidaciones_cliente')->nullOnDelete();
            $table->foreign('factura_id')->references('id')->on('factura_cabecera')->nullOnDelete();
            $table->foreign('usuario_id')->references('id')->on('users')->nullOnDelete();

            // --- Indexes ---
            $table->index(['cliente_id', 'estado']);
            $table->index(['cliente_id', 'sucursal', 'periodo']);
            $table->index(['liquidacion_cliente_id']);
            $table->index(['factura_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_estado_cuenta_cliente');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cliente_estado_cuenta_manual_rows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('clientes')->restrictOnDelete();
            $table->foreignId('sucursal_id')->nullable()->constrained('sucursals')->nullOnDelete();
            $table->unsignedSmallInteger('anio_facturado');
            $table->unsignedTinyInteger('mes_facturado');
            $table->enum('periodo_facturado', ['PRIMERA_QUINCENA', 'SEGUNDA_QUINCENA', 'MES_COMPLETO']);

            $table->decimal('neto_gravado', 18, 2)->default(0);
            $table->decimal('no_gravado', 18, 2)->default(0);
            $table->decimal('iva', 18, 2)->default(0);
            $table->decimal('importe_a_cobrar', 18, 2)->default(0);

            $table->text('observaciones')->nullable();
            $table->string('numero_factura', 40)->nullable();
            $table->date('fecha_fact')->nullable();

            $table->date('fecha_cobro')->nullable();
            $table->decimal('importe_cobrado', 18, 2)->nullable();
            $table->decimal('retenciones_gcias', 18, 2)->nullable();
            $table->decimal('otras_retenciones', 18, 2)->nullable();
            $table->string('op_cobro_recibo', 40)->nullable();
            $table->string('forma_cobro', 255)->nullable();

            $table->enum('estado_cobranza', ['PENDIENTE', 'A_VENCER', 'VENCIDA', 'COBRADA', 'PARCIAL'])->default('PENDIENTE');

            $table->timestamps();

            $table->index(['cliente_id', 'sucursal_id', 'anio_facturado', 'mes_facturado', 'periodo_facturado'], 'cec_manual_cliente_periodo_idx');
            $table->index(['cliente_id', 'estado_cobranza'], 'cec_manual_cliente_estado_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cliente_estado_cuenta_manual_rows');
    }
};


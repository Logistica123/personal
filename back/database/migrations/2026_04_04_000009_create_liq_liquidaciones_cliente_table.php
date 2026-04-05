<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_liquidaciones_cliente')) {
            return;
        }

        Schema::create('liq_liquidaciones_cliente', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cliente_id');
            $table->string('archivo_origen', 255)->nullable();
            $table->string('sucursal_tarifa', 255)->nullable();
            $table->date('periodo_desde');
            $table->date('periodo_hasta');
            $table->timestamp('fecha_carga')->nullable();
            $table->unsignedBigInteger('usuario_carga')->nullable();
            $table->enum('estado', ['pendiente', 'en_proceso', 'auditada', 'aprobada', 'rechazada'])->default('pendiente');
            $table->unsignedInteger('total_operaciones')->default(0);
            $table->decimal('total_importe_cliente', 15, 2)->default(0);
            $table->decimal('total_importe_correcto', 15, 2)->default(0);
            $table->decimal('total_diferencia', 15, 2)->default(0);
            $table->timestamps();

            $table->foreign('cliente_id')->references('id')->on('liq_clientes')->cascadeOnDelete();
            $table->foreign('usuario_carga')->references('id')->on('users')->nullOnDelete();
            $table->index(['cliente_id', 'estado']);
            $table->index(['cliente_id', 'periodo_desde', 'periodo_hasta']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_liquidaciones_cliente');
    }
};

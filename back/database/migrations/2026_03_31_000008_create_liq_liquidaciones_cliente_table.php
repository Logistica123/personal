<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_liquidaciones_cliente', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('liq_clientes')->cascadeOnDelete();
            // Nombre del archivo Excel cargado
            $table->string('archivo_origen')->nullable();
            // Sucursal de la tarifa asignada a este archivo
            $table->string('sucursal_tarifa')->nullable();
            $table->date('periodo_desde');
            $table->date('periodo_hasta');
            $table->timestamp('fecha_carga')->useCurrent();
            $table->foreignId('usuario_carga')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('estado', ['pendiente', 'en_proceso', 'auditada', 'aprobada', 'rechazada'])
                ->default('pendiente');
            // Totales actualizados en cada procesamiento
            $table->unsignedInteger('total_operaciones')->default(0);
            $table->decimal('total_importe_cliente', 14, 2)->default(0);
            $table->decimal('total_importe_correcto', 14, 2)->default(0);
            $table->decimal('total_diferencia', 14, 2)->default(0);
            $table->timestamps();

            $table->index(['cliente_id', 'estado']);
            $table->index(['cliente_id', 'periodo_desde', 'periodo_hasta'], 'liq_liqcli_cliente_periodo_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_liquidaciones_cliente');
    }
};

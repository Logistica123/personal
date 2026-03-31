<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            $table->id();
            $table->foreignId('liquidacion_cliente_id')
                ->constrained('liq_liquidaciones_cliente')
                ->cascadeOnDelete();
            // Distribuidor = persona en la tabla personas
            $table->foreignId('distribuidor_id')->constrained('personas')->cascadeOnDelete();
            $table->date('periodo_desde');
            $table->date('periodo_hasta');
            $table->timestamp('fecha_generacion')->useCurrent();
            $table->unsignedInteger('cantidad_operaciones')->default(0);
            $table->decimal('subtotal', 14, 2)->default(0);
            $table->decimal('gastos_administrativos', 14, 2)->default(0);
            $table->decimal('total_a_pagar', 14, 2)->default(0);
            $table->enum('estado', ['generada', 'aprobada', 'pagada', 'anulada'])->default('generada');
            // Ruta relativa al PDF generado (storage/app/public/...)
            $table->string('pdf_path')->nullable();
            $table->timestamps();

            $table->index(['liquidacion_cliente_id', 'estado'], 'liq_liqd_lci_estado_idx');
            $table->index(['distribuidor_id', 'periodo_desde'], 'liq_liqd_dist_periodo_idx');
            // Un distribuidor no puede tener dos liquidaciones para el mismo batch
            $table->unique(['liquidacion_cliente_id', 'distribuidor_id'], 'liq_dist_batch_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_liquidaciones_distribuidor');
    }
};

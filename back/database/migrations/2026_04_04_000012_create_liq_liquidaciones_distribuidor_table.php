<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_liquidaciones_distribuidor')) {
            return;
        }

        Schema::create('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('liquidacion_cliente_id');
            $table->unsignedBigInteger('distribuidor_id');
            $table->date('periodo_desde');
            $table->date('periodo_hasta');
            $table->timestamp('fecha_generacion')->nullable();
            $table->unsignedInteger('cantidad_operaciones')->default(0);
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('gastos_administrativos', 15, 2)->default(0);
            $table->decimal('total_a_pagar', 15, 2)->default(0);
            $table->enum('estado', ['generada', 'aprobada', 'pagada', 'anulada'])->default('generada');
            $table->string('pdf_path', 500)->nullable();
            $table->timestamps();

            $table->foreign('liquidacion_cliente_id')->references('id')->on('liq_liquidaciones_cliente')->cascadeOnDelete();
            $table->foreign('distribuidor_id')->references('id')->on('personas')->restrictOnDelete();
            $table->index(['liquidacion_cliente_id']);
            $table->index(['distribuidor_id']);
            $table->unique(['liquidacion_cliente_id', 'distribuidor_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_liquidaciones_distribuidor');
    }
};

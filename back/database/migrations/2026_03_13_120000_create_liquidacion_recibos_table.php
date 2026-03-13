<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liquidacion_recibos', function (Blueprint $table) {
            $table->id();
            $table->string('punto_venta', 10);
            $table->string('numero_recibo', 20);
            $table->date('fecha')->nullable();
            $table->string('estado', 20)->default('emitido');
            $table->json('draft');
            $table->decimal('total_cobro', 15, 2)->default(0);
            $table->decimal('total_imputado', 15, 2)->default(0);
            $table->foreignId('emitido_por')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('anulado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('anulado_at')->nullable();
            $table->string('anulado_leyenda', 80)->nullable();
            $table->text('anulado_motivo')->nullable();
            $table->timestamps();

            $table->unique(['punto_venta', 'numero_recibo'], 'liq_recibos_punto_numero_unique');
            $table->index(['estado', 'fecha'], 'liq_recibos_estado_fecha_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liquidacion_recibos');
    }
};

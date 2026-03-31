<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_lineas_tarifa', function (Blueprint $table) {
            $table->id();
            $table->foreignId('esquema_id')->constrained('liq_esquemas_tarifarios')->cascadeOnDelete();
            // JSON object: {sucursal: 'AMBA', concepto: 'Ut. Corto AM'}
            $table->json('dimensiones_valores');
            // Precios: 2 decimales, positivos
            $table->decimal('precio_original', 12, 2);
            $table->decimal('porcentaje_agencia', 5, 2);
            // Calculado: precio_original * (1 - porcentaje_agencia / 100)
            $table->decimal('precio_distribuidor', 12, 2);
            $table->date('vigencia_desde');
            $table->date('vigencia_hasta')->nullable();
            // Trazabilidad
            $table->foreignId('creado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('aprobado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('fecha_aprobacion')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->index(['esquema_id', 'activo', 'vigencia_desde']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_lineas_tarifa');
    }
};

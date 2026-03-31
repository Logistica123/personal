<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_operaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('liquidacion_cliente_id')
                ->constrained('liq_liquidaciones_cliente')
                ->cascadeOnDelete();
            // Todos los campos del Excel tal cual (trazabilidad completa)
            $table->json('campos_originales');
            // Campos normalizados clave para el procesamiento
            $table->string('dominio', 20)->nullable()->comment('Patente del vehículo normalizada');
            $table->string('concepto')->nullable()->comment('Concepto del Excel (antes del mapeo)');
            $table->decimal('valor_cliente', 12, 2)->default(0);
            // Resultado del cruce tarifario
            $table->foreignId('linea_tarifa_id')
                ->nullable()
                ->constrained('liq_lineas_tarifa')
                ->nullOnDelete();
            $table->decimal('valor_tarifa_original', 12, 2)->nullable();
            $table->decimal('valor_tarifa_distribuidor', 12, 2)->nullable();
            $table->decimal('porcentaje_agencia', 5, 2)->nullable();
            $table->decimal('diferencia_cliente', 12, 2)->nullable()
                ->comment('valor_cliente - valor_tarifa_original');
            // Estado resultante del procesamiento
            $table->enum('estado', [
                'ok',
                'diferencia',
                'sin_tarifa',
                'sin_distribuidor',
                'duplicado',
                'observado',
            ])->default('sin_distribuidor');
            // Distribuidor identificado (clave por patente en tabla personas)
            $table->foreignId('distribuidor_id')
                ->nullable()
                ->constrained('personas')
                ->nullOnDelete();
            $table->text('observacion')->nullable();
            $table->timestamps();

            $table->index(['liquidacion_cliente_id', 'estado']);
            $table->index(['liquidacion_cliente_id', 'distribuidor_id']);
            $table->index('dominio');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_operaciones');
    }
};

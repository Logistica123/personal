<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_lineas_tarifa')) {
            return;
        }

        Schema::create('liq_lineas_tarifa', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('esquema_id');
            $table->json('dimensiones_valores');
            $table->decimal('precio_original', 15, 2);
            $table->decimal('porcentaje_agencia', 5, 2);
            $table->decimal('precio_distribuidor', 15, 2);
            $table->date('vigencia_desde');
            $table->date('vigencia_hasta')->nullable();
            $table->unsignedBigInteger('creado_por')->nullable();
            $table->unsignedBigInteger('aprobado_por')->nullable();
            $table->timestamp('fecha_aprobacion')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->foreign('esquema_id')->references('id')->on('liq_esquemas_tarifarios')->cascadeOnDelete();
            $table->foreign('creado_por')->references('id')->on('users')->nullOnDelete();
            $table->foreign('aprobado_por')->references('id')->on('users')->nullOnDelete();
            $table->index(['esquema_id', 'activo', 'vigencia_desde']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_lineas_tarifa');
    }
};

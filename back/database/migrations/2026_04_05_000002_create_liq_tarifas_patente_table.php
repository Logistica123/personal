<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_tarifas_patente')) {
            return;
        }

        Schema::create('liq_tarifas_patente', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('esquema_id');
            $table->string('patente_norm', 20);
            $table->json('dimensiones_valores');
            $table->unsignedBigInteger('linea_tarifa_id');
            $table->date('vigencia_desde');
            $table->date('vigencia_hasta')->nullable();
            $table->unsignedBigInteger('creado_por')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->foreign('esquema_id')->references('id')->on('liq_esquemas_tarifarios')->cascadeOnDelete();
            $table->foreign('linea_tarifa_id')->references('id')->on('liq_lineas_tarifa')->cascadeOnDelete();
            $table->foreign('creado_por')->references('id')->on('users')->nullOnDelete();

            // Index names kept short to avoid MySQL identifier length issues.
            $table->index(['esquema_id', 'patente_norm', 'activo', 'vigencia_desde'], 'liq_tp_main_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_tarifas_patente');
    }
};


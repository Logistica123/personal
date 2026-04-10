<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_historial_movimientos', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('liquidacion_cliente_id')->nullable();
            $table->unsignedBigInteger('liquidacion_distribuidor_id')->nullable();
            $table->unsignedBigInteger('persona_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('evento', 50);
            $table->text('descripcion');
            $table->json('datos_json')->nullable();
            $table->timestamps();

            $table->index('liquidacion_cliente_id', 'hist_mov_liq_cli');
            $table->index('liquidacion_distribuidor_id', 'hist_mov_liq_dist');
            $table->index('persona_id', 'hist_mov_persona');
            $table->index('evento', 'hist_mov_evento');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_historial_movimientos');
    }
};

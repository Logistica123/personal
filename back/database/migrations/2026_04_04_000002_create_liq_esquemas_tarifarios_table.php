<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_esquemas_tarifarios')) {
            return;
        }

        Schema::create('liq_esquemas_tarifarios', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cliente_id');
            $table->string('nombre', 150);
            $table->text('descripcion')->nullable();
            $table->json('dimensiones');
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->foreign('cliente_id')->references('id')->on('liq_clientes')->cascadeOnDelete();
            $table->index(['cliente_id', 'activo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_esquemas_tarifarios');
    }
};

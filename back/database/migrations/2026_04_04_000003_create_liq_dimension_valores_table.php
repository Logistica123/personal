<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_dimension_valores')) {
            return;
        }

        Schema::create('liq_dimension_valores', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('esquema_id');
            $table->string('nombre_dimension', 80);
            $table->string('valor', 150);
            $table->unsignedSmallInteger('orden_display')->default(0);
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->foreign('esquema_id')->references('id')->on('liq_esquemas_tarifarios')->cascadeOnDelete();
            $table->unique(['esquema_id', 'nombre_dimension', 'valor']);
            $table->index(['esquema_id', 'nombre_dimension', 'activo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_dimension_valores');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tarifa_imagenes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cliente_id')->nullable();
            $table->unsignedBigInteger('sucursal_id')->nullable();
            $table->unsignedTinyInteger('mes')->nullable();
            $table->unsignedSmallInteger('anio')->nullable();
            $table->string('nombre_original')->nullable();
            $table->string('disk')->nullable();
            $table->string('path');
            $table->string('url')->nullable();
            $table->string('mime')->nullable();
            $table->unsignedBigInteger('size')->nullable();
            $table->json('template_data')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['cliente_id', 'sucursal_id', 'mes', 'anio'], 'tarifa_imagenes_filtros_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tarifa_imagenes');
    }
};

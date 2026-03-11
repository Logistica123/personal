<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activos_asesores_comerciales', function (Blueprint $table) {
            $table->id();
            $table->string('encargado')->nullable();
            $table->string('lider')->nullable();
            $table->string('asesor_comercial')->nullable();
            $table->string('rol')->nullable();
            $table->string('transportista_activo')->nullable();
            $table->string('numero')->nullable();
            $table->unsignedInteger('row_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activos_asesores_comerciales');
    }
};

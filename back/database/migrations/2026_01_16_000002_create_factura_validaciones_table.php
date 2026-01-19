<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('factura_validaciones', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('factura_id')->index();
            $table->string('regla', 40);
            $table->boolean('resultado');
            $table->string('mensaje', 255)->nullable();
            $table->timestamps();

            $table->foreign('factura_id')->references('id')->on('facturas')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('factura_validaciones');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('facturas', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('liquidacion_id')->nullable()->index();
            $table->unsignedBigInteger('persona_id')->nullable()->index();
            $table->string('archivo_path');
            $table->string('archivo_disk')->default('public');
            $table->string('razon_social')->nullable();
            $table->string('cuit_emisor', 20)->nullable();
            $table->string('numero_factura', 50)->nullable();
            $table->date('fecha_emision')->nullable();
            $table->string('tipo_factura', 2)->nullable();
            $table->decimal('importe_total', 12, 2)->nullable();
            $table->decimal('iva', 12, 2)->nullable();
            $table->text('concepto')->nullable();
            $table->string('cbu', 30)->nullable();
            $table->decimal('importe_esperado', 12, 2)->nullable();
            $table->string('estado', 20)->default('pendiente');
            $table->string('decision_motivo', 40)->nullable();
            $table->string('decision_mensaje', 255)->nullable();
            $table->timestamps();

            $table->foreign('liquidacion_id')->references('id')->on('archivos')->nullOnDelete();
            $table->foreign('persona_id')->references('id')->on('personas')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('facturas');
    }
};

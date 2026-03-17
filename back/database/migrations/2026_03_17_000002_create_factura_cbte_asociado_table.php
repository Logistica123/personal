<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('factura_cbte_asociado', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factura_id')->constrained('factura_cabecera')->cascadeOnDelete();
            $table->unsignedInteger('cbte_tipo');
            $table->unsignedInteger('pto_vta');
            $table->unsignedBigInteger('cbte_numero');
            $table->date('fecha_emision')->nullable();
            $table->timestamps();

            $table->index(['factura_id', 'cbte_tipo', 'pto_vta', 'cbte_numero'], 'factura_cbte_asociado_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('factura_cbte_asociado');
    }
};


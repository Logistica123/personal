<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_pago_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pago_id')->constrained('liq_pagos')->cascadeOnDelete();
            $table->foreignId('liquidacion_distribuidor_id')
                ->constrained('liq_liquidaciones_distribuidor')
                ->cascadeOnDelete();
            $table->foreignId('distribuidor_id')->constrained('personas')->cascadeOnDelete();
            $table->decimal('monto', 14, 2)->default(0);
            $table->string('cbu_alias')->nullable();
            $table->timestamps();

            $table->unique('liquidacion_distribuidor_id', 'liq_pago_items_liqdist_unique');
            $table->index(['pago_id', 'distribuidor_id'], 'liq_pago_items_pago_dist_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_pago_items');
    }
};


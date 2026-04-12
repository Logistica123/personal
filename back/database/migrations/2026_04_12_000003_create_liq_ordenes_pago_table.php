<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_ordenes_pago')) {
            return;
        }

        Schema::create('liq_ordenes_pago', function (Blueprint $table) {
            $table->id();

            // --- Concepto y numeracion ---
            $table->unsignedBigInteger('concepto_id');
            $table->unsignedInteger('numero');
            $table->string('numero_display', 30);
            $table->unsignedSmallInteger('anio');
            $table->unsignedTinyInteger('mes');
            $table->date('fecha_emision');

            // --- Beneficiario ---
            $table->enum('beneficiario_tipo', ['DISTRIBUIDOR', 'COBRADOR']);
            $table->unsignedBigInteger('beneficiario_id');
            $table->string('beneficiario_nombre', 200);
            $table->string('beneficiario_cuil', 13);
            $table->string('beneficiario_cbu', 22);

            // --- Importes ---
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('total_descuentos', 15, 2)->default(0);
            $table->decimal('total_a_pagar', 15, 2)->default(0);

            // --- Estado y agrupacion ---
            $table->enum('estado', ['BORRADOR', 'PENDIENTE_PAGO', 'ENVIADA_BANCO', 'CONFIRMADA', 'RECHAZADA', 'ANULADA'])->default('BORRADOR');
            $table->enum('agrupacion', ['INDIVIDUAL', 'GLOBAL'])->default('INDIVIDUAL');

            // --- Metadata ---
            $table->text('observaciones')->nullable();
            $table->unsignedBigInteger('usuario_id')->nullable();
            $table->timestamps();

            // --- Constraints ---
            $table->unique(['concepto_id', 'numero']);
            $table->foreign('concepto_id')->references('id')->on('liq_ordenes_pago_conceptos')->restrictOnDelete();
            $table->foreign('beneficiario_id')->references('id')->on('personas')->restrictOnDelete();
            $table->foreign('usuario_id')->references('id')->on('users')->nullOnDelete();

            // --- Indexes ---
            $table->index(['concepto_id', 'anio', 'mes']);
            $table->index(['beneficiario_id']);
            $table->index(['estado']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_ordenes_pago');
    }
};

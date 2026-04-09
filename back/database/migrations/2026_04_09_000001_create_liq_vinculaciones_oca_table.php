<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_vinculaciones_oca', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('liquidacion_cliente_id');
            $table->date('fecha');
            $table->string('nro_planilla', 20);
            $table->string('cod_contrato', 10);
            $table->string('descripcion', 100)->nullable();
            $table->decimal('precio_original', 12, 2);
            $table->decimal('cantidad', 10, 3);
            $table->decimal('importe_original', 12, 2);
            $table->unsignedBigInteger('distribuidor_id')->nullable();
            $table->string('distribuidor_nombre', 100)->nullable();
            $table->decimal('precio_distribuidor', 12, 2)->nullable();
            $table->decimal('importe_distribuidor', 12, 2)->nullable();
            $table->decimal('match_score', 8, 2)->default(0);
            $table->enum('estado', ['EXACTO', 'APROXIMADO', 'SIN_ASIGNAR'])->default('SIN_ASIGNAR');
            $table->string('formato_origen', 20)->nullable();
            $table->string('sucursal', 20)->nullable();
            $table->timestamps();

            $table->foreign('liquidacion_cliente_id')->references('id')->on('liq_liquidaciones_cliente')->cascadeOnDelete();
            $table->foreign('distribuidor_id')->references('id')->on('personas')->nullOnDelete();
            $table->index(['liquidacion_cliente_id', 'fecha'], 'vinc_oca_liq_fecha');
            $table->index(['liquidacion_cliente_id', 'distribuidor_id'], 'vinc_oca_liq_distrib');
            $table->index(['liquidacion_cliente_id', 'estado'], 'vinc_oca_liq_estado');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_vinculaciones_oca');
    }
};

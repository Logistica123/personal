<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_liquidacion_sucursal_totales', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('liquidacion_cliente_id');
            $table->string('sucursal', 20);
            $table->integer('cantidad_operaciones')->default(0);
            $table->decimal('total_importe', 14, 2)->default(0);
            $table->decimal('total_gravado', 14, 2)->default(0);
            $table->decimal('total_no_gravado', 14, 2)->default(0);
            $table->decimal('diferencia_tms_pdf', 14, 2)->nullable();
            $table->unsignedBigInteger('pdf_archivo_id')->nullable();
            $table->timestamp('parseado_at')->nullable();
            $table->timestamps();

            $table->unique(['liquidacion_cliente_id', 'sucursal'], 'uk_liq_suc_totales');
            $table->index('liquidacion_cliente_id', 'idx_lst_liq');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_liquidacion_sucursal_totales');
    }
};

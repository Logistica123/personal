<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_distributor_lines', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('distributor_id')->index();
            $table->unsignedBigInteger('run_id')->index();
            $table->unsignedBigInteger('staging_row_id')->nullable()->index();
            $table->unsignedInteger('row_number')->nullable();
            $table->dateTime('fecha')->nullable()->index();
            $table->string('id_ruta', 120)->nullable();
            $table->string('svc', 120)->nullable();
            $table->string('turno_norm', 20)->nullable();
            $table->decimal('factor_jornada', 8, 3)->default(1);
            $table->decimal('tarifa_dist_calculada', 14, 2)->nullable();
            $table->decimal('plus_calculado', 14, 2)->default(0);
            $table->decimal('importe_calculado', 14, 2)->nullable();
            $table->decimal('tarifa_override', 14, 2)->nullable();
            $table->decimal('plus_override', 14, 2)->nullable();
            $table->decimal('importe_override', 14, 2)->nullable();
            $table->decimal('importe_final', 14, 2)->nullable();
            $table->text('motivo_override')->nullable();
            $table->json('alertas')->nullable();
            $table->timestamps();

            $table->foreign('distributor_id')->references('id')->on('liq_distributors')->cascadeOnDelete();
            $table->foreign('run_id')->references('id')->on('liq_import_runs')->cascadeOnDelete();
            $table->foreign('staging_row_id')->references('id')->on('liq_staging_rows')->nullOnDelete();
            $table->unique(['run_id', 'staging_row_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_distributor_lines');
    }
};


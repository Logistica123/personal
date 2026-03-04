<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_distributors', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('run_id')->index();
            $table->string('distributor_key', 190);
            $table->unsignedBigInteger('provider_id')->nullable()->index();
            $table->string('patente_norm', 20)->nullable()->index();
            $table->string('distributor_code', 120)->nullable()->index();
            $table->string('distributor_name')->nullable();
            $table->string('categoria_vehiculo', 50)->nullable();
            $table->decimal('subtotal_calculado', 14, 2)->default(0);
            $table->decimal('subtotal_final', 14, 2)->default(0);
            $table->decimal('gastos_admin_default', 14, 2)->default(2010);
            $table->decimal('gastos_admin_override', 14, 2)->nullable();
            $table->decimal('gastos_admin_final', 14, 2)->default(2010);
            $table->decimal('ajuste_manual', 14, 2)->default(0);
            $table->decimal('total_final', 14, 2)->default(0);
            $table->boolean('has_overrides')->default(false);
            $table->unsignedInteger('alerts_count')->default(0);
            $table->string('status', 30)->nullable()->index();
            $table->timestamps();

            $table->unique(['run_id', 'distributor_key']);
            $table->foreign('run_id')->references('id')->on('liq_import_runs')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_distributors');
    }
};


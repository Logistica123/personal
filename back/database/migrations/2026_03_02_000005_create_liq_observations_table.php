<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_observations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('run_id')->index();
            $table->unsignedBigInteger('staging_row_id')->nullable()->index();
            $table->unsignedBigInteger('validation_result_id')->nullable()->index();
            $table->string('type', 20)->index();
            $table->text('message');
            $table->unsignedBigInteger('assigned_to')->nullable()->index();
            $table->string('status', 20)->default('OPEN')->index();
            $table->text('resolved_note')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->foreign('run_id')->references('id')->on('liq_import_runs')->cascadeOnDelete();
            $table->foreign('staging_row_id')->references('id')->on('liq_staging_rows')->nullOnDelete();
            $table->foreign('validation_result_id')->references('id')->on('liq_validation_results')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_observations');
    }
};


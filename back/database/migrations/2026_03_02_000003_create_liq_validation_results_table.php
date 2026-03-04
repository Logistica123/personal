<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_validation_results', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('run_id')->index();
            $table->unsignedBigInteger('staging_row_id')->nullable()->index();
            $table->string('rule_code', 80)->index();
            $table->string('severity', 20)->index();
            $table->string('result', 20)->index();
            $table->string('expected_value')->nullable();
            $table->string('actual_value')->nullable();
            $table->text('message')->nullable();
            $table->timestamps();

            $table->foreign('run_id')->references('id')->on('liq_import_runs')->cascadeOnDelete();
            $table->foreign('staging_row_id')->references('id')->on('liq_staging_rows')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_validation_results');
    }
};


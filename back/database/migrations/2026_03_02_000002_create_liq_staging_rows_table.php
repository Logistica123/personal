<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_staging_rows', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('run_id')->index();
            $table->unsignedInteger('row_number')->nullable();
            $table->string('external_row_id', 120)->nullable()->index();
            $table->string('domain_norm', 20)->nullable()->index();
            $table->dateTime('occurred_at')->nullable()->index();
            $table->string('station')->nullable();
            $table->string('product')->nullable();
            $table->string('invoice_number', 120)->nullable()->index();
            $table->string('conductor')->nullable();
            $table->unsignedBigInteger('distributor_id')->nullable()->index();
            $table->string('distributor_code', 120)->nullable()->index();
            $table->string('distributor_name')->nullable();
            $table->decimal('liters', 12, 3)->nullable();
            $table->decimal('amount', 12, 2)->nullable();
            $table->decimal('price_per_liter', 12, 3)->nullable();
            $table->decimal('tariff_expected', 12, 3)->nullable();
            $table->decimal('amount_expected', 12, 2)->nullable();
            $table->string('validation_status', 30)->default('OK')->index();
            $table->decimal('validation_score', 5, 2)->nullable();
            $table->string('severity_max', 20)->nullable()->index();
            $table->boolean('is_duplicate')->default(false)->index();
            $table->string('duplicate_group_key', 190)->nullable()->index();
            $table->text('observations_auto')->nullable();
            $table->json('raw_payload_json')->nullable();
            $table->timestamps();

            $table->foreign('run_id')->references('id')->on('liq_import_runs')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_staging_rows');
    }
};


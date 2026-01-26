<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fuel_movements', function (Blueprint $table) {
            $table->id();
            $table->dateTime('occurred_at')->nullable();
            $table->string('station')->nullable();
            $table->string('domain_raw')->nullable();
            $table->string('domain_norm')->nullable()->index();
            $table->string('product')->nullable();
            $table->decimal('liters', 12, 3)->nullable();
            $table->decimal('amount', 12, 2)->nullable();
            $table->decimal('price_per_liter', 12, 3)->nullable();
            $table->string('status')->default('IMPORTED')->index();
            $table->text('observations')->nullable();
            $table->string('source_file')->nullable();
            $table->unsignedInteger('source_row')->nullable();
            $table->string('duplicate_hash')->nullable()->index();
            $table->string('provider')->nullable();
            $table->string('format')->nullable();
            $table->string('period_from')->nullable();
            $table->string('period_to')->nullable();
            $table->unsignedBigInteger('imported_by')->nullable()->index();
            $table->unsignedBigInteger('distributor_id')->nullable()->index();
            $table->unsignedBigInteger('fuel_report_id')->nullable()->index();
            $table->boolean('discounted')->default(false)->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fuel_movements');
    }
};

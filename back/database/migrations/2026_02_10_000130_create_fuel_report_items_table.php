<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fuel_report_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('fuel_report_id')->index();
            $table->unsignedBigInteger('fuel_movement_id')->index();
            $table->decimal('liters', 12, 3)->nullable();
            $table->decimal('amount', 12, 2)->nullable();
            $table->timestamps();

            $table->foreign('fuel_report_id')->references('id')->on('fuel_reports')->cascadeOnDelete();
            $table->foreign('fuel_movement_id')->references('id')->on('fuel_movements')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fuel_report_items');
    }
};

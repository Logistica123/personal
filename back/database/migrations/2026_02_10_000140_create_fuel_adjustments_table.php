<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fuel_adjustments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('fuel_report_id')->index();
            $table->string('type');
            $table->decimal('amount', 14, 2);
            $table->string('note')->nullable();
            $table->unsignedBigInteger('created_by')->nullable()->index();
            $table->timestamps();

            $table->foreign('fuel_report_id')->references('id')->on('fuel_reports')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fuel_adjustments');
    }
};

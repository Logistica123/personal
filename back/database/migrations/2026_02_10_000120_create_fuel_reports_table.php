<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fuel_reports', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('distributor_id')->index();
            $table->string('period_from')->nullable();
            $table->string('period_to')->nullable();
            $table->string('status')->default('DRAFT')->index();
            $table->decimal('total_amount', 14, 2)->default(0);
            $table->decimal('adjustments_total', 14, 2)->default(0);
            $table->decimal('total_to_bill', 14, 2)->default(0);
            $table->unsignedBigInteger('liquidacion_id')->nullable()->index();
            $table->unsignedBigInteger('created_by')->nullable()->index();
            $table->unsignedBigInteger('applied_by')->nullable()->index();
            $table->timestamp('applied_at')->nullable();
            $table->timestamps();

            $table->foreign('distributor_id')->references('id')->on('distributors')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fuel_reports');
    }
};

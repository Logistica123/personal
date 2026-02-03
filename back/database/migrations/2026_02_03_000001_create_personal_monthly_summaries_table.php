<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('personal_monthly_summaries', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->unsignedInteger('altas')->default(0);
            $table->unsignedInteger('bajas')->default(0);
            $table->unsignedInteger('total')->default(0);
            $table->timestamp('frozen_at')->nullable();
            $table->timestamps();
            $table->unique(['year', 'month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('personal_monthly_summaries');
    }
};

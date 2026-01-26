<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('distributor_domains', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('distributor_id')->index();
            $table->string('domain_norm')->unique();
            $table->string('domain_raw')->nullable();
            $table->timestamps();

            $table->foreign('distributor_id')->references('id')->on('distributors')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('distributor_domains');
    }
};

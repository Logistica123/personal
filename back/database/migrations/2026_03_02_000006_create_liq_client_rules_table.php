<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_client_rules', function (Blueprint $table) {
            $table->id();
            $table->string('client_code', 100)->unique();
            $table->boolean('active')->default(true)->index();
            $table->json('rules_json')->nullable();
            $table->text('note')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_client_rules');
    }
};


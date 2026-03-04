<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transportista_qr_access_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('persona_id')->nullable()->index();
            $table->string('qr_code', 40)->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->text('referrer')->nullable();
            $table->timestamps();

            $table
                ->foreign('persona_id')
                ->references('id')
                ->on('personas')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transportista_qr_access_logs');
    }
};


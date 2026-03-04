<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('call_sessions', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('initiator_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('target_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('provider', 32)->default('twilio');
            $table->string('direction', 16)->default('outbound');
            $table->string('channel', 16)->default('client');
            $table->string('status', 24)->default('initiated');
            $table->string('initiator_identity', 120)->nullable();
            $table->string('target_identity', 120)->nullable();
            $table->string('from_phone', 32)->nullable();
            $table->string('to_phone', 32)->nullable();
            $table->string('provider_call_sid', 64)->nullable()->unique();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('answered_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->string('end_reason', 64)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index('initiator_identity');
            $table->index('target_identity');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('call_sessions');
    }
};

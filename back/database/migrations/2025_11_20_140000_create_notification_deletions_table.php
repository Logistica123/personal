<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_deletions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('notification_id')->nullable();
            $table->unsignedBigInteger('deleted_by_id')->nullable();
            $table->text('message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('notification_id');
            $table->index('deleted_by_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_deletions');
    }
};

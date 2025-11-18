<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('general_info_entries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->text('body');
            $table->unsignedBigInteger('author_id')->nullable();
            $table->string('author_name')->nullable();
            $table->string('author_role')->nullable();
            $table->text('image_data')->nullable();
            $table->string('image_alt')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('general_info_entries');
    }
};

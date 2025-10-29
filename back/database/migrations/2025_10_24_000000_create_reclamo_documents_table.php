<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('reclamo_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reclamo_id')->constrained()->cascadeOnDelete();
            $table->string('nombre_original')->nullable();
            $table->string('disk');
            $table->string('path');
            $table->string('download_url')->nullable();
            $table->string('mime')->nullable();
            $table->unsignedBigInteger('size')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reclamo_documents');
    }
};

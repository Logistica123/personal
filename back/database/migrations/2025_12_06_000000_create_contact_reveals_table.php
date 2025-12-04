<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_reveals', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('persona_id')->index();
            $table->string('campo', 50);
            $table->unsignedBigInteger('actor_id')->nullable()->index();
            $table->string('actor_name', 255)->nullable();
            $table->string('actor_email', 255)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index(['persona_id', 'campo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_reveals');
    }
};

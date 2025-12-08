<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('color', 32)->nullable();
            $table->timestamps();
        });

        Schema::create('team_group_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_group_id')->constrained('team_groups')->cascadeOnDelete();
            $table->string('name');
            $table->string('email')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('team_group_members');
        Schema::dropIfExists('team_groups');
    }
};

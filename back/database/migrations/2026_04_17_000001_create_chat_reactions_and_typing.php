<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('chat_message_reactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('message_id')->index();
            $table->unsignedBigInteger('user_id')->index();
            $table->string('emoji', 16);
            $table->timestamps();

            $table->unique(['message_id', 'user_id', 'emoji'], 'chat_reaction_unique');
        });

        Schema::create('chat_typing', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('contact_id');
            $table->timestamp('updated_at')->useCurrent();

            $table->primary(['user_id', 'contact_id']);
            $table->index('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_message_reactions');
        Schema::dropIfExists('chat_typing');
    }
};

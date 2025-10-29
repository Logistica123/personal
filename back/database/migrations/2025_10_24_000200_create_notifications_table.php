<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::getConnection()->getTablePrefix() === '') {
            $connection = Schema::getConnection();
            $schema = $connection->getDatabaseName();
            if ($schema) {
                $exists = $connection->selectOne(
                    "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
                    [$schema, $connection->getTablePrefix().'notifications']
                );
                if ($exists && (int) ($exists->total ?? 0) > 0) {
                    return;
                }
            }
        }

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reclamo_id')->nullable()->constrained()->nullOnDelete();
            $table->string('message');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_audit_changes', function (Blueprint $table) {
            $table->id();
            $table->string('entity_type', 40)->index();
            $table->unsignedBigInteger('entity_id')->index();
            $table->string('field', 80)->index();
            $table->text('old_value')->nullable();
            $table->text('new_value')->nullable();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->text('reason');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_audit_changes');
    }
};


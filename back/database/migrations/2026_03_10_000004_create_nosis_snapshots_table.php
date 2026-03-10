<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('nosis_snapshots')) {
            return;
        }

        Schema::create('nosis_snapshots', function (Blueprint $table) {
            $table->id();
            $table->string('entity_type', 40)->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('snapshot_type', 20);
            $table->string('documento', 20)->nullable();
            $table->string('cbu', 30)->nullable();
            $table->boolean('valid')->default(false);
            $table->string('message', 500)->nullable();
            $table->longText('raw_response')->nullable();
            $table->json('parsed_response')->nullable();
            $table->timestamp('requested_at')->nullable();
            $table->timestamps();

            $table->index(['entity_type', 'entity_id'], 'nosis_snapshots_entity_idx');
            $table->index('documento', 'nosis_snapshots_documento_idx');
            $table->index('snapshot_type', 'nosis_snapshots_type_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nosis_snapshots');
    }
};

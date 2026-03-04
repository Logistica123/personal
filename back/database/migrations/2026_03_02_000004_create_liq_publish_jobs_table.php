<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_publish_jobs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('run_id')->index();
            $table->string('status', 30)->default('PENDING')->index();
            $table->string('erp_request_id', 120)->nullable()->index();
            $table->string('erp_batch_id', 120)->nullable()->index();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->longText('request_payload')->nullable();
            $table->longText('response_payload')->nullable();
            $table->text('error_message')->nullable();
            $table->unsignedBigInteger('created_by')->nullable()->index();
            $table->timestamps();

            $table->foreign('run_id')->references('id')->on('liq_import_runs')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_publish_jobs');
    }
};


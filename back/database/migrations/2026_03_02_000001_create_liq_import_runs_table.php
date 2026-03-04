<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liq_import_runs', function (Blueprint $table) {
            $table->id();
            $table->string('source_system', 30)->default('powerbi')->index();
            $table->string('client_code', 100)->nullable()->index();
            $table->date('period_from')->nullable()->index();
            $table->date('period_to')->nullable()->index();
            $table->string('source_file_name')->nullable();
            $table->text('source_file_url')->nullable();
            $table->string('source_file_hash', 128)->nullable()->index();
            $table->string('status', 30)->default('RECEIVED')->index();
            $table->unsignedInteger('rows_total')->default(0);
            $table->unsignedInteger('rows_ok')->default(0);
            $table->unsignedInteger('rows_error')->default(0);
            $table->unsignedInteger('rows_alert')->default(0);
            $table->unsignedInteger('rows_diff')->default(0);
            $table->json('metadata')->nullable();
            $table->unsignedBigInteger('created_by')->nullable()->index();
            $table->unsignedBigInteger('approved_by')->nullable()->index();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_import_runs');
    }
};


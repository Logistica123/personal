<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('client_tax_documents')) {
            return;
        }

        Schema::create('client_tax_documents', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cliente_id');
            $table->unsignedBigInteger('uploaded_by')->nullable();
            $table->string('category', 50)->nullable();
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('fecha_vencimiento')->nullable();
            $table->string('disk', 40)->default('public');
            $table->string('path');
            $table->string('original_name')->nullable();
            $table->string('mime', 120)->nullable();
            $table->unsignedBigInteger('size')->nullable();
            $table->timestamps();

            $table->index(['cliente_id', 'fecha_vencimiento'], 'client_tax_documents_cliente_fecha_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_tax_documents');
    }
};

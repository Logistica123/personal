<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('factura_ocr', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('factura_id')->index();
            $table->longText('raw_text');
            $table->json('extracted_json')->nullable();
            $table->string('model', 50)->nullable();
            $table->decimal('confidence', 5, 2)->nullable();
            $table->timestamps();

            $table->foreign('factura_id')->references('id')->on('facturas')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('factura_ocr');
    }
};

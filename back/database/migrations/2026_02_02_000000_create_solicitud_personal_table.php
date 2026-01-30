<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('solicitud_personal', function (Blueprint $table) {
            $table->id();
            $table->string('tipo');
            $table->string('estado')->default('Pendiente');
            $table->json('form')->nullable();
            $table->foreignId('solicitante_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('destinatario_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('solicitud_personal');
    }
};

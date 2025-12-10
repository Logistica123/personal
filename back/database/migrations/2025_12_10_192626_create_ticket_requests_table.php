<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('ticket_requests', function (Blueprint $table) {
            $table->id();
            $table->string('titulo')->nullable();
            $table->string('categoria')->nullable();
            $table->text('insumos')->nullable();
            $table->string('cantidad')->nullable();
            $table->text('notas')->nullable();
            $table->decimal('monto', 12, 2)->nullable();
            $table->decimal('factura_monto', 12, 2)->nullable();
            $table->json('factura_archivos')->nullable();
            $table->unsignedBigInteger('destinatario_id')->nullable();
            $table->unsignedBigInteger('responsable_id')->nullable();
            $table->unsignedBigInteger('hr_id')->nullable();
            $table->unsignedBigInteger('solicitante_id')->nullable();
            $table->string('estado', 50)->default('pendiente_responsable');
            $table->timestamps();

            $table->index('estado');
            $table->index('responsable_id');
            $table->index('hr_id');
            $table->index('solicitante_id');
            $table->index('destinatario_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ticket_requests');
    }
};

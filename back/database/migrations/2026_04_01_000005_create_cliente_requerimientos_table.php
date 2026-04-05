<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cliente_requerimientos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('clientes');
            $table->foreignId('sucursal_id')->nullable()->constrained('sucursals');
            $table->string('requerimiento');
            $table->unsignedInteger('cantidad')->default(1);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['cliente_id', 'sucursal_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cliente_requerimientos');
    }
};


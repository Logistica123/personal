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
        Schema::create('personas', function (Blueprint $table) {
            $table->id();
            $table->string('apellidos')->nullable();
            $table->string('nombres')->nullable();
            $table->string('cuil')->nullable();
            $table->string('telefono')->nullable();
            $table->string('email')->nullable();
            $table->boolean('pago')->default(false);
            $table->string('cbu_alias')->nullable();
            $table->string('combustible')->nullable();
            $table->unsignedBigInteger('unidad_id')->nullable();
            $table->unsignedBigInteger('cliente_id')->nullable();
            $table->unsignedBigInteger('sucursal_id')->nullable();
            $table->unsignedBigInteger('agente_id')->nullable();
            $table->unsignedBigInteger('estado_id')->nullable();
            $table->string('tipo')->nullable();
            $table->string('patente')->nullable();
            $table->boolean('tarifaespecial')->default(false);
            $table->text('observaciontarifa')->nullable();
            $table->text('observaciones')->nullable();
            $table->timestamp('fecha_alta')->nullable();
            $table->softDeletes();
            $table->timestamps();

            // Relaciones opcionales (sin forzar FK si las tablas aún no existen)
            // $table->foreign('cliente_id')->references('id')->on('clientes')->nullOnDelete();
            // $table->foreign('unidad_id')->references('id')->on('unidades')->nullOnDelete();
            // $table->foreign('sucursal_id')->references('id')->on('sucursales')->nullOnDelete();
            // $table->foreign('agente_id')->references('id')->on('users')->nullOnDelete();
            // $table->foreign('estado_id')->references('id')->on('estados')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('personas');
    }
};

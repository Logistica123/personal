<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('membresia_cuotas', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('persona_id');
            $table->string('periodo', 7); // YYYY-MM
            $table->decimal('monto', 10, 2)->nullable();
            $table->boolean('pagado')->default(false);
            $table->date('fecha_pago')->nullable();
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->foreign('persona_id')->references('id')->on('personas')->onDelete('cascade');
            $table->unique(['persona_id', 'periodo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('membresia_cuotas');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('membresia_beneficio_usos', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('persona_id');
            $table->string('tramo'); // mes_1, mes_3, mes_6, mes_12
            $table->string('beneficio_key');
            $table->string('beneficio_label');
            $table->date('fecha_uso');
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->foreign('persona_id')->references('id')->on('personas')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('membresia_beneficio_usos');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('persona_patentes')) {
            return;
        }

        Schema::create('persona_patentes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('persona_id');
            $table->string('patente', 100);
            $table->string('patente_norm', 100);
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->foreign('persona_id')->references('id')->on('personas')->cascadeOnDelete();
            $table->unique('patente_norm', 'persona_patentes_patente_norm_unique');
            $table->index(['persona_id', 'activo'], 'persona_patentes_persona_activo_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('persona_patentes');
    }
};

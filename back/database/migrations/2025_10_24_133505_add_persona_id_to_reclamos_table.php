<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reclamos', function (Blueprint $table) {
            // Agregamos la columna persona_id si no existe
            if (!Schema::hasColumn('reclamos', 'persona_id')) {
                $table->unsignedBigInteger('persona_id')->nullable()->after('id');

                // Relación opcional con personas
                $table->foreign('persona_id')
                      ->references('id')
                      ->on('personas')
                      ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('reclamos', function (Blueprint $table) {
            if (Schema::hasColumn('reclamos', 'persona_id')) {
                $table->dropForeign(['persona_id']);
                $table->dropColumn('persona_id');
            }
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agrega columna generada patente_idx a personas para búsquedas rápidas
 * por patente normalizada (sin espacios, guiones ni puntos, en mayúsculas).
 *
 * Esto permite que LiqExtractosController haga:
 *   Persona::where('patente_idx', $dominioNormalizado)->first()
 * usando el índice en lugar de un REPLACE/UPPER en la query.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            // Columna generada almacenada (STORED = puede indexarse en MySQL 5.7+)
            $table->string('patente_idx', 100)
                ->nullable()
                ->storedAs("UPPER(REPLACE(REPLACE(REPLACE(IFNULL(patente,''), ' ', ''), '-', ''), '.', ''))")
                ->after('patente');

            $table->index('patente_idx', 'personas_patente_idx');
        });
    }

    public function down(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            $table->dropIndex('personas_patente_idx');
            $table->dropColumn('patente_idx');
        });
    }
};

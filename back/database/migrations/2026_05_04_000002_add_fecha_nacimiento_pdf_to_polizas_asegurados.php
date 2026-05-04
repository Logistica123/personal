<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Suma `fecha_nacimiento_pdf` a `polizas_asegurados`. El parser ya extrae
 * la fecha del PDF (MAPFRE endoso y SC incorporación) y los templates de email
 * la usan vía placeholder `{fecha_nac}`.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('polizas_asegurados', function (Blueprint $table) {
            $table->date('fecha_nacimiento_pdf')->nullable()->after('localidad_pdf');
        });
    }

    public function down(): void
    {
        Schema::table('polizas_asegurados', function (Blueprint $table) {
            $table->dropColumn('fecha_nacimiento_pdf');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM 12 Parte A — threshold por póliza para destacar visualmente
 * solicitudes sin respuesta. Default 7 días.
 *
 * No dispara emails — solo se usa en bandeja `/polizas/solicitudes` y en la
 * card del dashboard `/polizas/dashboard/alertas`.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            $table->unsignedInteger('dias_alerta_sin_respuesta')
                ->default(7)
                ->after('alerta_dias_antes_vencimiento');
        });
    }

    public function down(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            $table->dropColumn('dias_alerta_sin_respuesta');
        });
    }
};

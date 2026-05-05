<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM 15 — flag por póliza para ofrecer auto-aprobación de distribuidor
 * cuando se confirma una solicitud de alta `respondida_ok`. Default TRUE
 * (todas las pólizas existentes ofrecen el modal).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            $table->boolean('ofrecer_auto_aprobacion_distribuidor')
                  ->default(true)
                  ->after('alerta_dias_antes_vencimiento');
        });
    }

    public function down(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            $table->dropColumn('ofrecer_auto_aprobacion_distribuidor');
        });
    }
};

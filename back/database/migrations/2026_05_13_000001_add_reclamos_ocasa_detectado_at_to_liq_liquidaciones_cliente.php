<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM (2026-05-13) — Reclamos OCASA: feedback claro.
 *
 * Permite distinguir en la UI entre:
 *   - Nunca se corrió la detección  (campo NULL)
 *   - Se corrió y dio 0 subpagos     (campo con timestamp, reclamos vacíos)
 *   - Se corrió y dio N subpagos     (campo con timestamp + filas en liq_reclamos_ocasa)
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('liq_liquidaciones_cliente', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_liquidaciones_cliente', 'reclamos_ocasa_detectado_at')) {
                $table->timestamp('reclamos_ocasa_detectado_at')->nullable()->after('updated_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('liq_liquidaciones_cliente', function (Blueprint $table) {
            if (Schema::hasColumn('liq_liquidaciones_cliente', 'reclamos_ocasa_detectado_at')) {
                $table->dropColumn('reclamos_ocasa_detectado_at');
            }
        });
    }
};

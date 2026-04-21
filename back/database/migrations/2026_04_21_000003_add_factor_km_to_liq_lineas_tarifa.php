<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * BUGFIX 31 v2 — agregar factor_km a liq_lineas_tarifa.
 *
 * Algunos overrides OCASA (Walter PAL831, Benítez OMU364) aplican un factor multiplicador
 * al CostoKm del TMS en vez de una tarifa km absoluta:
 *     pago = costo_fijo × fracción + factor_km × CostoKm_TMS
 *
 * vs. modo tradicional (Ruefli M1):
 *     pago = tarifa_fija + tarifa_km × (dist - 240)
 *
 * El servicio decide según qué columna esté poblada.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_lineas_tarifa', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_lineas_tarifa', 'factor_km')) {
                $table->decimal('factor_km', 8, 4)->nullable()->after('tarifa_km_distribuidor');
            }
        });
    }

    public function down(): void
    {
        Schema::table('liq_lineas_tarifa', function (Blueprint $table) {
            if (Schema::hasColumn('liq_lineas_tarifa', 'factor_km')) {
                $table->dropColumn('factor_km');
            }
        });
    }
};

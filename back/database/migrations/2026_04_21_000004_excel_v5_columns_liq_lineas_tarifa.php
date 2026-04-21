<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * BUGFIX 31 v2 — Excel v5 "Esquema OCASA unificado".
 *
 * Reemplaza el modelo M1/M2/M3 del spec original por un motor unificado con fórmula:
 *   pago = costo_fijo_distrib × fracción_jornada
 *        + factor_km_distrib   × CostoKm_TMS
 *        + factor_prod_distrib × CostoProd_TMS
 *        + factor_cant_distrib × CostoCant_TMS
 *        − penalidades_TMS
 *
 * Todo vive en liq_lineas_tarifa con flag es_tarifa_base (1=BASE por ruta+cap, 0=OVERRIDE).
 * Para overrides se popula distribuidor_nombre y/o patente_match.
 *
 * Resolver (en orden): {ruta,cap,distribuidor_nombre} → {ruta,cap,patente_match} → {ruta,cap} BASE → sin_tarifa.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_lineas_tarifa', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_lineas_tarifa', 'ruta_codigo')) {
                $table->string('ruta_codigo', 10)->nullable()->after('codigo_sucursal')->index();
            }
            if (!Schema::hasColumn('liq_lineas_tarifa', 'es_tarifa_base')) {
                // 1 = base (aplica a toda la ruta+cap), 0 = override (requiere distribuidor_nombre o patente_match)
                $table->boolean('es_tarifa_base')->default(true)->after('ruta_codigo');
            }
            if (!Schema::hasColumn('liq_lineas_tarifa', 'distribuidor_nombre')) {
                $table->string('distribuidor_nombre', 120)->nullable()->after('es_tarifa_base')->index();
            }
            if (!Schema::hasColumn('liq_lineas_tarifa', 'patente_match')) {
                $table->string('patente_match', 15)->nullable()->after('distribuidor_nombre')->index();
            }
            if (!Schema::hasColumn('liq_lineas_tarifa', 'factor_prod_distrib')) {
                $table->decimal('factor_prod_distrib', 8, 4)->nullable()->after('factor_km');
            }
            if (!Schema::hasColumn('liq_lineas_tarifa', 'factor_cant_distrib')) {
                $table->decimal('factor_cant_distrib', 8, 4)->nullable()->after('factor_prod_distrib');
            }
            if (!Schema::hasColumn('liq_lineas_tarifa', 'n_ops_observadas')) {
                $table->unsignedInteger('n_ops_observadas')->default(0)->after('factor_cant_distrib');
            }
            if (!Schema::hasColumn('liq_lineas_tarifa', 'observaciones_v5')) {
                $table->string('observaciones_v5', 500)->nullable()->after('n_ops_observadas');
            }

            // Índice compuesto para el resolver
            $table->index(['esquema_id', 'ruta_codigo', 'capacidad_vehiculo_kg', 'es_tarifa_base'], 'idx_lt_resolver');
        });
    }

    public function down(): void
    {
        Schema::table('liq_lineas_tarifa', function (Blueprint $table) {
            $table->dropIndex('idx_lt_resolver');
            $table->dropColumn([
                'ruta_codigo', 'es_tarifa_base', 'distribuidor_nombre',
                'patente_match', 'factor_prod_distrib', 'factor_cant_distrib',
                'n_ops_observadas', 'observaciones_v5',
            ]);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC "Importador de Tarifas OCASA" v1.0 (2026-04-21)
 *
 * Agrega columnas faltantes en liq_lineas_tarifa requeridas por el nuevo importador:
 *   - km_tarifa_la: km de referencia de Logística Argentina para cálculos de productividad
 *   - motivo_carga: texto libre que explica por qué se cargó/actualizó la tarifa
 *
 * Crea la tabla liq_tarifas_import_log para auditoría de importaciones (quién/cuándo/qué).
 *
 * NOTA: no agrega UNIQUE constraint nuevo — el servicio usa updateOrCreate con la 5-tupla
 * (esquema, ruta, capacidad, distribuidor, patente, es_tarifa_base) para permitir
 * coexistencia BASE + OVERRIDES sobre la misma ruta+capacidad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_lineas_tarifa', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_lineas_tarifa', 'km_tarifa_la')) {
                $table->decimal('km_tarifa_la', 12, 2)->nullable()->after('factor_km');
            }
            if (!Schema::hasColumn('liq_lineas_tarifa', 'motivo_carga')) {
                $table->string('motivo_carga', 500)->nullable()->after('observaciones_v5');
            }
        });

        if (!Schema::hasTable('liq_tarifas_import_log')) {
            Schema::create('liq_tarifas_import_log', function (Blueprint $table) {
                $table->id();
                $table->foreignId('usuario_id')->constrained('users');
                $table->foreignId('cliente_id')->constrained('liq_clientes');
                $table->foreignId('esquema_id')->constrained('liq_esquemas_tarifarios');
                $table->string('archivo_nombre', 200);
                $table->unsignedInteger('filas_totales')->default(0);
                $table->unsignedInteger('filas_ok')->default(0);
                $table->unsignedInteger('filas_error')->default(0);
                $table->enum('tipo_import', ['tarifas', 'motivos', 'materiales', 'combinado'])->default('tarifas');
                $table->json('resumen_json')->nullable();
                $table->timestamps();
                $table->index(['cliente_id', 'created_at'], 'idx_imp_cliente_fecha');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_tarifas_import_log');

        Schema::table('liq_lineas_tarifa', function (Blueprint $table) {
            if (Schema::hasColumn('liq_lineas_tarifa', 'km_tarifa_la')) {
                $table->dropColumn('km_tarifa_la');
            }
            if (Schema::hasColumn('liq_lineas_tarifa', 'motivo_carga')) {
                $table->dropColumn('motivo_carga');
            }
        });
    }
};

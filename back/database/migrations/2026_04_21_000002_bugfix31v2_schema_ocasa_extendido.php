<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * BUGFIX 31 v2 — Schema extendido para los 3 modelos OCASA + integración YCC.
 *
 * Decisiones:
 *   - Schema EXTENDIDO (no dedicado): se reutilizan liq_lineas_tarifa, liq_tarifas_patente,
 *     liq_operaciones_detalle. Se agregan columnas opcionales.
 *   - Dos catálogos nuevos: liq_material_mapeo (PA→Paquetería…) y liq_motivos_exitosos (Z4…).
 *   - Para "Por distribuidor" sin override: se marca la operación con requiere_override_manual=1
 *     y queda en estado sin_tarifa hasta que ops cargue el override (Feature 31.x UI).
 */
return new class extends Migration
{
    public function up(): void
    {
        // --- liq_lineas_tarifa: columnas para M1 (rango distancia) y M3 (material × zona) ---
        Schema::table('liq_lineas_tarifa', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_lineas_tarifa', 'rango_distancia')) {
                $table->enum('rango_distancia', ['hasta_120', '120_240', 'mas_240', 'km_excedente', 'vuelta_2_3'])
                      ->nullable()->after('modelo_tarifa');
            }
            if (!Schema::hasColumn('liq_lineas_tarifa', 'material_tarifario')) {
                $table->string('material_tarifario', 50)->nullable()->after('rango_distancia');
            }
            if (!Schema::hasColumn('liq_lineas_tarifa', 'zona')) {
                $table->string('zona', 10)->nullable()->after('material_tarifario');
            }
            if (!Schema::hasColumn('liq_lineas_tarifa', 'es_minimo')) {
                $table->boolean('es_minimo')->default(false)->after('zona');
            }
            if (!Schema::hasColumn('liq_lineas_tarifa', 'codigo_sucursal')) {
                $table->string('codigo_sucursal', 10)->nullable()->after('es_minimo');
            }
            // Índices de apoyo para el matcher nuevo (M1 / M3 / capacidad)
            $table->index(['esquema_id', 'codigo_sucursal', 'rango_distancia'], 'idx_lt_m1');
            $table->index(['esquema_id', 'codigo_sucursal', 'material_tarifario', 'zona'], 'idx_lt_m3');
        });

        // --- liq_operaciones_detalle: campos faltantes del YCC (material, cod_regio, motivo) ---
        Schema::table('liq_operaciones_detalle', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_operaciones_detalle', 'material_ycc')) {
                $table->string('material_ycc', 10)->nullable()->after('bultos');
            }
            if (!Schema::hasColumn('liq_operaciones_detalle', 'cod_regio')) {
                $table->string('cod_regio', 10)->nullable()->after('material_ycc');
            }
            if (!Schema::hasColumn('liq_operaciones_detalle', 'motivo')) {
                $table->string('motivo', 20)->nullable()->after('cod_regio');
            }
        });

        // --- liq_operaciones: IdTrack TMS + modelo aplicado + flag override requerido ---
        Schema::table('liq_operaciones', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_operaciones', 'idtrack_tms')) {
                $table->string('idtrack_tms', 5)->nullable()->after('total_paradas');
            }
            if (!Schema::hasColumn('liq_operaciones', 'modelo_calculo')) {
                // M1 / M2 / M3 / OVERRIDE — qué motor de cálculo resolvió la tarifa
                $table->string('modelo_calculo', 10)->nullable()->after('modelo_tarifa');
            }
            if (!Schema::hasColumn('liq_operaciones', 'requiere_override_manual')) {
                $table->boolean('requiere_override_manual')->default(false)->after('modelo_calculo');
            }
        });

        // --- Catálogo: mapeo material YCC → material tarifario ---
        if (!Schema::hasTable('liq_material_mapeo')) {
            Schema::create('liq_material_mapeo', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('cliente_id');
                $table->string('codigo_ycc', 10);            // PA, SO, BO, BI
                $table->string('material_tarifario', 50);    // Paquetería, Courier, Postal…
                $table->text('descripcion')->nullable();
                $table->timestamps();

                $table->unique(['cliente_id', 'codigo_ycc'], 'uq_cliente_codigo_ycc');
                $table->foreign('cliente_id')->references('id')->on('liq_clientes')->cascadeOnDelete();
            });
        }

        // --- Catálogo: motivos exitosos de entrega (para eficiencia real) ---
        if (!Schema::hasTable('liq_motivos_exitosos')) {
            Schema::create('liq_motivos_exitosos', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('cliente_id');
                $table->string('codigo', 20);                // Z4, Z1, 2, etc.
                $table->boolean('es_exitoso')->default(false);
                $table->text('descripcion')->nullable();
                $table->timestamps();

                $table->unique(['cliente_id', 'codigo'], 'uq_cliente_motivo');
                $table->foreign('cliente_id')->references('id')->on('liq_clientes')->cascadeOnDelete();
            });
        }

        // --- Seeds iniciales para OCASA ---
        $ocasaIds = DB::table('liq_clientes')
            ->where(function ($q) {
                $q->where('nombre_corto', 'OCASA')->orWhere('razon_social', 'like', '%OCASA%');
            })
            ->pluck('id');

        foreach ($ocasaIds as $clienteId) {
            // Material YCC → Material tarifario (ajustable por ABM después)
            $materiales = [
                'PA' => 'Paquetería',
                'SO' => 'Postal',
                'BO' => 'Courier',
                'BI' => 'Courier',
            ];
            foreach ($materiales as $ycc => $tarif) {
                DB::table('liq_material_mapeo')->updateOrInsert(
                    ['cliente_id' => $clienteId, 'codigo_ycc' => $ycc],
                    ['material_tarifario' => $tarif, 'created_at' => now(), 'updated_at' => now()]
                );
            }

            // Motivo exitoso: Z4 por default (según BUGFIX 31 v2 §5)
            DB::table('liq_motivos_exitosos')->updateOrInsert(
                ['cliente_id' => $clienteId, 'codigo' => 'Z4'],
                ['es_exitoso' => true, 'descripcion' => 'Entrega en domicilio (~67%)', 'created_at' => now(), 'updated_at' => now()]
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_motivos_exitosos');
        Schema::dropIfExists('liq_material_mapeo');

        Schema::table('liq_operaciones', function (Blueprint $table) {
            $table->dropColumn(['idtrack_tms', 'modelo_calculo', 'requiere_override_manual']);
        });

        Schema::table('liq_operaciones_detalle', function (Blueprint $table) {
            $table->dropColumn(['material_ycc', 'cod_regio', 'motivo']);
        });

        Schema::table('liq_lineas_tarifa', function (Blueprint $table) {
            $table->dropIndex('idx_lt_m1');
            $table->dropIndex('idx_lt_m3');
            $table->dropColumn(['rango_distancia', 'material_tarifario', 'zona', 'es_minimo', 'codigo_sucursal']);
        });
    }
};

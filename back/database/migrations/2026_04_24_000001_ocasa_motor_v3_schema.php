<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC v3 "Fix Motor OCASA + PDF Productividad" · Fase 0 — Migración de schema.
 *
 * No cambia el comportamiento del motor actual. Solo agrega los campos y tablas
 * que consumen las fases siguientes:
 *   - detalle_paradas jsonb · estado_calculo · error_msg · modo_pago en liq_operaciones
 *   - factor_distrib en liq_lineas_tarifa (para rama B del resolver)
 *   - liq_tarifas_contrato_cliente (para detección subpago OCASA — rama B del BUG B)
 *   - liq_reclamos_ocasa (para flaguear subpagos detectados)
 *
 * La tabla liq_tarifas_productividad_cliente se crea vía OCASA_v7_migracion.sql
 * (la entrega Matías junto a los INSERT de las 98 filas ROS001+SUR001).
 *
 * Idempotente: usa hasColumn / hasTable guards.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ALTER liq_operaciones
        Schema::table('liq_operaciones', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_operaciones', 'detalle_paradas')) {
                $table->json('detalle_paradas')->nullable()
                    ->comment('SPEC v3 · Rama D productividad: array de paradas con material/zona/motivo/tarifa — consumido por el PDF distribuidor.');
            }
            if (!Schema::hasColumn('liq_operaciones', 'estado_calculo')) {
                $table->string('estado_calculo', 30)->nullable()->default('ok')
                    ->comment("SPEC v3 · 'ok' | 'sin_tarifa_definida' (rama C del resolver).");
            }
            if (!Schema::hasColumn('liq_operaciones', 'error_msg')) {
                $table->text('error_msg')->nullable()
                    ->comment('SPEC v3 · mensaje del motor cuando estado_calculo != ok.');
            }
            if (!Schema::hasColumn('liq_operaciones', 'modo_pago')) {
                $table->string('modo_pago', 30)->nullable()
                    ->comment("SPEC v3 · 'override_jornada' | 'factor_tms' | 'productividad_paradas' — indica qué rama del resolver matcheó.");
            }
        });

        // ALTER liq_lineas_tarifa
        Schema::table('liq_lineas_tarifa', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_lineas_tarifa', 'factor_distrib')) {
                $table->decimal('factor_distrib', 5, 4)->nullable()
                    ->after('factor_km')
                    ->comment('SPEC v3 · factor general del distribuidor (ej 0.85 = margen 15%). Rama B del resolver: pago = factor × (CostoFijo_TMS + CostoKm_TMS). Si es NULL y no hay override absoluto → rama C error.');
            }
        });

        // CREATE liq_tarifas_contrato_cliente (BUG B — detección subpago OCASA)
        if (!Schema::hasTable('liq_tarifas_contrato_cliente')) {
            Schema::create('liq_tarifas_contrato_cliente', function (Blueprint $table) {
                $table->id();
                $table->foreignId('cliente_id')->constrained('liq_clientes');
                $table->string('sucursal', 60);
                $table->unsignedInteger('capacidad_vehiculo');
                $table->string('concepto', 30)
                    ->comment("hasta_120 | 121_240 | mas_240 | valor_km_240 | 2da_3ra_vuelta | motos | jornada_{N} | km_{N} | 2da_vuelta_120 | 3ra_vuelta_120");
                $table->decimal('importe_contrato', 14, 4);
                $table->date('vigencia_desde');
                $table->date('vigencia_hasta')->nullable();
                $table->timestamps();
                $table->unique(
                    ['cliente_id', 'sucursal', 'capacidad_vehiculo', 'concepto', 'vigencia_desde'],
                    'uniq_tcc'
                );
                $table->index(['cliente_id', 'sucursal', 'capacidad_vehiculo'], 'idx_tcc_busqueda');
            });
        }

        // CREATE liq_reclamos_ocasa (flag de subpagos detectados)
        if (!Schema::hasTable('liq_reclamos_ocasa')) {
            Schema::create('liq_reclamos_ocasa', function (Blueprint $table) {
                $table->id();
                $table->foreignId('op_id')->constrained('liq_operaciones');
                $table->foreignId('tarifa_contrato_id')->constrained('liq_tarifas_contrato_cliente');
                $table->decimal('importe_tms', 14, 2);
                $table->decimal('importe_esperado', 14, 2);
                $table->decimal('diferencia', 14, 2)
                    ->comment('importe_esperado - importe_tms · positivo = subpago OCASA');
                $table->string('estado', 30)->default('pendiente_reclamo')
                    ->comment('pendiente_reclamo | reclamado | ajustado | cerrado');
                $table->text('motivo_detectado')->nullable();
                $table->timestamp('creado_at')->useCurrent();
                $table->timestamp('reclamado_at')->nullable();
                $table->timestamp('resuelto_at')->nullable();
                $table->text('resolucion')->nullable();
                $table->index(['op_id'], 'idx_roc_op');
                $table->index(['estado', 'creado_at'], 'idx_roc_estado');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_reclamos_ocasa');
        Schema::dropIfExists('liq_tarifas_contrato_cliente');

        Schema::table('liq_lineas_tarifa', function (Blueprint $table) {
            if (Schema::hasColumn('liq_lineas_tarifa', 'factor_distrib')) {
                $table->dropColumn('factor_distrib');
            }
        });

        Schema::table('liq_operaciones', function (Blueprint $table) {
            foreach (['detalle_paradas', 'estado_calculo', 'error_msg', 'modo_pago'] as $col) {
                if (Schema::hasColumn('liq_operaciones', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Campos nuevos en liq_operaciones (OCASA: componentes de costo, modelo, fracción)
        if (!Schema::hasColumn('liq_operaciones', 'modelo_tarifa')) {
            Schema::table('liq_operaciones', function (Blueprint $table) {
                $table->string('modelo_tarifa', 20)->nullable()->after('observaciones');
                $table->decimal('costo_fijo', 12, 2)->nullable()->after('modelo_tarifa');
                $table->decimal('costo_km', 12, 2)->nullable()->after('costo_fijo');
                $table->decimal('costo_prod', 12, 2)->nullable()->after('costo_km');
                $table->decimal('costo_cant', 12, 2)->nullable()->after('costo_prod');
                $table->decimal('distancia_km', 10, 2)->nullable()->after('costo_cant');
                $table->unsignedInteger('total_paradas')->nullable()->after('distancia_km');
                $table->unsignedInteger('capacidad_vehiculo_kg')->nullable()->after('total_paradas');
                $table->decimal('fraccion_jornada', 5, 4)->default(1.0000)->after('capacidad_vehiculo_kg');
                $table->decimal('tarifa_jornada_distrib', 12, 2)->nullable()->after('fraccion_jornada');
                $table->decimal('tarifa_km_distrib_valor', 12, 2)->nullable()->after('tarifa_jornada_distrib');
                $table->decimal('tarifa_prod_distrib', 12, 2)->nullable()->after('tarifa_km_distrib_valor');
                $table->decimal('importe_gravado', 12, 2)->nullable()->after('tarifa_prod_distrib');
                $table->decimal('importe_no_gravado', 12, 2)->nullable()->after('importe_gravado');
            });
        }

        // 2. Campos nuevos en liq_lineas_tarifa (OCASA: modelo, km, productividad, capacidad)
        if (!Schema::hasColumn('liq_lineas_tarifa', 'modelo_tarifa')) {
            Schema::table('liq_lineas_tarifa', function (Blueprint $table) {
                $table->string('modelo_tarifa', 20)->nullable()->after('activo');
                $table->decimal('costo_fijo_base', 12, 2)->nullable()->after('modelo_tarifa');
                $table->decimal('tarifa_km_original', 12, 2)->nullable()->after('costo_fijo_base');
                $table->decimal('tarifa_km_distribuidor', 12, 2)->nullable()->after('tarifa_km_original');
                $table->unsignedInteger('umbral_km')->default(240)->after('tarifa_km_distribuidor');
                $table->string('modo_productividad', 20)->nullable()->after('umbral_km');
                $table->decimal('tarifa_parada_distrib', 12, 2)->nullable()->after('modo_productividad');
                $table->decimal('tarifa_bulto_distrib', 12, 2)->nullable()->after('tarifa_parada_distrib');
                $table->unsignedInteger('capacidad_vehiculo_kg')->nullable()->after('tarifa_bulto_distrib');
            });
        }

        // 3. Campos nuevos en personas (OCASA: capacidad vehículo, peajes)
        if (!Schema::hasColumn('personas', 'capacidad_vehiculo_kg')) {
            Schema::table('personas', function (Blueprint $table) {
                $table->unsignedInteger('capacidad_vehiculo_kg')->nullable()->after('patente');
            });
        }
        if (!Schema::hasColumn('personas', 'paga_peajes')) {
            Schema::table('personas', function (Blueprint $table) {
                $table->boolean('paga_peajes')->default(true)->after('capacidad_vehiculo_kg');
            });
        }

        // 4. Campos nuevos en liq_liquidaciones_distribuidor (OCASA: seguro, peajes)
        if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'beneficio_seguro')) {
            Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
                $table->decimal('beneficio_seguro', 12, 2)->default(0)->after('total_a_pagar');
                $table->decimal('subtotal_peajes', 12, 2)->default(0)->after('beneficio_seguro');
            });
        }

        // 5. Tabla liq_conceptos_facturacion
        if (!Schema::hasTable('liq_conceptos_facturacion')) {
            Schema::create('liq_conceptos_facturacion', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('cliente_id');
                $table->string('tipo', 20); // gravado, no_gravado, otro
                $table->string('concepto_template', 500);
                $table->unsignedInteger('orden')->default(1);
                $table->boolean('solo_si_importe')->default(false);
                $table->boolean('activo')->default(true);
                $table->timestamps();

                $table->foreign('cliente_id')->references('id')->on('liq_clientes')->cascadeOnDelete();
                $table->index(['cliente_id', 'activo']);
            });
        }

        // 6. Tabla liq_operaciones_detalle (YCC1)
        if (!Schema::hasTable('liq_operaciones_detalle')) {
            Schema::create('liq_operaciones_detalle', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('operacion_id');
                $table->unsignedInteger('parada')->nullable();
                $table->string('codigo_postal', 10)->nullable();
                $table->string('distrito', 100)->nullable();
                $table->unsignedInteger('bultos')->nullable();
                $table->decimal('costo', 12, 2)->nullable();
                $table->decimal('costo_productividad', 12, 2)->nullable();
                $table->timestamps();

                $table->foreign('operacion_id')->references('id')->on('liq_operaciones')->cascadeOnDelete();
                $table->index('operacion_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_operaciones_detalle');
        Schema::dropIfExists('liq_conceptos_facturacion');

        Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            $table->dropColumn(['beneficio_seguro', 'subtotal_peajes']);
        });

        if (Schema::hasColumn('personas', 'paga_peajes')) {
            Schema::table('personas', function (Blueprint $table) {
                $table->dropColumn('paga_peajes');
            });
        }
        if (Schema::hasColumn('personas', 'capacidad_vehiculo_kg')) {
            Schema::table('personas', function (Blueprint $table) {
                $table->dropColumn('capacidad_vehiculo_kg');
            });
        }

        Schema::table('liq_lineas_tarifa', function (Blueprint $table) {
            $table->dropColumn([
                'modelo_tarifa', 'costo_fijo_base', 'tarifa_km_original',
                'tarifa_km_distribuidor', 'umbral_km', 'modo_productividad',
                'tarifa_parada_distrib', 'tarifa_bulto_distrib', 'capacidad_vehiculo_kg',
            ]);
        });

        Schema::table('liq_operaciones', function (Blueprint $table) {
            $table->dropColumn([
                'modelo_tarifa', 'costo_fijo', 'costo_km', 'costo_prod', 'costo_cant',
                'distancia_km', 'total_paradas', 'capacidad_vehiculo_kg', 'fraccion_jornada',
                'tarifa_jornada_distrib', 'tarifa_km_distrib_valor', 'tarifa_prod_distrib',
                'importe_gravado', 'importe_no_gravado',
            ]);
        });
    }
};

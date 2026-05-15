<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM Pagos — extension de Features A (cobrador override), B (Factura A) y C
 * (ajuste manual) al flujo LEGACY de la tabla archivos.
 *
 * Mismos campos que ya estan en liq_liquidaciones_distribuidor, replicados aca para que
 * los botones del listado /pagos funcionen igual para liquidaciones extractos
 * (~273) y legacy (~12k archivos pendientes).
 *
 *   importe_facturar      = lo que se transfiere hoy (= total_a_pagar en extracto).
 *   importe_facturar_base = snapshot del neto antes de IVA (cuando tipo='A').
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            if (!Schema::hasColumn('archivos', 'tipo_comprobante')) {
                $table->enum('tipo_comprobante', ['B', 'C', 'A', 'M', 'SIN_FACTURA'])
                    ->default('C')
                    ->after('importe_facturar');
            }
            if (!Schema::hasColumn('archivos', 'importe_facturar_base')) {
                $table->decimal('importe_facturar_base', 15, 2)->nullable()->after('tipo_comprobante');
            }
            if (!Schema::hasColumn('archivos', 'iva_porcentaje')) {
                $table->decimal('iva_porcentaje', 5, 2)->nullable()->after('importe_facturar_base');
            }
            if (!Schema::hasColumn('archivos', 'importe_iva')) {
                $table->decimal('importe_iva', 15, 2)->default(0)->after('iva_porcentaje');
            }
            if (!Schema::hasColumn('archivos', 'importe_facturar_overridido')) {
                $table->boolean('importe_facturar_overridido')->default(false)->after('importe_iva');
            }
            if (!Schema::hasColumn('archivos', 'requiere_revision_dual')) {
                $table->boolean('requiere_revision_dual')->default(false)->after('importe_facturar_overridido');
            }
            if (!Schema::hasColumn('archivos', 'cobrador_override_nombre')) {
                $table->string('cobrador_override_nombre', 200)->nullable()->after('requiere_revision_dual');
            }
            if (!Schema::hasColumn('archivos', 'cobrador_override_cuit')) {
                $table->string('cobrador_override_cuit', 20)->nullable()->after('cobrador_override_nombre');
            }
            if (!Schema::hasColumn('archivos', 'cobrador_override_cbu')) {
                $table->string('cobrador_override_cbu', 50)->nullable()->after('cobrador_override_cuit');
            }
            if (!Schema::hasColumn('archivos', 'cobrador_override_alias_cbu')) {
                $table->string('cobrador_override_alias_cbu', 50)->nullable()->after('cobrador_override_cbu');
            }
            if (!Schema::hasColumn('archivos', 'cobrador_override_motivo')) {
                $table->string('cobrador_override_motivo', 300)->nullable()->after('cobrador_override_alias_cbu');
            }
            if (!Schema::hasColumn('archivos', 'cobrador_override_at')) {
                $table->timestamp('cobrador_override_at')->nullable()->after('cobrador_override_motivo');
            }
            if (!Schema::hasColumn('archivos', 'cobrador_override_por')) {
                $table->unsignedBigInteger('cobrador_override_por')->nullable()->after('cobrador_override_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            foreach ([
                'cobrador_override_por', 'cobrador_override_at', 'cobrador_override_motivo',
                'cobrador_override_alias_cbu', 'cobrador_override_cbu', 'cobrador_override_cuit',
                'cobrador_override_nombre', 'requiere_revision_dual', 'importe_facturar_overridido',
                'importe_iva', 'iva_porcentaje', 'importe_facturar_base', 'tipo_comprobante',
            ] as $col) {
                if (Schema::hasColumn('archivos', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};

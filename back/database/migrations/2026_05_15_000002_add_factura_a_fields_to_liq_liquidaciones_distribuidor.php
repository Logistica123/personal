<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM Pagos — Feature B (Factura A).
 *
 * Permite marcar una liq_liquidacion_distribuidor como Factura A: snapshot
 * del neto en importe_base + IVA discriminado en importe_iva. El total_a_pagar
 * pasa a ser bruto (base + IVA) sin romper el contrato del resto del flujo.
 *
 *   tipo_comprobante = 'C' (default) → neto = bruto, sin IVA.
 *   tipo_comprobante = 'A'           → bruto = importe_base + importe_iva.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'tipo_comprobante')) {
                $table->enum('tipo_comprobante', ['B', 'C', 'A', 'M', 'SIN_FACTURA'])
                    ->default('C')
                    ->after('total_a_pagar');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'importe_base')) {
                // Snapshot del neto antes de aplicar IVA (solo se usa cuando tipo='A').
                $table->decimal('importe_base', 15, 2)->nullable()->after('tipo_comprobante');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'iva_porcentaje')) {
                $table->decimal('iva_porcentaje', 5, 2)->nullable()->after('importe_base');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'importe_iva')) {
                $table->decimal('importe_iva', 15, 2)->default(0)->after('iva_porcentaje');
            }
        });
    }

    public function down(): void
    {
        Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            foreach (['importe_iva', 'iva_porcentaje', 'importe_base', 'tipo_comprobante'] as $col) {
                if (Schema::hasColumn('liq_liquidaciones_distribuidor', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM Pagos — Feature A (Cobrador real, override puntual).
 *
 * Override por liquidación: cuando hay que cambiar el cobrador efectivo de UNA
 * liquidación específica sin tocar la ficha del distribuidor.
 *
 * Prioridad de resolución del beneficiario efectivo:
 *   1) cobrador_override_* en esta liquidación (si cobrador_override_cbu está cargado)
 *   2) personas.cobrador_* del distribuidor (si es_cobrador = 1)
 *   3) personas (cbu_alias propio) del distribuidor
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'cobrador_override_nombre')) {
                $table->string('cobrador_override_nombre', 200)->nullable()->after('total_a_pagar');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'cobrador_override_cuit')) {
                $table->string('cobrador_override_cuit', 20)->nullable()->after('cobrador_override_nombre');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'cobrador_override_cbu')) {
                $table->string('cobrador_override_cbu', 50)->nullable()->after('cobrador_override_cuit');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'cobrador_override_alias_cbu')) {
                $table->string('cobrador_override_alias_cbu', 50)->nullable()->after('cobrador_override_cbu');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'cobrador_override_motivo')) {
                $table->string('cobrador_override_motivo', 300)->nullable()->after('cobrador_override_alias_cbu');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'cobrador_override_at')) {
                $table->timestamp('cobrador_override_at')->nullable()->after('cobrador_override_motivo');
            }
            if (!Schema::hasColumn('liq_liquidaciones_distribuidor', 'cobrador_override_por')) {
                $table->unsignedBigInteger('cobrador_override_por')->nullable()->after('cobrador_override_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            foreach ([
                'cobrador_override_por', 'cobrador_override_at',
                'cobrador_override_motivo', 'cobrador_override_alias_cbu',
                'cobrador_override_cbu', 'cobrador_override_cuit',
                'cobrador_override_nombre',
            ] as $col) {
                if (Schema::hasColumn('liq_liquidaciones_distribuidor', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            if (! Schema::hasColumn('liq_liquidaciones_distribuidor', 'pago_id')) {
                $table->foreignId('pago_id')->nullable()->constrained('liq_pagos')->nullOnDelete()->after('estado');
            }
            if (! Schema::hasColumn('liq_liquidaciones_distribuidor', 'fecha_pago')) {
                $table->timestamp('fecha_pago')->nullable()->after('pago_id');
            }
            if (! Schema::hasColumn('liq_liquidaciones_distribuidor', 'pagado_por')) {
                $table->foreignId('pagado_por')->nullable()->constrained('users')->nullOnDelete()->after('fecha_pago');
            }
            if (! Schema::hasColumn('liq_liquidaciones_distribuidor', 'pago_referencia')) {
                $table->string('pago_referencia')->nullable()->after('pagado_por');
            }

            $table->index(['pago_id', 'estado'], 'liq_liqd_pago_estado_idx');
        });
    }

    public function down(): void
    {
        Schema::table('liq_liquidaciones_distribuidor', function (Blueprint $table) {
            if (Schema::hasColumn('liq_liquidaciones_distribuidor', 'pago_referencia')) {
                $table->dropColumn('pago_referencia');
            }
            if (Schema::hasColumn('liq_liquidaciones_distribuidor', 'pagado_por')) {
                $table->dropConstrainedForeignId('pagado_por');
            }
            if (Schema::hasColumn('liq_liquidaciones_distribuidor', 'fecha_pago')) {
                $table->dropColumn('fecha_pago');
            }
            if (Schema::hasColumn('liq_liquidaciones_distribuidor', 'pago_id')) {
                $table->dropConstrainedForeignId('pago_id');
            }
            $table->dropIndex('liq_liqd_pago_estado_idx');
        });
    }
};


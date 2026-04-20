<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * BUGFIX 26 Feature 26.2: flag por cliente que habilita la pestaña de
 * "Split Fiscal por Sucursal" en Estado de Cuenta Cliente. Default false;
 * OCASA se activa post-migración.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_clientes', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_clientes', 'split_fiscal_por_sucursal')) {
                $table->boolean('split_fiscal_por_sucursal')->default(false)->after('pagar_peajes_a_distribuidor');
            }
        });

        // OCASA sí requiere split fiscal por sucursal (BUGFIX 25 ya dejó el dato en las operaciones)
        DB::table('liq_clientes')
            ->where(function ($q) {
                $q->where('nombre_corto', 'OCASA')
                  ->orWhere('razon_social', 'like', '%OCASA%');
            })
            ->update(['split_fiscal_por_sucursal' => true]);
    }

    public function down(): void
    {
        Schema::table('liq_clientes', function (Blueprint $table) {
            if (Schema::hasColumn('liq_clientes', 'split_fiscal_por_sucursal')) {
                $table->dropColumn('split_fiscal_por_sucursal');
            }
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('factura_cabecera', function (Blueprint $table) {
            if (! Schema::hasColumn('factura_cabecera', 'op_cobro_recibo_manual')) {
                $table->string('op_cobro_recibo_manual', 40)->nullable()->after('observaciones_cobranza');
            }
            if (! Schema::hasColumn('factura_cabecera', 'forma_cobro_manual')) {
                $table->string('forma_cobro_manual', 255)->nullable()->after('op_cobro_recibo_manual');
            }
            if (! Schema::hasColumn('factura_cabecera', 'retenciones_gcias_manual')) {
                $table->decimal('retenciones_gcias_manual', 18, 2)->nullable()->after('forma_cobro_manual');
            }
            if (! Schema::hasColumn('factura_cabecera', 'otras_retenciones_manual')) {
                $table->decimal('otras_retenciones_manual', 18, 2)->nullable()->after('retenciones_gcias_manual');
            }
        });
    }

    public function down(): void
    {
        Schema::table('factura_cabecera', function (Blueprint $table) {
            $columns = [
                'op_cobro_recibo_manual',
                'forma_cobro_manual',
                'retenciones_gcias_manual',
                'otras_retenciones_manual',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('factura_cabecera', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};


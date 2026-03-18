<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('factura_cabecera', function (Blueprint $table) {
            if (! Schema::hasColumn('factura_cabecera', 'op_cobro_archivo_path')) {
                $table->string('op_cobro_archivo_path', 255)->nullable()->after('op_cobro_recibo_manual');
            }
            if (! Schema::hasColumn('factura_cabecera', 'op_cobro_archivo_nombre')) {
                $table->string('op_cobro_archivo_nombre', 255)->nullable()->after('op_cobro_archivo_path');
            }
        });

        Schema::table('cliente_estado_cuenta_manual_rows', function (Blueprint $table) {
            if (! Schema::hasColumn('cliente_estado_cuenta_manual_rows', 'op_cobro_archivo_path')) {
                $table->string('op_cobro_archivo_path', 255)->nullable()->after('op_cobro_recibo');
            }
            if (! Schema::hasColumn('cliente_estado_cuenta_manual_rows', 'op_cobro_archivo_nombre')) {
                $table->string('op_cobro_archivo_nombre', 255)->nullable()->after('op_cobro_archivo_path');
            }
        });
    }

    public function down(): void
    {
        Schema::table('factura_cabecera', function (Blueprint $table) {
            $columns = [
                'op_cobro_archivo_nombre',
                'op_cobro_archivo_path',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('factura_cabecera', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('cliente_estado_cuenta_manual_rows', function (Blueprint $table) {
            $columns = [
                'op_cobro_archivo_nombre',
                'op_cobro_archivo_path',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('cliente_estado_cuenta_manual_rows', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};


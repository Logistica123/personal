<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('reclamos')) {
            return;
        }

        Schema::table('reclamos', function (Blueprint $table) {
            if (! Schema::hasColumn('reclamos', 'cliente_nombre')) {
                $table->string('cliente_nombre')->nullable()->after('detalle');
            }
            if (! Schema::hasColumn('reclamos', 'sucursal_nombre')) {
                $table->string('sucursal_nombre')->nullable()->after('cliente_nombre');
            }
            if (! Schema::hasColumn('reclamos', 'distribuidor_nombre')) {
                $table->string('distribuidor_nombre')->nullable()->after('sucursal_nombre');
            }
            if (! Schema::hasColumn('reclamos', 'emisor_factura')) {
                $table->string('emisor_factura')->nullable()->after('distribuidor_nombre');
            }
            if (! Schema::hasColumn('reclamos', 'importe_solicitado')) {
                $table->decimal('importe_solicitado', 12, 2)->nullable()->after('emisor_factura');
            }
            if (! Schema::hasColumn('reclamos', 'cuit_cobrador')) {
                $table->string('cuit_cobrador', 32)->nullable()->after('importe_solicitado');
            }
            if (! Schema::hasColumn('reclamos', 'medio_pago')) {
                $table->string('medio_pago', 120)->nullable()->after('cuit_cobrador');
            }
            if (! Schema::hasColumn('reclamos', 'concepto')) {
                $table->text('concepto')->nullable()->after('medio_pago');
            }
            if (! Schema::hasColumn('reclamos', 'fecha_compromiso_pago')) {
                $table->date('fecha_compromiso_pago')->nullable()->after('concepto');
            }
            if (! Schema::hasColumn('reclamos', 'aprobacion_estado')) {
                $table->string('aprobacion_estado', 20)->nullable()->after('fecha_compromiso_pago');
            }
            if (! Schema::hasColumn('reclamos', 'aprobacion_motivo')) {
                $table->text('aprobacion_motivo')->nullable()->after('aprobacion_estado');
            }
            if (! Schema::hasColumn('reclamos', 'bloqueado_en')) {
                $table->timestamp('bloqueado_en')->nullable()->after('aprobacion_motivo');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('reclamos')) {
            return;
        }

        Schema::table('reclamos', function (Blueprint $table) {
            if (Schema::hasColumn('reclamos', 'bloqueado_en')) {
                $table->dropColumn('bloqueado_en');
            }
            if (Schema::hasColumn('reclamos', 'aprobacion_motivo')) {
                $table->dropColumn('aprobacion_motivo');
            }
            if (Schema::hasColumn('reclamos', 'aprobacion_estado')) {
                $table->dropColumn('aprobacion_estado');
            }
            if (Schema::hasColumn('reclamos', 'fecha_compromiso_pago')) {
                $table->dropColumn('fecha_compromiso_pago');
            }
            if (Schema::hasColumn('reclamos', 'concepto')) {
                $table->dropColumn('concepto');
            }
            if (Schema::hasColumn('reclamos', 'medio_pago')) {
                $table->dropColumn('medio_pago');
            }
            if (Schema::hasColumn('reclamos', 'cuit_cobrador')) {
                $table->dropColumn('cuit_cobrador');
            }
            if (Schema::hasColumn('reclamos', 'importe_solicitado')) {
                $table->dropColumn('importe_solicitado');
            }
            if (Schema::hasColumn('reclamos', 'emisor_factura')) {
                $table->dropColumn('emisor_factura');
            }
            if (Schema::hasColumn('reclamos', 'distribuidor_nombre')) {
                $table->dropColumn('distribuidor_nombre');
            }
            if (Schema::hasColumn('reclamos', 'sucursal_nombre')) {
                $table->dropColumn('sucursal_nombre');
            }
            if (Schema::hasColumn('reclamos', 'cliente_nombre')) {
                $table->dropColumn('cliente_nombre');
            }
        });
    }
};

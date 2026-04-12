<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // liquidacion_distribuidor_id ya es nullable, archivo_id y fuente ya existen,
        // FKs ya creadas — esta migración se ejecutó parcialmente y se completó manualmente.
        if (Schema::hasColumn('liq_ordenes_pago_detalle', 'archivo_id')
            && Schema::hasColumn('liq_ordenes_pago_detalle', 'fuente')) {
            return;
        }

        Schema::table('liq_ordenes_pago_detalle', function (Blueprint $table) {
            $table->unsignedBigInteger('liquidacion_distribuidor_id')->nullable()->change();

            if (!Schema::hasColumn('liq_ordenes_pago_detalle', 'archivo_id')) {
                $table->unsignedBigInteger('archivo_id')->nullable()->after('liquidacion_distribuidor_id');
                $table->foreign('archivo_id')->references('id')->on('archivos')->restrictOnDelete();
                $table->index(['archivo_id']);
            }

            if (!Schema::hasColumn('liq_ordenes_pago_detalle', 'fuente')) {
                $table->enum('fuente', ['EXTRACTO', 'LEGACY'])->default('EXTRACTO')->after('archivo_id');
                $table->index(['fuente']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('liq_ordenes_pago_detalle', function (Blueprint $table) {
            if (Schema::hasColumn('liq_ordenes_pago_detalle', 'archivo_id')) {
                $table->dropForeign(['archivo_id']);
                $table->dropColumn('archivo_id');
            }
            if (Schema::hasColumn('liq_ordenes_pago_detalle', 'fuente')) {
                $table->dropColumn('fuente');
            }
        });
    }
};

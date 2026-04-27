<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC v4.3 · Clasificador de motivo de subpago en reclamos OCASA.
 *
 * Agrega `motivo_categoria` (string corto, filtrable) sin tocar `motivo_detectado`
 * (text largo descriptivo, ya en uso). El detector escribe ambos: categoría para
 * filtros de UI y reporting, descripción para presentar a OCASA.
 *
 * Categorías:
 *   sin_tarifa_contrato       — no hay tarifa cargada
 *   tarifa_capacidad_inferior — OCASA aplicó cap menor a la real
 *   concepto_mal_clasificado  — concepto distancia/idtrack incorrecto
 *   motivo_mal_etiquetado     — productividad: NE marcado como Entregado o viceversa
 *   material_mal_clasificado  — productividad: material distinto al real
 *   zona_mal_asignada         — productividad: zona menor a la real
 *   multibulto_no_aplicado    — productividad: bultos sin multibulto
 *   bajo_tolerancia           — diferencia < 5%, ajuste menor
 *   otra                      — sin causa identificable, revisar manual
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('liq_reclamos_ocasa', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_reclamos_ocasa', 'motivo_categoria')) {
                $table->string('motivo_categoria', 40)->nullable()->default('otra')->after('motivo_detectado');
                $table->index('motivo_categoria', 'idx_reclamos_motivo_categoria');
            }
        });
    }

    public function down(): void
    {
        Schema::table('liq_reclamos_ocasa', function (Blueprint $table) {
            if (Schema::hasColumn('liq_reclamos_ocasa', 'motivo_categoria')) {
                $table->dropIndex('idx_reclamos_motivo_categoria');
                $table->dropColumn('motivo_categoria');
            }
        });
    }
};

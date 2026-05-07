<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM 9 Parte B — categoría de archivo.
 *
 * Slug libre VARCHAR(50) que permite clasificar documentos para:
 *  - validación de adjuntos en La Segunda (foto_frente, cedula_frente, etc.)
 *  - certificados individuales de pólizas (poliza_individual)
 *  - en el futuro: dni_frente, dni_dorso, generico, etc.
 *
 * Slugs reservados (convención de la app, no enforced por ENUM):
 *   foto_frente, foto_lateral_der, foto_lateral_izq, foto_trasera,
 *   cedula_frente, cedula_dorso,
 *   dni_frente, dni_dorso,
 *   poliza_individual,
 *   generico
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            // `nombre_original` ya existe; agregamos `categoria` como campo
            // separado del tipo_archivo_id (que apunta a `file_types`).
            $table->string('categoria', 50)->nullable()->after('nombre_original');
            $table->index('categoria', 'idx_archivos_categoria');
        });
    }

    public function down(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            $table->dropIndex('idx_archivos_categoria');
            $table->dropColumn('categoria');
        });
    }
};

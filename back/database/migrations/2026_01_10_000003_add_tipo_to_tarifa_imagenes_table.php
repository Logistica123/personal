<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tarifa_imagenes', function (Blueprint $table) {
            if (! Schema::hasColumn('tarifa_imagenes', 'tipo')) {
                $table->string('tipo', 32)->nullable()->after('anio');
            }
            $table->index(['cliente_id', 'sucursal_id', 'mes', 'anio', 'tipo'], 'tarifa_imagenes_filtros_tipo_idx');
        });
    }

    public function down(): void
    {
        Schema::table('tarifa_imagenes', function (Blueprint $table) {
            $table->dropIndex('tarifa_imagenes_filtros_tipo_idx');
            if (Schema::hasColumn('tarifa_imagenes', 'tipo')) {
                $table->dropColumn('tipo');
            }
        });
    }
};

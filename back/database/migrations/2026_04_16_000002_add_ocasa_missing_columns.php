<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Fix: columns that were missed due to partial migration failure
        if (!Schema::hasColumn('liq_operaciones', 'fraccion_jornada')) {
            Schema::table('liq_operaciones', function (Blueprint $table) {
                $table->decimal('fraccion_jornada', 5, 4)->default(1.0000)->after('capacidad_vehiculo_kg');
                $table->decimal('tarifa_jornada_distrib', 12, 2)->nullable()->after('fraccion_jornada');
                $table->decimal('tarifa_km_distrib_valor', 12, 2)->nullable()->after('tarifa_jornada_distrib');
                $table->decimal('tarifa_prod_distrib', 12, 2)->nullable()->after('tarifa_km_distrib_valor');
                $table->decimal('importe_gravado', 12, 2)->nullable()->after('tarifa_prod_distrib');
                $table->decimal('importe_no_gravado', 12, 2)->nullable()->after('importe_gravado');
            });
        }
    }

    public function down(): void
    {
        $cols = ['fraccion_jornada', 'tarifa_jornada_distrib', 'tarifa_km_distrib_valor',
            'tarifa_prod_distrib', 'importe_gravado', 'importe_no_gravado'];
        Schema::table('liq_operaciones', function (Blueprint $table) use ($cols) {
            $existing = [];
            foreach ($cols as $col) {
                if (Schema::hasColumn('liq_operaciones', $col)) {
                    $existing[] = $col;
                }
            }
            if (!empty($existing)) {
                $table->dropColumn($existing);
            }
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * BUGFIX 27 Addendum C: persistir monthKey (YYYY-MM) en archivos para poder validar
 * duplicados de liquidaciones legacy por {persona, tipo, monthKey, fortnightKey}.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            if (!Schema::hasColumn('archivos', 'month_key')) {
                $table->string('month_key', 7)->nullable()->after('fortnight_key');
                $table->index(['persona_id', 'tipo_archivo_id', 'month_key', 'fortnight_key'], 'idx_archivos_periodo');
            }
        });
    }

    public function down(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            if (Schema::hasColumn('archivos', 'month_key')) {
                $table->dropIndex('idx_archivos_periodo');
                $table->dropColumn('month_key');
            }
        });
    }
};

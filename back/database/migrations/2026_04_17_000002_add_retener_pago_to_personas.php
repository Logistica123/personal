<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            if (!Schema::hasColumn('personas', 'retener_pago')) {
                $table->boolean('retener_pago')->default(false)->after('fecha_baja');
            }
            if (!Schema::hasColumn('personas', 'retener_pago_motivo')) {
                $table->text('retener_pago_motivo')->nullable()->after('retener_pago');
            }
        });
    }

    public function down(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            if (Schema::hasColumn('personas', 'retener_pago_motivo')) {
                $table->dropColumn('retener_pago_motivo');
            }
            if (Schema::hasColumn('personas', 'retener_pago')) {
                $table->dropColumn('retener_pago');
            }
        });
    }
};

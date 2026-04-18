<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_clientes', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_clientes', 'tolerancia_facturacion')) {
                $table->decimal('tolerancia_facturacion', 10, 2)->default(100.00)->after('configuracion_duplicados')
                    ->comment('Tolerancia absoluta ($) para discrepancias TMS vs PDFs al facturar');
            }
        });
    }

    public function down(): void
    {
        Schema::table('liq_clientes', function (Blueprint $table) {
            if (Schema::hasColumn('liq_clientes', 'tolerancia_facturacion')) {
                $table->dropColumn('tolerancia_facturacion');
            }
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('factura_cabecera', function (Blueprint $table) {
            $table->json('condiciones_venta')->nullable()->after('fecha_vto_pago');
        });
    }

    public function down(): void
    {
        Schema::table('factura_cabecera', function (Blueprint $table) {
            $table->dropColumn('condiciones_venta');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('factura_cabecera', function (Blueprint $table) {
            $table->unsignedBigInteger('estado_cuenta_id')->nullable()->after('periodo_facturado');
        });
    }

    public function down(): void
    {
        Schema::table('factura_cabecera', function (Blueprint $table) {
            $table->dropColumn('estado_cuenta_id');
        });
    }
};

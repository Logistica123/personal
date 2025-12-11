<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('reclamos', function (Blueprint $table) {
            $table->decimal('importe_facturado', 12, 2)->nullable()->after('importe_pagado');
        });
    }

    public function down(): void
    {
        Schema::table('reclamos', function (Blueprint $table) {
            $table->dropColumn('importe_facturado');
        });
    }
};

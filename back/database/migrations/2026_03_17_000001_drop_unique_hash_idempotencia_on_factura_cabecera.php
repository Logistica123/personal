<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('factura_cabecera', function (Blueprint $table) {
            $table->dropUnique('factura_cabecera_hash_idempotencia_unique');
            $table->index('hash_idempotencia', 'factura_cabecera_hash_idempotencia_idx');
        });
    }

    public function down(): void
    {
        Schema::table('factura_cabecera', function (Blueprint $table) {
            $table->dropIndex('factura_cabecera_hash_idempotencia_idx');
            $table->unique('hash_idempotencia', 'factura_cabecera_hash_idempotencia_unique');
        });
    }
};


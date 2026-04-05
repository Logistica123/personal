<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cliente_requerimientos', function (Blueprint $table) {
            if (! Schema::hasColumn('cliente_requerimientos', 'unidad_id')) {
                $table->foreignId('unidad_id')->nullable()->constrained('unidades')->after('sucursal_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('cliente_requerimientos', function (Blueprint $table) {
            if (Schema::hasColumn('cliente_requerimientos', 'unidad_id')) {
                $table->dropConstrainedForeignId('unidad_id');
            }
        });
    }
};


<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sucursals', function (Blueprint $table) {
            if (! Schema::hasColumn('sucursals', 'codigo_corto')) {
                $table->string('codigo_corto', 3)->nullable()->after('nombre');
                $table->index(['cliente_id', 'codigo_corto'], 'sucursals_cliente_codigo_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('sucursals', function (Blueprint $table) {
            if (Schema::hasColumn('sucursals', 'codigo_corto')) {
                $table->dropIndex('sucursals_cliente_codigo_idx');
                $table->dropColumn('codigo_corto');
            }
        });
    }
};


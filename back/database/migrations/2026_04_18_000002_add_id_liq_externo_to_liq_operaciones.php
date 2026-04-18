<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_operaciones', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_operaciones', 'id_liquidacion_cliente_externo')) {
                $table->string('id_liquidacion_cliente_externo', 50)->nullable()->after('id_operacion_cliente');
                $table->index('id_liquidacion_cliente_externo', 'idx_id_liq_cliente_ext');
            }
        });
    }

    public function down(): void
    {
        Schema::table('liq_operaciones', function (Blueprint $table) {
            if (Schema::hasColumn('liq_operaciones', 'id_liquidacion_cliente_externo')) {
                $table->dropIndex('idx_id_liq_cliente_ext');
                $table->dropColumn('id_liquidacion_cliente_externo');
            }
        });
    }
};

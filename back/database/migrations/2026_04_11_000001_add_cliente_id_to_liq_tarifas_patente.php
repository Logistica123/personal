<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Agregar columna nullable
        Schema::table('liq_tarifas_patente', function (Blueprint $table) {
            $table->unsignedBigInteger('liq_cliente_id')->nullable()->after('esquema_id');
        });

        // 2. Asignar registros existentes a OCA (id=6) — verificar ID real
        $ocaId = DB::table('liq_clientes')->where('codigo_corto', 'OCA')->value('id');
        if ($ocaId) {
            DB::table('liq_tarifas_patente')->whereNull('liq_cliente_id')->update(['liq_cliente_id' => $ocaId]);
        }
    }

    public function down(): void
    {
        Schema::table('liq_tarifas_patente', function (Blueprint $table) {
            $table->dropColumn('liq_cliente_id');
        });
    }
};

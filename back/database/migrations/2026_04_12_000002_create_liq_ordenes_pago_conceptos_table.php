<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_ordenes_pago_conceptos')) {
            return;
        }

        Schema::create('liq_ordenes_pago_conceptos', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 100);
            $table->string('codigo', 20)->unique();
            $table->unsignedInteger('ultimo_numero')->default(0);
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });

        // Conceptos precargados
        DB::table('liq_ordenes_pago_conceptos')->insert([
            ['nombre' => 'Gastos',            'codigo' => 'GAS',  'ultimo_numero' => 0, 'activo' => true, 'created_at' => now(), 'updated_at' => now()],
            ['nombre' => 'Pago Proveedores',  'codigo' => 'PROV', 'ultimo_numero' => 0, 'activo' => true, 'created_at' => now(), 'updated_at' => now()],
            ['nombre' => 'Cierres',           'codigo' => 'CIE',  'ultimo_numero' => 0, 'activo' => true, 'created_at' => now(), 'updated_at' => now()],
            ['nombre' => 'Sueldos',           'codigo' => 'SUE',  'ultimo_numero' => 0, 'activo' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_ordenes_pago_conceptos');
    }
};

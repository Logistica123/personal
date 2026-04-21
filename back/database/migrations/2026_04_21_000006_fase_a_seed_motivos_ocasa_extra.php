<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * SPEC INTEGRAL Fase A — ampliar seed de motivos exitosos OCASA.
 *
 * BUGFIX 31 v2 cargó solo Z4. El spec integral agrega Z1/Z8/Z9 (variantes de éxito)
 * + algunos no exitosos comunes (2, 4, 5, 9) para que queden registrados en el ABM.
 */
return new class extends Migration
{
    public function up(): void
    {
        $clientesOcasa = DB::table('liq_clientes')
            ->where(function ($q) {
                $q->where('nombre_corto', 'OCASA')->orWhere('razon_social', 'like', '%OCASA%');
            })
            ->pluck('id');

        $exitosos = [
            'Z1' => 'Entrega con observación',
            'Z8' => 'Entrega variante',
            'Z9' => 'Entrega variante',
        ];

        $noExitosos = [
            '2' => 'No entregado',
            '4' => 'No entregado',
            '5' => 'No entregado - ausente',
            '9' => 'Rechazo',
        ];

        foreach ($clientesOcasa as $clienteId) {
            foreach ($exitosos as $codigo => $desc) {
                DB::table('liq_motivos_exitosos')->updateOrInsert(
                    ['cliente_id' => $clienteId, 'codigo' => $codigo],
                    ['es_exitoso' => true, 'descripcion' => $desc, 'created_at' => now(), 'updated_at' => now()]
                );
            }
            foreach ($noExitosos as $codigo => $desc) {
                DB::table('liq_motivos_exitosos')->updateOrInsert(
                    ['cliente_id' => $clienteId, 'codigo' => $codigo],
                    ['es_exitoso' => false, 'descripcion' => $desc, 'created_at' => now(), 'updated_at' => now()]
                );
            }
        }
    }

    public function down(): void
    {
        // Dejo Z4 (seed original) — solo remuevo lo nuevo
        DB::table('liq_motivos_exitosos')
            ->whereIn('codigo', ['Z1', 'Z8', 'Z9', '2', '4', '5', '9'])
            ->delete();
    }
};

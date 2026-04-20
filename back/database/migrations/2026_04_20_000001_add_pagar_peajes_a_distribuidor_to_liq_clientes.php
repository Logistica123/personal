<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * BUGFIX 25 Feature 25.1: flag por cliente que controla si los peajes
 * (Imp.NoGravado de OCASA / columnas peaje de TMS) se pagan al distribuidor.
 *
 * Default false: el split grav/no_grav queda sólo para facturación LA → cliente.
 * Si algún cliente efectivamente requiere reembolsar peajes al distribuidor
 * (no es el caso de OCASA), se habilita puntualmente con UPDATE.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_clientes', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_clientes', 'pagar_peajes_a_distribuidor')) {
                $table->boolean('pagar_peajes_a_distribuidor')->default(false)->after('tolerancia_facturacion');
            }
        });

        // Estado explícito: ningún cliente paga peajes aparte (BUGFIX 25)
        DB::table('liq_clientes')->update(['pagar_peajes_a_distribuidor' => false]);

        // Limpiar total_reembolso_peajes acumulado por BUGFIX 22 en liquidaciones distribuidor
        // ya generadas — el subtotal del distribuidor se recalcula en la próxima regeneración.
        DB::table('liq_liquidaciones_distribuidor')
            ->where('total_reembolso_peajes', '>', 0)
            ->update(['total_reembolso_peajes' => 0]);

        // Revertir autorizaciones de peajes (dejar marca en motivo para trazabilidad)
        DB::table('liq_operaciones')
            ->where('peaje_autorizado', true)
            ->update([
                'peaje_autorizado'     => false,
                'peaje_monto_ajustado' => null,
                'peaje_motivo'         => DB::raw("CONCAT('[BUGFIX_25 revertido] ', COALESCE(peaje_motivo,''))"),
            ]);
    }

    public function down(): void
    {
        Schema::table('liq_clientes', function (Blueprint $table) {
            if (Schema::hasColumn('liq_clientes', 'pagar_peajes_a_distribuidor')) {
                $table->dropColumn('pagar_peajes_a_distribuidor');
            }
        });
    }
};

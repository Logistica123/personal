<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ArcaFacturacionSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        DB::table('arca_emisor')->updateOrInsert(
            ['cuit' => 30717060985],
            [
                'razon_social' => 'LOGISTICA ARGENTINA S.R.L.',
                'condicion_iva' => 'IVA Responsable Inscripto',
                'ambiente_default' => 'PROD',
                'activo' => true,
                'updated_at' => $now,
                'created_at' => $now,
            ]
        );

        $emisorId = DB::table('arca_emisor')
            ->where('cuit', 30717060985)
            ->value('id');

        if (! $emisorId) {
            return;
        }

        DB::table('arca_punto_venta')->updateOrInsert(
            [
                'emisor_id' => $emisorId,
                'ambiente' => 'PROD',
                'nro' => 11,
            ],
            [
                'sistema_arca' => 'RECE para aplicativo y web services',
                'emision_tipo' => 'RECE',
                'bloqueado' => false,
                'fch_baja' => null,
                'habilitado_para_erp' => true,
                'default_para_cbte_tipo' => 1,
                'updated_at' => $now,
                'created_at' => $now,
            ]
        );
    }
}

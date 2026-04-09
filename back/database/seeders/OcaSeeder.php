<?php

namespace Database\Seeders;

use App\Models\LiqCliente;
use App\Models\LiqConfiguracionGastos;
use App\Models\LiqEsquemaTarifario;
use Illuminate\Database\Seeder;

class OcaSeeder extends Seeder
{
    public function run(): void
    {
        $cliente = LiqCliente::query()->updateOrCreate(
            ['nombre_corto' => 'OCA'],
            [
                'razon_social' => 'OCA S.A.',
                'codigo_corto' => 'OCA',
                'cuit' => null,
                'activo' => true,
                'configuracion_excel' => [
                    'formato_entrada' => 'PDF_DUAL',
                    'paradigma_tarifario' => 'INDIVIDUAL_PATENTE',
                    'motor_vinculacion' => 'SUBSET_SUM_BACKTRACKING',
                    'periodo_tipo' => 'MENSUAL',
                    'formato_pdf_distrib' => 'AUTO_DETECT',
                    'soporta_horas' => true,
                    'matching_strategy' => 'patente',
                    'codigos_contrato' => [
                        170, 171, 152, 181, 183, 186, 187, 190, 192, 195, 198, 199,
                    ],
                    'sucursales' => [
                        ['codigo' => 'FLV', 'nombre' => 'Florencio Varela', 'modelo' => 'ULTIMA_MILLA_PAQUETE', 'formato_distrib' => 'INDIVIDUAL'],
                        ['codigo' => 'GUILLON', 'nombre' => 'Luis Guillon', 'modelo' => 'ULTIMA_MILLA_PAQUETE', 'formato_distrib' => 'INDIVIDUAL'],
                        ['codigo' => 'PQC', 'nombre' => 'Paqueteria Capital', 'modelo' => 'ULTIMA_MILLA_PAQUETE', 'formato_distrib' => 'INDIVIDUAL'],
                        ['codigo' => 'PQO', 'nombre' => 'Paqueteria Oeste', 'modelo' => 'ULTIMA_MILLA_PAQUETE', 'formato_distrib' => 'COMBINADO'],
                        ['codigo' => 'PQN', 'nombre' => 'Paqueteria Norte', 'modelo' => 'CHASIS_JORNADA', 'formato_distrib' => 'INDIVIDUAL'],
                        ['codigo' => 'NWS', 'nombre' => 'Newsan', 'modelo' => 'CHASIS_JORNADA', 'formato_distrib' => 'INDIVIDUAL'],
                        ['codigo' => 'TRF', 'nombre' => 'Trafico', 'modelo' => 'CHASIS_JORNADA', 'formato_distrib' => 'INDIVIDUAL'],
                        ['codigo' => 'SAL', 'nombre' => 'Salta', 'modelo' => 'INTERIOR_PAQUETE_KM', 'formato_distrib' => 'INDIVIDUAL'],
                        ['codigo' => 'TUC', 'nombre' => 'Tucuman', 'modelo' => 'INTERIOR_PAQUETE_KM_HORAS', 'formato_distrib' => 'INDIVIDUAL'],
                    ],
                ],
            ]
        );

        LiqEsquemaTarifario::query()->firstOrCreate(
            ['cliente_id' => $cliente->id, 'nombre' => 'Tarifa OCA 2026'],
            [
                'descripcion' => 'Tarifa OCA individual por patente (dimensiones sucursal + contrato).',
                'dimensiones' => ['sucursal', 'contrato'],
                'activo' => true,
            ]
        );

        LiqConfiguracionGastos::query()->firstOrCreate(
            [
                'cliente_id' => $cliente->id,
                'concepto_gasto' => 'Gastos administrativos',
                'vigencia_desde' => '2026-01-01',
            ],
            [
                'monto' => 4020,
                'tipo' => 'fijo',
                'vigencia_hasta' => null,
                'activo' => true,
            ]
        );
    }
}

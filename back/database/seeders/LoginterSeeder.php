<?php

namespace Database\Seeders;

use App\Models\LiqCliente;
use App\Models\LiqConfiguracionGastos;
use App\Models\LiqEsquemaTarifario;
use Illuminate\Database\Seeder;

class LoginterSeeder extends Seeder
{
    public function run(): void
    {
        $cliente = LiqCliente::query()->updateOrCreate(
            ['nombre_corto' => 'Loginter'],
            [
                'razon_social' => 'Loginter S.A.',
                'codigo_corto' => 'LOG',
                'cuit' => '30-70977759-4',
                'activo' => true,
                'configuracion_excel' => [
                    'formato_entrada' => 'EXCEL',
                    'sheet_name' => 'Detalle',
                    'archivos_requeridos' => ['DATA_CLIENTE'],
                ],
            ]
        );

        LiqEsquemaTarifario::query()->firstOrCreate(
            ['cliente_id' => $cliente->id, 'nombre' => 'Tarifa Loginter 2026'],
            [
                'descripcion' => 'Tarifa base Loginter (dimensiones sucursal + concepto).',
                'dimensiones' => ['sucursal', 'concepto'],
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
                'monto' => 2010,
                'tipo' => 'fijo',
                'vigencia_hasta' => null,
                'activo' => true,
            ]
        );
    }
}


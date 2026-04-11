<?php

namespace Database\Seeders;

use App\Models\LiqCliente;
use App\Models\LiqDimensionValor;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqMapeoSucursal;
use Illuminate\Database\Seeder;

/**
 * Configura Loginter para el flujo automatizado de Excel.
 * No toca el esquema existente "Tarifa Loginter 2026" ni sus 72 líneas.
 */
class LoginterConfigSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Fix nombre_corto si está mal
        $cliente = LiqCliente::find(1);
        if (!$cliente) {
            $this->command->error('LiqCliente id=1 no existe');
            return;
        }

        $cliente->update([
            'nombre_corto' => 'Loginter',
            'razon_social' => 'Loginter S.A.',
            'codigo_corto' => 'LOG',
            'distriapp_cliente_id' => 3,
            'configuracion_excel' => [
                'formato_entrada' => 'EXCEL',
                'hoja' => 'Detalle',
                'fila_datos' => 1,
                'periodo_tipo' => 'QUINCENAL',
                'matching_distribuidor' => 'patente',
                'campo_sucursal_origen' => 'origen',
                'fila_total_skip' => ['columna' => 'id_liquidacion', 'valor' => 'TOTAL'],
                'mapeo_columnas' => [
                    'id_viaje' => 1,
                    'categoria_viaje' => 2,
                    'origen' => 3,
                    'fecha' => 5,
                    'nombre' => 7,
                    'patente' => 8,
                    'categoria_vehiculo' => 9,
                    'vuelta' => 11,
                    'concepto' => 15,
                    'valor' => 16,
                ],
                'conceptos_valor_variable' => ['Valor Viaje', 'Adicional Km Extra'],
            ],
        ]);

        $this->command->info("LiqCliente id=1 actualizado: nombre_corto=Loginter, configuracion_excel cargada");

        // 2. Crear esquema nuevo para flujo Excel (no tocar el existente)
        $esquema = LiqEsquemaTarifario::query()->firstOrCreate(
            ['cliente_id' => $cliente->id, 'nombre' => 'Loginter Excel 2026'],
            [
                'descripcion' => 'Tarifa Loginter automatizada desde Excel. Dimensiones: concepto + vuelta.',
                'dimensiones' => ['sucursal', 'concepto'],
                'activo' => false, // No activar por defecto, el usuario decide cuál usar
            ]
        );

        $this->command->info("Esquema '{$esquema->nombre}' creado (id={$esquema->id}). Activar manualmente si se desea usar.");

        // 3. Cargar mapeos de sucursal Origen→Código (si no existen)
        $mapeos = [
            ['Ultima Milla Córdoba', 'CDO', 'Córdoba'],
            ['Ultima Milla Córdoba 2', 'CDO', 'Córdoba (op. 2)'],
            ['Ultima Milla Neuquén', 'NEU', 'Neuquén'],
            ['Ultima Milla Resistencia', 'RES', 'Resistencia (Chaco)'],
            ['Ultima Milla Tres Arroyos', '3AR', 'Tres Arroyos'],
            ['Cad MercadoLibre Rosario', 'RSO', 'Rosario'],
            ['CadMercadolibre', 'CTA', 'Catamarca'],
            ['CD OCASA', 'CTA', 'CD OCASA (CTA)'],
            ['Ultima Milla Concepción del Uruguay', 'CDU', 'C. del Uruguay'],
            ['Ultima Milla Tucumán', 'TUC', 'Tucumán'],
        ];

        $creados = 0;
        foreach ($mapeos as [$patron, $sucursal, $nombre]) {
            $exists = LiqMapeoSucursal::where('cliente_id', $cliente->id)
                ->where('patron_archivo', $patron)
                ->exists();
            if (!$exists) {
                LiqMapeoSucursal::create([
                    'cliente_id' => $cliente->id,
                    'patron_archivo' => $patron,
                    'sucursal_tarifa' => $sucursal,
                    'activo' => true,
                ]);
                $creados++;
            }
        }

        $this->command->info("Mapeos sucursal Loginter: {$creados} nuevos creados (de " . count($mapeos) . " totales).");
    }
}

<?php

namespace Database\Seeders;

use App\Models\LiqCliente;
use App\Models\LiqConfiguracionGastos;
use App\Models\LiqDimensionValor;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqLineaTarifa;
use App\Models\LiqMapeoConcepto;
use App\Models\LiqMapeoSucursal;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LoginterSeeder extends Seeder
{
    public function run(): void
    {
        // ─── Cliente ─────────────────────────────────────────────────────────
        $cliente = LiqCliente::firstOrCreate(
            ['nombre_corto' => 'Loginter'],
            [
                'razon_social' => 'Loginter S.A.',
                'cuit'         => '30-70977759-4',
                'activo'       => true,
            ]
        );

        // ─── Esquema tarifario ────────────────────────────────────────────────
        $esquema = LiqEsquemaTarifario::firstOrCreate(
            ['cliente_id' => $cliente->id, 'nombre' => 'Tarifa Loginter 2026'],
            [
                'descripcion' => 'Tarifas 2026 Loginter. Dimensiones: sucursal y concepto.',
                'dimensiones'  => ['sucursal', 'concepto'],
                'activo'       => true,
            ]
        );

        // Limpiamos dimensiones y líneas anteriores para cargar datos reales frescos
        DB::table('liq_lineas_tarifa')->where('esquema_id', $esquema->id)->delete();
        DB::table('liq_dimension_valores')->where('esquema_id', $esquema->id)->delete();

        // ─── Dimensión: sucursal ──────────────────────────────────────────────
        // Nota: en Loginter "sucursal" no es solo geografía, también es categoría vehicular.
        $sucursales = [
            'AMBA',
            'MDQ',
            'Rosario',
            'Santa Fe',
            'Neuquen',
            'Bariloche',
            'Cordoba',
            'Alsina Munro',
            'CHASIS 8 a 10 pallets',
            'CHASIS 12 pallets',
            'CHASIS liviano 6 pallets',
            'CAMIONETAS',
        ];

        foreach ($sucursales as $orden => $valor) {
            $this->dimensionValor($esquema->id, 'sucursal', $valor, $orden);
        }

        // ─── Dimensión: concepto ──────────────────────────────────────────────
        $conceptos = [
            'Ut. Corto AM',
            'Ut. Corto PM',
            'Ut. Corto',
            'Ut. Mediano',
            'Ut. Mediano AM',
            'Ut. Largo',
            'Ut. Largo AM/PM',
            'Ut. Largo NEW',
            'Ut. Largo 2015-2018 AM',
            'Ut. Largo +2019 AM',
            'Chasis',
            'Chasis AM',
            'Extra +100km',
            'Vehiculos modelos >= 2019',
            'General',
            'AMBA',
        ];

        foreach ($conceptos as $orden => $valor) {
            $this->dimensionValor($esquema->id, 'concepto', $valor, $orden);
        }

        // ─── Líneas de tarifa ─────────────────────────────────────────────────
        // Formato: [sucursal, concepto, precio_original, pct_agencia, precio_distribuidor_exacto]
        // precio_distribuidor_exacto = valor de la tabla (puede no coincidir exactamente con fórmula)
        //
        // ADVERTENCIA: CAMIONETAS fila 1 → distribuidor ($260.000) > original ($175.000)
        //   Parece un error en la fuente. Se carga tal cual hasta confirmar con Loginter.
        //
        // Las filas sin precio (MDQ Ut.Corto/Largo, Santa Fe, Neuquen, Bariloche) no generan
        // línea activa; sus valores de dimensión quedan disponibles para carga manual futura.

        $adminId = \App\Models\User::orderBy('id')->value('id');

        $lineas = [
            // ── AMBA ──────────────────────────────────────────────────────────
            ['AMBA', 'Ut. Corto AM',  100_000.00, 10, 90_000.00],
            ['AMBA', 'Ut. Corto PM',   74_300.00, 10, 66_870.00],
            ['AMBA', 'Ut. Mediano',   170_000.00, 10, 153_000.00],
            ['AMBA', 'Ut. Largo',     200_000.00, 10, 180_000.00],
            ['AMBA', 'Ut. Largo NEW', 220_000.00, 10, 198_000.00],
            ['AMBA', 'Chasis',        200_000.00, 10, 180_000.00],

            // ── Rosario ───────────────────────────────────────────────────────
            ['Rosario', 'Ut. Corto',       89_200.00, 10, 80_280.00],
            ['Rosario', 'Ut. Mediano',    137_000.00, 10, 123_300.00],
            ['Rosario', 'Ut. Largo NEW',  200_000.00, 10, 180_000.00],
            ['Rosario', 'Chasis',         235_000.00, 10, 211_500.00],

            // ── Cordoba ───────────────────────────────────────────────────────
            ['Cordoba', 'Ut. Corto',      79_600.00, 10,  71_640.00],
            ['Cordoba', 'Ut. Mediano',   180_500.00, 10, 162_450.00],
            // Extra +100km: porcentaje implícito ≈21.4% (valor dado literalmente)
            ['Cordoba', 'Extra +100km',   21_000.00,  0,  16_500.00],

            // ── Alsina Munro ──────────────────────────────────────────────────
            ['Alsina Munro', 'Ut. Corto AM',         100_000.00, 15,  85_000.00],
            ['Alsina Munro', 'Ut. Mediano AM',        170_000.00, 15, 144_500.00],
            ['Alsina Munro', 'Ut. Largo 2015-2018 AM',200_000.00, 15, 170_000.00],
            ['Alsina Munro', 'Ut. Largo +2019 AM',    220_000.00, 15, 187_000.00],
            ['Alsina Munro', 'Chasis AM',             260_000.00, 15, 221_000.00],
            // Ut. Corto PM: porcentaje en blanco en la fuente, coincide con 10%
            ['Alsina Munro', 'Ut. Corto PM',           74_300.00, 10,  66_870.00],

            // ── CHASIS 8 a 10 pallets ─────────────────────────────────────────
            // Dos variantes de precio para "Vehiculos modelos >= 2019".
            // La segunda no coincide exactamente con fórmula (220000*0.91=200200, tabla=200000).
            ['CHASIS 8 a 10 pallets', 'Vehiculos modelos >= 2019', 250_000.00, 8, 230_000.00],
            ['CHASIS 8 a 10 pallets', 'Vehiculos modelos >= 2019', 220_000.00, 9, 200_000.00],

            // ── CHASIS 12 pallets ─────────────────────────────────────────────
            // 275000*0.91=250250, tabla=250000 (diferencia por redondeo).
            ['CHASIS 12 pallets', 'General', 275_000.00, 9, 250_000.00],

            // ── CHASIS liviano 6 pallets ──────────────────────────────────────
            // 190000*0.93=176700, tabla=175000 (diferencia por redondeo).
            ['CHASIS liviano 6 pallets', 'AMBA', 190_000.00, 7, 175_000.00],

            // ── CAMIONETAS ────────────────────────────────────────────────────
            // ADVERTENCIA fila 1: precio_distribuidor ($260.000) > precio_original ($175.000).
            //   Verificar con Loginter si los valores están invertidos o es otro error.
            ['CAMIONETAS', 'Vehiculos modelos >= 2019', 175_000.00, 8, 260_000.00],
            ['CAMIONETAS', 'Vehiculos modelos >= 2019', 160_000.00, 9, 145_000.00],
        ];

        foreach ($lineas as [$sucursal, $concepto, $precioOriginal, $pctAgencia, $precioDist]) {
            LiqLineaTarifa::create([
                'esquema_id'          => $esquema->id,
                'dimensiones_valores' => ['sucursal' => $sucursal, 'concepto' => $concepto],
                'precio_original'     => $precioOriginal,
                'porcentaje_agencia'  => $pctAgencia,
                'precio_distribuidor' => $precioDist,
                'vigencia_desde'      => '2026-01-01',
                'vigencia_hasta'      => null,
                'creado_por'          => $adminId,
                'aprobado_por'        => $adminId,
                'fecha_aprobacion'    => now(),
                'activo'              => true,
            ]);
        }

        // ─── Mapeos de concepto ───────────────────────────────────────────────
        // valor_excel → dimension_destino → valor_tarifa
        // Actualiza si ya existe, inserta si es nuevo.
        $mapeosConcepto = [
            ['Rango 0-50 Km',    'concepto', 'Ut. Corto AM'],
            ['Rango 50-100 Km',  'concepto', 'Ut. Corto PM'],
            ['Rango 100-150 Km', 'concepto', 'Ut. Mediano'],
            ['Rango 150-200 Km', 'concepto', 'Ut. Largo'],
            ['Rango 200+ Km',    'concepto', 'Ut. Largo NEW'],
            ['Valor Viaje',      'concepto', 'Ut. Corto AM'],
            ['COLECTA',          'concepto', 'Ut. Corto AM'],
            ['ULTIMA MILLA',     'concepto', 'Ut. Mediano'],
            ['UM',               'concepto', 'Ut. Mediano'],
            ['8-10 PALLETS',     'concepto', 'Vehiculos modelos >= 2019'],
            ['12 PALLETS',       'concepto', 'General'],
            ['LIVIANO 6P',       'concepto', 'AMBA'],
            ['CAMIONETA',        'concepto', 'Vehiculos modelos >= 2019'],
            ['EXTRA KM',         'concepto', 'Extra +100km'],
        ];

        foreach ($mapeosConcepto as [$valorExcel, $dimensionDestino, $valorTarifa]) {
            LiqMapeoConcepto::updateOrCreate(
                [
                    'cliente_id'        => $cliente->id,
                    'valor_excel'       => $valorExcel,
                    'dimension_destino' => $dimensionDestino,
                ],
                [
                    'valor_tarifa' => $valorTarifa,
                    'activo'       => true,
                ]
            );
        }

        // ─── Mapeos de sucursal ───────────────────────────────────────────────
        // patron_archivo → sucursal_tarifa (valor de dimensión 'sucursal')
        $mapeosSucursal = [
            ['AMBA COLECTA',    'AMBA',                    'colecta'],
            ['AMBA UM',         'AMBA',                    'ultima_milla'],
            ['AMBA',            'AMBA',                    null],
            ['NEUQUEN',         'Neuquen',                 'ultima_milla'],
            ['RESISTENCIA UM',  'Cordoba',                 'ultima_milla'],
            ['TUCUMAN UM',      'Cordoba',                 'ultima_milla'],
            ['ROSARIO COLECTA', 'Rosario',                 'colecta'],
            ['ROSARIO UM',      'Rosario',                 'ultima_milla'],
            ['ROSARIO',         'Rosario',                 null],
            ['SANTA FE',        'Santa Fe',                null],
            ['CORDOBA',         'Cordoba',                 null],
            ['MDQ',             'MDQ',                     null],
            ['MAR DEL PLATA',   'MDQ',                     null],
            ['BARILOCHE',       'Bariloche',               null],
            ['ALSINA',          'Alsina Munro',            null],
            ['MUNRO',           'Alsina Munro',            null],
            ['CHASIS 8',        'CHASIS 8 a 10 pallets',   null],
            ['CHASIS 12',       'CHASIS 12 pallets',       null],
            ['CHASIS LIVIANO',  'CHASIS liviano 6 pallets',null],
            ['CHASIS',          'CHASIS 8 a 10 pallets',   null],  // fallback genérico
            ['CAMIONETAS',      'CAMIONETAS',              null],
        ];

        foreach ($mapeosSucursal as [$patron, $sucursalTarifa, $tipoOperacion]) {
            LiqMapeoSucursal::updateOrCreate(
                [
                    'cliente_id'     => $cliente->id,
                    'patron_archivo' => $patron,
                ],
                [
                    'sucursal_tarifa' => $sucursalTarifa,
                    'tipo_operacion'  => $tipoOperacion,
                    'activo'          => true,
                ]
            );
        }

        // ─── Gastos administrativos ───────────────────────────────────────────
        LiqConfiguracionGastos::firstOrCreate(
            [
                'cliente_id'     => $cliente->id,
                'concepto_gasto' => 'Gastos Administrativos',
                'vigencia_desde' => '2026-01-01',
            ],
            [
                'monto'          => 2010.00,
                'tipo'           => 'fijo',
                'vigencia_hasta' => null,
                'activo'         => true,
            ]
        );

        $totalLineas    = LiqLineaTarifa::where('esquema_id', $esquema->id)->count();
        $totalConceptos = LiqMapeoConcepto::where('cliente_id', $cliente->id)->count();
        $totalSucursal  = LiqMapeoSucursal::where('cliente_id', $cliente->id)->count();

        $this->command->info("Loginter seeder OK — cliente ID {$cliente->id}, esquema ID {$esquema->id}");
        $this->command->info("  Líneas de tarifa : {$totalLineas}");
        $this->command->info("  Mapeos concepto  : {$totalConceptos}");
        $this->command->info("  Mapeos sucursal  : {$totalSucursal}");
        $this->command->warn('  ⚠  CAMIONETAS fila 1: precio_distribuidor ($260.000) > precio_original ($175.000) — verificar con Loginter.');
        $this->command->warn('  ⚠  Cordoba Extra +100km: porcentaje_agencia guardado como 0 (valor distribuidor exacto = $16.500).');
        $this->command->warn('  ⚠  MDQ, Santa Fe, Neuquen, Bariloche: dimensiones cargadas sin precio (pendientes de tarifa).');
    }

    private function dimensionValor(int $esquemaId, string $dimension, string $valor, int $orden): void
    {
        LiqDimensionValor::updateOrCreate(
            [
                'esquema_id'       => $esquemaId,
                'nombre_dimension' => $dimension,
                'valor'            => $valor,
            ],
            [
                'orden_display' => $orden,
                'activo'        => true,
            ]
        );
    }
}

<?php

namespace App\Console\Commands;

use App\Models\LiqCliente;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqLineaTarifa;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * BUGFIX 31 v2 — Carga el esquema OCASA v5 directamente desde datos hardcodeados
 * del Excel "OCASA_Tarifas_v5_DEFINITIVO" que Matías entregó el 21/04/2026.
 *
 *   php artisan liq:seed-ocasa-v5 [--reemplazar]
 *
 * Flags:
 *   --reemplazar  → desactiva esquemas OCASA previos y crea uno nuevo como activo
 */
class SeedOcasaV5 extends Command
{
    protected $signature = 'liq:seed-ocasa-v5 {--reemplazar : Desactivar esquemas OCASA anteriores antes de cargar}';
    protected $description = 'BUGFIX 31 v2: carga el esquema OCASA v5 con tarifas BASE + OVERRIDES (datos hardcodeados del Excel).';

    public function handle(): int
    {
        $cliente = LiqCliente::where('nombre_corto', 'OCASA')
            ->orWhere('razon_social', 'like', '%OCASA%')
            ->first();
        if (!$cliente) {
            $this->error('Cliente OCASA no existe en liq_clientes.');
            return 1;
        }
        $this->info("Cliente OCASA #{$cliente->id}");

        $base = $this->datosBase();
        $overrides = $this->datosOverrides();
        $this->info(count($base) . ' tarifas BASE, ' . count($overrides) . ' OVERRIDES a cargar');

        DB::beginTransaction();
        try {
            if ($this->option('reemplazar')) {
                $n = LiqEsquemaTarifario::where('cliente_id', $cliente->id)->update(['activo' => false]);
                $this->warn("Desactivados {$n} esquemas OCASA previos");
            }

            $esquema = LiqEsquemaTarifario::create([
                'cliente_id' => $cliente->id,
                'nombre' => 'OCASA v5 · Marzo 2026',
                'descripcion' => 'Esquema unificado con fórmula costo_fijo × frac + factor_km × CostoKm_TMS + …',
                'dimensiones' => ['ruta', 'capacidad_vehiculo'],
                'activo' => true,
            ]);
            $this->info("Esquema creado #{$esquema->id}");

            $creadas = 0;
            foreach ($base as $row) {
                LiqLineaTarifa::create(array_merge($this->baseAttrs($esquema), $row, ['es_tarifa_base' => true]));
                $creadas++;
            }
            foreach ($overrides as $row) {
                LiqLineaTarifa::create(array_merge($this->baseAttrs($esquema), $row, ['es_tarifa_base' => false]));
                $creadas++;
            }

            DB::commit();
            $this->info("✓ {$creadas} líneas insertadas");
            return 0;
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error('Error: ' . $e->getMessage());
            return 1;
        }
    }

    private function baseAttrs(LiqEsquemaTarifario $esquema): array
    {
        return [
            'esquema_id' => $esquema->id,
            'activo' => true,
            'vigencia_desde' => '2026-03-01',
            'precio_original' => 0,
            'precio_distribuidor' => 0,
            'porcentaje_agencia' => 0,
            'dimensiones_valores' => json_encode(new \stdClass),
        ];
    }

    /**
     * Tarifas BASE (es_tarifa_base=1) — aplican por default a toda la ruta+capacidad.
     */
    private function datosBase(): array
    {
        return [
            ['ruta_codigo' => 'BHI006', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 131251.00, 'factor_km' => null,   'n_ops_observadas' => 1],
            ['ruta_codigo' => 'BHI103', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM',    'costo_fijo_base' => 107813.33, 'factor_km' => 0.85,   'n_ops_observadas' => 15],
            ['ruta_codigo' => 'CBNR01', 'capacidad_vehiculo_kg' => 2500, 'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 164660.37, 'factor_km' => null,   'n_ops_observadas' => 1],
            ['ruta_codigo' => 'CBNT01', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 105851.58, 'factor_km' => null,   'n_ops_observadas' => 22],
            ['ruta_codigo' => 'CBNT01', 'capacidad_vehiculo_kg' => 2500, 'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 163215.98, 'factor_km' => null,   'n_ops_observadas' => 19],
            ['ruta_codigo' => 'COR060', 'capacidad_vehiculo_kg' => 5000, 'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 0.00,      'factor_km' => null,   'n_ops_observadas' => 1,  'observaciones_v5' => 'Requiere override — tarifa no definida'],
            ['ruta_codigo' => 'COR225', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 86953.81,  'factor_km' => null,   'n_ops_observadas' => 20],
            ['ruta_codigo' => 'COR301', 'capacidad_vehiculo_kg' => 2500, 'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 130511.17, 'factor_km' => null,   'n_ops_observadas' => 18],
            ['ruta_codigo' => 'FMA110', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 71277.32,  'factor_km' => null,   'n_ops_observadas' => 2],
            ['ruta_codigo' => 'FMA120', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM',    'costo_fijo_base' => 103229.24, 'factor_km' => 0.85,   'n_ops_observadas' => 29],
            ['ruta_codigo' => 'FMA999', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 71277.32,  'factor_km' => null,   'n_ops_observadas' => 1],
            ['ruta_codigo' => 'LUQ210', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 98908.94,  'factor_km' => null,   'n_ops_observadas' => 21],
            ['ruta_codigo' => 'LVI009', 'capacidad_vehiculo_kg' => 2500, 'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 130511.17, 'factor_km' => null,   'n_ops_observadas' => 1],
            ['ruta_codigo' => 'MDZ02A', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 86545.33,  'factor_km' => null,   'n_ops_observadas' => 8],
            ['ruta_codigo' => 'PAR300', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM',    'costo_fijo_base' => 141474.71, 'factor_km' => 0.85,   'n_ops_observadas' => 33],
            ['ruta_codigo' => 'PSS200', 'capacidad_vehiculo_kg' => 2500, 'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 135423.18, 'factor_km' => null,   'n_ops_observadas' => 5],
            ['ruta_codigo' => 'PSS204', 'capacidad_vehiculo_kg' => 2500, 'modelo_tarifa' => 'JORNADA_KM',    'costo_fijo_base' => 135423.18, 'factor_km' => 0.85,   'n_ops_observadas' => 2],
            ['ruta_codigo' => 'PSS204', 'capacidad_vehiculo_kg' => 5000, 'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 180692.69, 'factor_km' => null,   'n_ops_observadas' => 1],
            ['ruta_codigo' => 'PSS206', 'capacidad_vehiculo_kg' => 7500, 'modelo_tarifa' => 'JORNADA_KM',    'costo_fijo_base' => 180692.69, 'factor_km' => 0.85,   'n_ops_observadas' => 7],
            ['ruta_codigo' => 'PSS600', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM',    'costo_fijo_base' => 97522.88,  'factor_km' => 0.85,   'n_ops_observadas' => 129],
            ['ruta_codigo' => 'RCU007', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 87305.38,  'factor_km' => null,   'n_ops_observadas' => 56],
            ['ruta_codigo' => 'RES005', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM',    'costo_fijo_base' => 142554.68, 'factor_km' => 0.85,   'n_ops_observadas' => 20],
            ['ruta_codigo' => 'RES020', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 71277.33,  'factor_km' => null,   'n_ops_observadas' => 3],
            ['ruta_codigo' => 'RES056', 'capacidad_vehiculo_kg' => 3500, 'modelo_tarifa' => 'JORNADA_KM',    'costo_fijo_base' => 98945.55,  'factor_km' => 0.85,   'n_ops_observadas' => 5],
            ['ruta_codigo' => 'RES065', 'capacidad_vehiculo_kg' => 100,  'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 49784.75,  'factor_km' => null,   'n_ops_observadas' => 101],
            ['ruta_codigo' => 'RES080', 'capacidad_vehiculo_kg' => 10000,'modelo_tarifa' => 'JORNADA_KM',    'costo_fijo_base' => 175046.05, 'factor_km' => 0.85,   'n_ops_observadas' => 16],
            ['ruta_codigo' => 'ROHS07', 'capacidad_vehiculo_kg' => 5000, 'modelo_tarifa' => 'JORNADA_KM',    'costo_fijo_base' => 269933.80, 'factor_km' => 0.85,   'n_ops_observadas' => 20],
            ['ruta_codigo' => 'ROHS07', 'capacidad_vehiculo_kg' => 12000,'modelo_tarifa' => 'JORNADA_KM',    'costo_fijo_base' => 269933.80, 'factor_km' => 0.85,   'n_ops_observadas' => 13],
            ['ruta_codigo' => 'ROHS16', 'capacidad_vehiculo_kg' => 12000,'modelo_tarifa' => 'JORNADA_KM',    'costo_fijo_base' => 269933.80, 'factor_km' => 0.85,   'n_ops_observadas' => 3],
            ['ruta_codigo' => 'ROS001', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'PRODUCTIVIDAD', 'costo_fijo_base' => 0.00,      'factor_prod_distrib' => 0.85, 'n_ops_observadas' => 48],
            ['ruta_codigo' => 'RSA600', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 131251.02, 'factor_km' => null,   'n_ops_observadas' => 22],
            ['ruta_codigo' => 'STP001', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',       'costo_fijo_base' => 142554.67, 'factor_km' => null,   'n_ops_observadas' => 2],
            ['ruta_codigo' => 'SUR001', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'PRODUCTIVIDAD', 'costo_fijo_base' => 0.00,      'factor_prod_distrib' => 0.85, 'n_ops_observadas' => 4],
            ['ruta_codigo' => 'TRC043', 'capacidad_vehiculo_kg' => 10000,'modelo_tarifa' => 'JORNADA_KM',    'costo_fijo_base' => 180692.70, 'factor_km' => 0.85,   'n_ops_observadas' => 5],
            ['ruta_codigo' => 'ZUL002', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM',    'costo_fijo_base' => 131251.02, 'factor_km' => 0.85,   'n_ops_observadas' => 1],
            ['ruta_codigo' => 'ZUL010', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM',    'costo_fijo_base' => 82031.89,  'factor_km' => null,   'n_ops_observadas' => 2],
            ['ruta_codigo' => 'ZUL050', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM',    'costo_fijo_base' => 112793.84, 'factor_km' => 0.85,   'n_ops_observadas' => 16],
        ];
    }

    /**
     * OVERRIDES (es_tarifa_base=0) — aplicación específica por distribuidor_nombre o patente.
     */
    private function datosOverrides(): array
    {
        return [
            ['ruta_codigo' => 'CBNR01', 'capacidad_vehiculo_kg' => 2500, 'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Ariel Caceres',                'patente_match' => 'OQS348',  'costo_fijo_base' => 170471.88, 'n_ops_observadas' => 1],
            ['ruta_codigo' => 'CBNT01', 'capacidad_vehiculo_kg' => 2500, 'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Ariel Caceres',                'patente_match' => 'OQS348',  'costo_fijo_base' => 168976.51, 'n_ops_observadas' => 19],
            ['ruta_codigo' => 'COR225', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Rosana Patricia Quinteros',   'patente_match' => 'AH470MV', 'costo_fijo_base' => 89063.19,  'n_ops_observadas' => 20],
            ['ruta_codigo' => 'COR301', 'capacidad_vehiculo_kg' => 2500, 'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Walter Marcelo Montenegro',   'patente_match' => 'DTC856',  'costo_fijo_base' => 131251.01, 'n_ops_observadas' => 18],
            ['ruta_codigo' => 'FMA110', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Medina Dniel German',         'patente_match' => 'AA393PO', 'costo_fijo_base' => 72954.43,  'n_ops_observadas' => 2],
            ['ruta_codigo' => 'FMA120', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'Medina Dniel German',         'patente_match' => 'AA393PO', 'costo_fijo_base' => 77245.87,  'factor_km' => 0.87,   'n_ops_observadas' => 17],
            ['ruta_codigo' => 'FMA120', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'Sergio Abraham Pinto',        'patente_match' => 'AC422DS', 'costo_fijo_base' => 142554.67, 'factor_km' => 0.85,   'n_ops_observadas' => 12],
            ['ruta_codigo' => 'FMA999', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Medina Dniel German',         'patente_match' => 'AA393PO', 'costo_fijo_base' => 72954.43,  'n_ops_observadas' => 1],
            ['ruta_codigo' => 'PAR300', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'RUEFLI JOSE',                 'patente_match' => 'AB929ZU', 'costo_fijo_base' => 139813.23, 'factor_km' => 0.85,   'n_ops_observadas' => 13],
            ['ruta_codigo' => 'PAR300', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'VARISCO JORGE',               'patente_match' => 'NIY497',  'costo_fijo_base' => 142554.67, 'factor_km' => 0.8502, 'n_ops_observadas' => 20],
            ['ruta_codigo' => 'PSS200', 'capacidad_vehiculo_kg' => 2500, 'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Tilleria Sergio Andres',      'patente_match' => 'CZN020',  'costo_fijo_base' => 135423.17, 'n_ops_observadas' => 5],
            ['ruta_codigo' => 'PSS204', 'capacidad_vehiculo_kg' => 2500, 'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'Tilleria Sergio Andres',      'patente_match' => 'CZN020',  'costo_fijo_base' => 135423.17, 'factor_km' => 0.85,   'n_ops_observadas' => 2],
            ['ruta_codigo' => 'PSS204', 'capacidad_vehiculo_kg' => 5000, 'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Ruben Oscar Gonzalez',        'patente_match' => 'AB505OL', 'costo_fijo_base' => 172087.60, 'n_ops_observadas' => 1],
            ['ruta_codigo' => 'PSS206', 'capacidad_vehiculo_kg' => 7500, 'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'Walter Alejandro Wahnish',    'patente_match' => 'PAL831',  'costo_fijo_base' => 172087.60, 'factor_km' => 0.8147, 'n_ops_observadas' => 7],
            ['ruta_codigo' => 'PSS600', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'PSS_SainzJavier_MAR26',       'patente_match' => 'AA552CT', 'costo_fijo_base' => 118795.55, 'factor_km' => 0.85,   'n_ops_observadas' => 7],
            ['ruta_codigo' => 'PSS600', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'PSS_SainzJavier_MAR26',       'patente_match' => 'AB393MN', 'costo_fijo_base' => 127879.92, 'factor_km' => 0.85,   'n_ops_observadas' => 17],
            ['ruta_codigo' => 'PSS600', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'PSS_RojasNorberto_MAR26',     'patente_match' => 'HBL028',  'costo_fijo_base' => 116815.63, 'factor_km' => 0.8501, 'n_ops_observadas' => 18],
            ['ruta_codigo' => 'PSS600', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Sainz Kevin Alejandro',       'patente_match' => 'JZL422',  'costo_fijo_base' => 58631.35,  'n_ops_observadas' => 31],
            ['ruta_codigo' => 'PSS600', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Dario Javier Dinter',         'patente_match' => 'MHC281',  'costo_fijo_base' => 81176.96,  'n_ops_observadas' => 18],
            ['ruta_codigo' => 'PSS600', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Fernando Hernan Schrode',     'patente_match' => 'MPJ732',  'costo_fijo_base' => 98530.44,  'n_ops_observadas' => 17],
            ['ruta_codigo' => 'PSS600', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'Daniel Alberto Lescano',      'patente_match' => 'OTI123',  'costo_fijo_base' => 123886.80, 'factor_km' => 0.85,   'n_ops_observadas' => 21],
            ['ruta_codigo' => 'RCU007', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Ezequiel Guillermo Moran',    'patente_match' => 'AC382LS', 'costo_fijo_base' => 85081.55,  'n_ops_observadas' => 15],
            ['ruta_codigo' => 'RCU007', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Guillermo Daniel Rufino',     'patente_match' => 'AE827RE', 'costo_fijo_base' => 90876.57,  'n_ops_observadas' => 17],
            ['ruta_codigo' => 'RCU007', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Allais Mayco Guzman',         'patente_match' => 'LFD923',  'costo_fijo_base' => 83962.05,  'n_ops_observadas' => 6],
            ['ruta_codigo' => 'RCU007', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Diego Pablo Belotti',         'patente_match' => 'LQC085',  'costo_fijo_base' => 93291.17,  'n_ops_observadas' => 18],
            ['ruta_codigo' => 'RES005', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'TREJO MATIAS',                'patente_match' => 'AA046IX', 'costo_fijo_base' => 142554.67, 'factor_km' => 0.85,   'n_ops_observadas' => 20],
            ['ruta_codigo' => 'RES020', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'RES_BustamanteCarlos_MAR26',  'patente_match' => 'HVD406',  'costo_fijo_base' => 71277.32,  'n_ops_observadas' => 3],
            ['ruta_codigo' => 'RES056', 'capacidad_vehiculo_kg' => 3500, 'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'ROLON EUSEBIO',               'patente_match' => 'AC503EM', 'costo_fijo_base' => 105929.94, 'factor_km' => 0.91,   'n_ops_observadas' => 5],
            ['ruta_codigo' => 'RES065', 'capacidad_vehiculo_kg' => 100,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Claudio Morales',             'patente_match' => 'A009PHB', 'costo_fijo_base' => 49784.78,  'n_ops_observadas' => 25],
            ['ruta_codigo' => 'RES065', 'capacidad_vehiculo_kg' => 100,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'RES_VegaMarcelo_MAR26',       'patente_match' => 'A033XQZ', 'costo_fijo_base' => 49784.78,  'n_ops_observadas' => 10],
            ['ruta_codigo' => 'RES065', 'capacidad_vehiculo_kg' => 100,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Gabriela Bordon',             'patente_match' => 'A053RZS', 'costo_fijo_base' => 49784.76,  'n_ops_observadas' => 19],
            ['ruta_codigo' => 'RES065', 'capacidad_vehiculo_kg' => 100,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Mariel Betiana Coronel',      'patente_match' => 'A166EEV', 'costo_fijo_base' => 49784.78,  'n_ops_observadas' => 22],
            ['ruta_codigo' => 'RES065', 'capacidad_vehiculo_kg' => 100,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Carlos Gabriel Ponce',        'patente_match' => 'A180OUB', 'costo_fijo_base' => 49784.78,  'n_ops_observadas' => 25],
            ['ruta_codigo' => 'RES080', 'capacidad_vehiculo_kg' => 10000,'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'OJEDA ALFREDO',               'patente_match' => 'IWK373',  'costo_fijo_base' => 185342.87, 'factor_km' => 0.90,   'n_ops_observadas' => 16],
            ['ruta_codigo' => 'ROHS07', 'capacidad_vehiculo_kg' => 5000, 'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'BENITEZ GERMAN',              'patente_match' => 'OMU364',  'costo_fijo_base' => 263582.41, 'factor_km' => 0.83,   'n_ops_observadas' => 20],
            ['ruta_codigo' => 'ROHS07', 'capacidad_vehiculo_kg' => 12000,'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'HURT LEANDRO',                'patente_match' => 'AC002PK', 'costo_fijo_base' => 285812.00, 'factor_km' => 0.90,   'n_ops_observadas' => 13],
            ['ruta_codigo' => 'ROHS16', 'capacidad_vehiculo_kg' => 12000,'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'HURT LEANDRO',                'patente_match' => 'AC002PK', 'costo_fijo_base' => 285812.00, 'factor_km' => 0.9001, 'n_ops_observadas' => 3],
            ['ruta_codigo' => 'RSA600', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Maria del Carmen Ahuad',      'patente_match' => 'AF594TR', 'costo_fijo_base' => 131251.00, 'n_ops_observadas' => 22],
            ['ruta_codigo' => 'STP001', 'capacidad_vehiculo_kg' => 700,  'modelo_tarifa' => 'JORNADA',    'distribuidor_nombre' => 'Waldemar Exequiel Ovejero',   'patente_match' => 'MQJ507',  'costo_fijo_base' => 142554.67, 'n_ops_observadas' => 2],
            ['ruta_codigo' => 'TRC043', 'capacidad_vehiculo_kg' => 10000,'modelo_tarifa' => 'JORNADA_KM', 'distribuidor_nombre' => 'OJEDA ALFREDO',               'patente_match' => 'IWK373',  'costo_fijo_base' => 197699.06, 'factor_km' => 0.90,   'n_ops_observadas' => 5],
        ];
    }
}

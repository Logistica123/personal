<?php

namespace Database\Seeders;

use App\Models\LiquidacionClientRule;
use Illuminate\Database\Seeder;

class LiquidacionesClientRulesSeeder extends Seeder
{
    public function run(): void
    {
        $intermedioRules = $this->intermedioRules();
        $epsaRules = $this->epsaRules();

        $this->upsertClientRules(
            ['INTERMEDIO', 'INTERMEDIO SRL', '10 - INTERMEDIO SRL', 'INT'],
            $intermedioRules,
            'Seeder base de reglas INTERMEDIO'
        );

        $this->upsertClientRules(
            ['EPSA'],
            $epsaRules,
            'Seeder base de reglas EPSA'
        );
    }

    private function upsertClientRules(array $clientCodes, array $rules, string $note): void
    {
        foreach ($clientCodes as $clientCode) {
            $normalized = strtoupper(trim((string) $clientCode));
            if ($normalized === '') {
                continue;
            }

            LiquidacionClientRule::query()->updateOrCreate(
                ['client_code' => $normalized],
                [
                    'active' => true,
                    'rules_json' => $rules,
                    'note' => $note,
                    'updated_by' => null,
                ]
            );
        }
    }

    private function intermedioRules(): array
    {
        return [
            'blocking_rules' => [
                'duplicate_row' => false,
                'outside_period' => true,
                'tariff_mismatch' => false,
            ],
            'tolerances' => [
                'price_per_liter_percent' => 3,
                'price_per_liter_amount' => 0,
            ],
            'plus_by_patente' => [
                'AH636RD' => [
                    'plus_media' => 5000,
                    'plus_completa' => 10000,
                ],
            ],
            'tariffs' => [
                ['product' => 'Ut. Corto AM', 'price_per_liter' => 96900],
                ['product' => 'Ut. Corto PM', 'price_per_liter' => 72250],
                ['product' => 'Ut. Corto PM SC21', 'price_per_liter' => 76250],
                ['product' => 'Ut. Mediano', 'price_per_liter' => 170000],
                ['product' => 'Ut. Largo (2015/2017)', 'price_per_liter' => 200000],
                ['product' => 'Ut. Largo NEW (2018)', 'price_per_liter' => 220000],
                ['product' => 'Chasis', 'price_per_liter' => 296000],
            ],
            'tariff_matrix' => [
                'default_zone' => 'AMBA',
                'zones' => [
                    'AMBA' => [
                        'CORTO_AM' => ['label' => 'Ut. Corto AM', 'original' => 114000, 'liquidacion' => 96900],
                        'CORTO_PM' => ['label' => 'Ut. Corto PM', 'original' => 85000, 'liquidacion' => 72250],
                        'CORTO_PM_SC21' => ['label' => 'Ut. Corto PM SC21', 'original' => 90000, 'liquidacion' => 76250],
                        'CORTO' => ['label' => 'Ut. Corto', 'original' => 0, 'liquidacion' => 0],
                        'MEDIANO' => ['label' => 'Ut. Mediano', 'original' => 193000, 'liquidacion' => 170000, 'special' => true],
                        'LARGO' => ['label' => 'Ut. Largo (2015/2017)', 'original' => 228000, 'liquidacion' => 200000, 'special' => true],
                        'LARGO_2018' => ['label' => 'Ut. Largo NEW (2018)', 'original' => 250000, 'liquidacion' => 220000, 'special' => true],
                        'CHASIS' => ['label' => 'Chasis', 'original' => 296000, 'liquidacion' => 296000],
                    ],
                ],
            ],
        ];
    }

    private function epsaRules(): array
    {
        return [
            'blocking_rules' => [
                'duplicate_row' => true,
                'outside_period' => false,
                'tariff_mismatch' => false,
            ],
            'tolerances' => [
                'price_per_liter_percent' => 3,
                'price_per_liter_amount' => 0,
            ],
            'epsa' => [
                'sheet_name' => 'Table',
                'tipo_unidad' => 'UT_CHICO',
                'match_alias_type' => 'DISTRIBUIDOR',
                'tarifario_ut_chico' => [
                    ['km_desde' => 0, 'km_hasta' => 90, 'la_jornada' => 92636.70],
                    ['km_desde' => 90.00001, 'km_hasta' => 120, 'la_jornada' => 104216.29],
                    ['km_desde' => 120.00001, 'km_hasta' => 150, 'la_jornada' => 115795.88],
                    ['km_desde' => 150.00001, 'km_hasta' => 170, 'la_jornada' => 127375.47],
                    ['km_desde' => 170.00001, 'km_hasta' => 200, 'la_jornada' => 127375.47],
                ],
            ],
        ];
    }
}


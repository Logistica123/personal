<?php

namespace Tests\Feature;

use App\Models\Distributor;
use App\Models\FuelMovement;
use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FuelReportInstallmentsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $migrationPaths = [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/2025_12_06_131000_create_audit_events_table.php',
            'database/migrations/2026_02_10_000100_create_distributors_table.php',
            'database/migrations/2026_02_10_000000_create_fuel_movements_table.php',
            'database/migrations/2026_02_10_000150_add_fuel_movement_links.php',
            'database/migrations/2026_02_10_000120_create_fuel_reports_table.php',
            'database/migrations/2026_02_10_000130_create_fuel_report_items_table.php',
            'database/migrations/2026_02_10_000140_create_fuel_adjustments_table.php',
            'database/migrations/2026_02_10_000160_add_conductor_to_fuel_movements_table.php',
            'database/migrations/2026_02_26_000190_add_invoice_number_to_fuel_movements_table.php',
        ];

        foreach ($migrationPaths as $path) {
            $this->artisan('migrate', [
                '--path' => $path,
                '--realpath' => false,
            ])->assertExitCode(0);
        }

        // Ensure tables exist for sqlite memory setups (defensive).
        $this->assertTrue(Schema::hasTable('fuel_movements'));
        $this->assertTrue(Schema::hasTable('fuel_reports'));
    }

    private function authHeaders(): array
    {
        $plainToken = 'token-tests-fuel-installments';
        User::factory()->create([
            'email' => 'fuel.installments.tests@example.com',
            'remember_token' => hash('sha256', $plainToken),
        ]);

        return [
            'Accept' => 'application/json',
            'Authorization' => 'Bearer ' . $plainToken,
        ];
    }

    public function test_it_applies_discount_in_installments_and_creates_pending_quota_movements(): void
    {
        $distributor = Distributor::query()->create([
            'name' => 'DIST-TEST',
            'code' => 'DIST-TEST',
            'active' => true,
        ]);

        $movementA = FuelMovement::query()->create([
            'domain_norm' => 'AH066DM',
            'occurred_at' => '2026-03-01 10:00:00',
            'amount' => 60.00,
            'status' => 'IMPUTED',
            'discounted' => false,
            'distributor_id' => $distributor->id,
        ]);
        $movementB = FuelMovement::query()->create([
            'domain_norm' => 'AH066DM',
            'occurred_at' => '2026-03-02 10:00:00',
            'amount' => 40.00,
            'status' => 'IMPUTED',
            'discounted' => false,
            'distributor_id' => $distributor->id,
        ]);

        $headers = $this->authHeaders();

        $response = $this->postJson('/api/combustible/reportes/seleccion', [
            'movement_ids' => [$movementA->id, $movementB->id],
            'installments' => 2,
            'liquidacion_id' => null,
        ], $headers);

        $response
            ->assertOk()
            ->assertJsonPath('data.status', 'APPLIED')
            ->assertJsonPath('data.total_amount', '100.00')
            ->assertJsonPath('data.total_to_bill', '50.00');

        $this->assertSame(2, FuelMovement::query()->whereIn('id', [$movementA->id, $movementB->id])->where('discounted', true)->count());

        $this->assertSame(1, FuelMovement::query()->where('status', 'CUOTA')->where('discounted', false)->count());
        $this->assertEquals(50.0, (float) FuelMovement::query()->where('status', 'CUOTA')->value('amount'));
    }

    public function test_it_splits_into_three_installments_and_creates_two_quota_movements(): void
    {
        $distributor = Distributor::query()->create([
            'name' => 'DIST-TEST-3',
            'code' => 'DIST-TEST-3',
            'active' => true,
        ]);

        $movement = FuelMovement::query()->create([
            'domain_norm' => 'AH066DM',
            'occurred_at' => '2026-03-03 10:00:00',
            'amount' => 100.00,
            'status' => 'IMPUTED',
            'discounted' => false,
            'distributor_id' => $distributor->id,
        ]);

        $headers = $this->authHeaders();

        $response = $this->postJson('/api/combustible/reportes/seleccion', [
            'movement_ids' => [$movement->id],
            'installments' => 3,
            'liquidacion_id' => null,
        ], $headers);

        $response
            ->assertOk()
            ->assertJsonPath('data.total_amount', '100.00')
            ->assertJsonPath('data.total_to_bill', '33.34');

        $cuotas = FuelMovement::query()
            ->where('status', 'CUOTA')
            ->where('discounted', false)
            ->orderBy('id')
            ->pluck('amount')
            ->map(fn ($value) => (float) $value)
            ->values()
            ->all();

        $this->assertCount(2, $cuotas);
        $this->assertEquals(33.33, $cuotas[0]);
        $this->assertEquals(33.33, $cuotas[1]);
    }
}

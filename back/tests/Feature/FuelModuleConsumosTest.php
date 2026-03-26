<?php

namespace Tests\Feature;

use App\Models\FuelMovement;
use App\Models\User;
use Tests\TestCase;

class FuelModuleConsumosTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $migrationPaths = [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/2026_02_10_000000_create_fuel_movements_table.php',
            'database/migrations/2026_02_10_000150_add_fuel_movement_links.php',
            'database/migrations/2026_02_10_000160_add_conductor_to_fuel_movements_table.php',
            'database/migrations/2026_02_26_000190_add_invoice_number_to_fuel_movements_table.php',
        ];

        foreach ($migrationPaths as $path) {
            $this->artisan('migrate', [
                '--path' => $path,
                '--realpath' => false,
            ])->assertExitCode(0);
        }
    }

    private function authHeaders(): array
    {
        $plainToken = 'token-tests-fuel-consumos';
        User::factory()->create([
            'email' => 'fuel.tests@example.com',
            'remember_token' => hash('sha256', $plainToken),
        ]);

        return [
            'Accept' => 'application/json',
            'Authorization' => 'Bearer ' . $plainToken,
        ];
    }

    public function test_it_filters_only_pending_by_discounted_flag(): void
    {
        FuelMovement::create([
            'domain_norm' => 'AH066DM',
            'occurred_at' => '2026-02-01 10:00:00',
            'amount' => 1000,
            'status' => 'IMPORTED',
            'discounted' => false,
        ]);

        $discounted = FuelMovement::create([
            'domain_norm' => 'AH066DM',
            'occurred_at' => '2026-01-15 10:00:00',
            'amount' => 2000,
            'status' => 'IMPORTED',
            'discounted' => true,
        ]);

        FuelMovement::create([
            'domain_norm' => 'ZZZ999',
            'occurred_at' => '2026-02-01 10:00:00',
            'amount' => 3000,
            'status' => 'IMPORTED',
            'discounted' => false,
        ]);

        $headers = $this->authHeaders();

        $this->getJson('/api/combustible/consumos?domain=AH066DM', $headers)
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->getJson('/api/combustible/consumos?domain=AH066DM&only_pending=1', $headers)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonMissing(['id' => $discounted->id]);
    }
}


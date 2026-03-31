<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class LiqTarifaSelfApproveTest extends TestCase
{
    private int $userId;

    protected function setUp(): void
    {
        parent::setUp();

        $migrationPaths = [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/2026_03_31_000001_create_liq_clientes_table.php',
            'database/migrations/2026_03_31_000002_create_liq_esquemas_tarifarios_table.php',
            'database/migrations/2026_03_31_000004_create_liq_lineas_tarifa_table.php',
            'database/migrations/2026_03_31_000011_create_liq_auditoria_tarifa_table.php',
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
        $plainToken = 'token-tests-liq-tarifas';
        $user = User::factory()->create([
            'email' => 'liq.tarifas.tests@example.com',
            'role' => 'admin',
            'remember_token' => hash('sha256', $plainToken),
        ]);
        $this->userId = (int) $user->id;

        return [
            'Accept' => 'application/json',
            'Authorization' => 'Bearer ' . $plainToken,
        ];
    }

    public function test_admin_can_self_approve_a_line(): void
    {
        $headers = $this->authHeaders();

        $clienteId = (int) DB::table('liq_clientes')->insertGetId([
            'razon_social' => 'Loginter SA',
            'nombre_corto' => 'LOGINTER',
            'cuit' => '30-00000000-0',
            'activo' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $esquemaId = (int) DB::table('liq_esquemas_tarifarios')->insertGetId([
            'cliente_id' => $clienteId,
            'nombre' => 'Tarifa Loginter',
            'descripcion' => null,
            'dimensiones' => json_encode(['sucursal', 'concepto'], JSON_UNESCAPED_UNICODE),
            'activo' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $create = $this->postJson("/api/liq/esquemas/{$esquemaId}/lineas", [
            'dimensiones_valores' => [
                'sucursal' => 'AMBA',
                'concepto' => 'Ut. Corto',
            ],
            'precio_original' => 100000,
            'porcentaje_agencia' => 10,
            'vigencia_desde' => '2026-01-01',
            'vigencia_hasta' => null,
        ], $headers);

        $create->assertCreated();

        $lineaId = (int) $create->json('data.id');
        $this->assertGreaterThan(0, $lineaId);

        $approve = $this->putJson("/api/liq/lineas/{$lineaId}/aprobar", [], $headers);

        $approve
            ->assertOk()
            ->assertJsonPath('data.id', $lineaId)
            ->assertJsonPath('data.aprobado_por', $this->userId);
    }
}

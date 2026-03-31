<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LiqPagoControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $migrationPaths = [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/2026_03_31_000001_create_liq_clientes_table.php',
            'database/migrations/2026_03_31_000013_add_configuracion_excel_to_liq_clientes_table.php',
            'database/migrations/2026_03_31_000008_create_liq_liquidaciones_cliente_table.php',
        ];

        foreach ($migrationPaths as $path) {
            $this->artisan('migrate', [
                '--path' => $path,
                '--realpath' => false,
            ])->assertExitCode(0);
        }

        if (! Schema::hasTable('personas')) {
            Schema::create('personas', function (Blueprint $table) {
                $table->id();
                $table->string('apellidos')->nullable();
                $table->string('nombres')->nullable();
                $table->string('cuit_cuil')->nullable();
                $table->string('cbu_alias')->nullable();
                $table->string('patente')->nullable()->index();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        $afterPersonasMigrationPaths = [
            'database/migrations/2026_03_31_000010_create_liq_liquidaciones_distribuidor_table.php',
            'database/migrations/2026_03_31_000014_create_liq_pagos_table.php',
            'database/migrations/2026_03_31_000015_create_liq_pago_items_table.php',
            'database/migrations/2026_03_31_000016_add_pago_fields_to_liq_liquidaciones_distribuidor_table.php',
        ];

        foreach ($afterPersonasMigrationPaths as $path) {
            $this->artisan('migrate', [
                '--path' => $path,
                '--realpath' => false,
            ])->assertExitCode(0);
        }
    }

    private function authHeaders(): array
    {
        $plainToken = 'token-tests-liq-pagos';
        User::factory()->create([
            'email' => 'liq.pagos.tests@example.com',
            'role' => 'admin',
            'remember_token' => hash('sha256', $plainToken),
        ]);

        return [
            'Accept' => 'application/json',
            'Authorization' => 'Bearer ' . $plainToken,
        ];
    }

    public function test_it_creates_marks_and_exports_a_payment_batch(): void
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

        $personaId = (int) DB::table('personas')->insertGetId([
            'apellidos' => 'Pérez',
            'nombres' => 'Juan',
            'cuit_cuil' => '20-12345678-9',
            'cbu_alias' => '0000003100002398713449',
            'patente' => 'ABC123',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $liqClienteId = (int) DB::table('liq_liquidaciones_cliente')->insertGetId([
            'cliente_id' => $clienteId,
            'archivo_origen' => 'test.xlsx',
            'sucursal_tarifa' => 'AMBA',
            'periodo_desde' => '2026-03-01',
            'periodo_hasta' => '2026-03-15',
            'fecha_carga' => now(),
            'usuario_carga' => null,
            'estado' => 'aprobada',
            'total_operaciones' => 1,
            'total_importe_cliente' => 1000,
            'total_importe_correcto' => 900,
            'total_diferencia' => 100,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $liqDistId = (int) DB::table('liq_liquidaciones_distribuidor')->insertGetId([
            'liquidacion_cliente_id' => $liqClienteId,
            'distribuidor_id' => $personaId,
            'periodo_desde' => '2026-03-01',
            'periodo_hasta' => '2026-03-15',
            'fecha_generacion' => now(),
            'cantidad_operaciones' => 1,
            'subtotal' => 900,
            'gastos_administrativos' => 10,
            'total_a_pagar' => 890,
            'estado' => 'aprobada',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $create = $this->postJson('/api/liq/pagos', [
            'cliente_id' => $clienteId,
            'periodo_desde' => '2026-03-01',
            'periodo_hasta' => '2026-03-15',
        ], $headers);

        $create
            ->assertCreated()
            ->assertJsonPath('data.cliente_id', $clienteId)
            ->assertJsonPath('data.cantidad_items', 1);

        $pagoId = (int) $create->json('data.id');

        $this->getJson("/api/liq/pagos/{$pagoId}/items", $headers)
            ->assertOk()
            ->assertJsonPath('data.0.liquidacion_distribuidor_id', $liqDistId);

        $this->postJson("/api/liq/pagos/{$pagoId}/marcar-pagado", [
            'referencia' => 'TRANSF-001',
        ], $headers)->assertOk();

        $liqDist = DB::table('liq_liquidaciones_distribuidor')->where('id', $liqDistId)->first();
        $this->assertNotNull($liqDist);
        $this->assertSame('pagada', $liqDist->estado);
        $this->assertSame('TRANSF-001', $liqDist->pago_referencia);

        $this->get("/api/liq/pagos/{$pagoId}/export.csv", $headers)
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }
}

<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LiqExtractosTotalRowTest extends TestCase
{
    private int $userId;

    protected function setUp(): void
    {
        parent::setUp();

        $migrationPaths = [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/2026_03_31_000001_create_liq_clientes_table.php',
            'database/migrations/2026_03_31_000002_create_liq_esquemas_tarifarios_table.php',
            'database/migrations/2026_03_31_000005_create_liq_mapeos_concepto_table.php',
            'database/migrations/2026_03_31_000004_create_liq_lineas_tarifa_table.php',
            'database/migrations/2026_03_31_000008_create_liq_liquidaciones_cliente_table.php',
            'database/migrations/2026_03_31_000009_create_liq_operaciones_table.php',
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
                $table->string('cbu_alias')->nullable();
                $table->string('patente')->nullable();
                $table->string('patente_idx')->nullable()->index();
                $table->timestamps();
                $table->softDeletes();
            });
        }
    }

    private function authHeaders(): array
    {
        $plainToken = 'token-tests-liq-extractos';
        $user = User::factory()->create([
            'email' => 'liq.extractos.tests@example.com',
            'role' => 'admin',
            'remember_token' => hash('sha256', $plainToken),
        ]);
        $this->userId = (int) $user->id;

        return [
            'Accept' => 'application/json',
            'Authorization' => 'Bearer ' . $plainToken,
        ];
    }

    public function test_recalcular_deletes_total_row_and_fixes_totals(): void
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
            'nombre' => 'Tarifa Loginter 2026',
            'descripcion' => null,
            'dimensiones' => json_encode(['sucursal', 'concepto'], JSON_UNESCAPED_UNICODE),
            'activo' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('liq_mapeos_concepto')->insert([
            'cliente_id' => $clienteId,
            'valor_excel' => 'Rango 0-100kms',
            'dimension_destino' => 'concepto',
            'valor_tarifa' => 'Ut. Mediano',
            'activo' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $lineaId = (int) DB::table('liq_lineas_tarifa')->insertGetId([
            'esquema_id' => $esquemaId,
            'dimensiones_valores' => json_encode(['sucursal' => 'BAHIA BLANCA', 'concepto' => 'Ut. Mediano'], JSON_UNESCAPED_UNICODE),
            'precio_original' => 211082,
            'porcentaje_agencia' => 16,
            'precio_distribuidor' => 177308.88,
            'vigencia_desde' => '2026-01-01',
            'vigencia_hasta' => null,
            'creado_por' => $this->userId,
            'aprobado_por' => $this->userId,
            'fecha_aprobacion' => now(),
            'activo' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $personaId = (int) DB::table('personas')->insertGetId([
            'apellidos' => 'Valencia',
            'nombres' => 'Ariel',
            'patente' => 'AE936RW',
            'patente_idx' => 'AE936RW',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $liqClienteId = (int) DB::table('liq_liquidaciones_cliente')->insertGetId([
            'cliente_id' => $clienteId,
            'archivo_origen' => 'BAHIA BLANCA UM.xlsx',
            'sucursal_tarifa' => 'BAHIA BLANCA',
            'periodo_desde' => '2026-01-31',
            'periodo_hasta' => '2026-02-15',
            'fecha_carga' => now(),
            'usuario_carga' => $this->userId,
            'estado' => 'auditada',
            'total_operaciones' => 13,
            'total_importe_cliente' => 5065968,
            'total_importe_correcto' => 0,
            'total_diferencia' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 12 operaciones reales
        for ($i = 0; $i < 12; $i++) {
            DB::table('liq_operaciones')->insert([
                'liquidacion_cliente_id' => $liqClienteId,
                'campos_originales' => json_encode(['Concepto' => 'Rango 0-100kms', 'Valor' => 211082], JSON_UNESCAPED_UNICODE),
                'dominio' => 'AE936RW',
                'concepto' => 'Rango 0-100kms',
                'valor_cliente' => 211082,
                'linea_tarifa_id' => $lineaId,
                'valor_tarifa_original' => 211082,
                'valor_tarifa_distribuidor' => 177308.88,
                'porcentaje_agencia' => 16,
                'diferencia_cliente' => 0,
                'estado' => 'ok',
                'distribuidor_id' => $personaId,
                'observacion' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Fila TOTAL (no operativa) que duplica el importe
        DB::table('liq_operaciones')->insert([
            'liquidacion_cliente_id' => $liqClienteId,
            'campos_originales' => json_encode(['Concepto' => 'TOTAL', 'Valor' => 2532984], JSON_UNESCAPED_UNICODE),
            'dominio' => 'TOTAL',
            'concepto' => 'TOTAL',
            'valor_cliente' => 2532984,
            'linea_tarifa_id' => null,
            'valor_tarifa_original' => null,
            'valor_tarifa_distribuidor' => null,
            'porcentaje_agencia' => null,
            'diferencia_cliente' => null,
            'estado' => 'sin_distribuidor',
            'distribuidor_id' => null,
            'observacion' => 'Concepto sin mapeo: TOTAL',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson("/api/liq/liquidaciones/{$liqClienteId}/recalcular", [], $headers)
            ->assertOk()
            ->assertJsonPath('data.estado_counts.ok', 12);

        $liq = DB::table('liq_liquidaciones_cliente')->where('id', $liqClienteId)->first();
        $this->assertNotNull($liq);
        $this->assertSame(12, (int) $liq->total_operaciones);
        $this->assertSame(2532984.0, (float) $liq->total_importe_cliente);

        $totalOps = (int) DB::table('liq_operaciones')->where('liquidacion_cliente_id', $liqClienteId)->count();
        $this->assertSame(12, $totalOps);
    }
}

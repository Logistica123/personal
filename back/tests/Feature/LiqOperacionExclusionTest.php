<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LiqOperacionExclusionTest extends TestCase
{
    private int $userId;

    protected function setUp(): void
    {
        parent::setUp();

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

        $migrationPaths = [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/2026_03_31_000001_create_liq_clientes_table.php',
            'database/migrations/2026_03_31_000002_create_liq_esquemas_tarifarios_table.php',
            'database/migrations/2026_03_31_000004_create_liq_lineas_tarifa_table.php',
            'database/migrations/2026_03_31_000008_create_liq_liquidaciones_cliente_table.php',
            'database/migrations/2026_03_31_000009_create_liq_operaciones_table.php',
            'database/migrations/2026_03_31_000017_add_exclusion_fields_to_liq_operaciones_table.php',
            'database/migrations/2026_03_31_000018_create_liq_operacion_auditorias_table.php',
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
        $plainToken = 'token-tests-liq-operacion-exclusion';
        $user = User::factory()->create([
            'email' => 'liq.operacion.exclusion.tests@example.com',
            'role' => 'admin',
            'remember_token' => hash('sha256', $plainToken),
        ]);
        $this->userId = (int) $user->id;

        return [
            'Accept' => 'application/json',
            'Authorization' => 'Bearer ' . $plainToken,
        ];
    }

    public function test_excluding_operation_recalculates_totals_and_creates_audit(): void
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

        DB::table('liq_esquemas_tarifarios')->insert([
            'cliente_id' => $clienteId,
            'nombre' => 'Tarifa Loginter 2026',
            'descripcion' => null,
            'dimensiones' => json_encode(['sucursal', 'concepto'], JSON_UNESCAPED_UNICODE),
            'activo' => 1,
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
            'total_operaciones' => 2,
            'total_importe_cliente' => 300,
            'total_importe_correcto' => 0,
            'total_diferencia' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $op1Id = (int) DB::table('liq_operaciones')->insertGetId([
            'liquidacion_cliente_id' => $liqClienteId,
            'campos_originales' => json_encode(['Concepto' => 'A', 'Valor' => 100], JSON_UNESCAPED_UNICODE),
            'dominio' => 'AA000AA',
            'concepto' => 'A',
            'valor_cliente' => 100,
            'linea_tarifa_id' => null,
            'valor_tarifa_original' => null,
            'valor_tarifa_distribuidor' => null,
            'porcentaje_agencia' => null,
            'diferencia_cliente' => null,
            'estado' => 'sin_tarifa',
            'distribuidor_id' => null,
            'observacion' => null,
            'excluida' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('liq_operaciones')->insert([
            'liquidacion_cliente_id' => $liqClienteId,
            'campos_originales' => json_encode(['Concepto' => 'B', 'Valor' => 200], JSON_UNESCAPED_UNICODE),
            'dominio' => 'BB000BB',
            'concepto' => 'B',
            'valor_cliente' => 200,
            'linea_tarifa_id' => null,
            'valor_tarifa_original' => null,
            'valor_tarifa_distribuidor' => null,
            'porcentaje_agencia' => null,
            'diferencia_cliente' => null,
            'estado' => 'sin_tarifa',
            'distribuidor_id' => null,
            'observacion' => null,
            'excluida' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->patchJson("/api/liq/operaciones/{$op1Id}/exclusion", [
            'excluida' => true,
            'motivo' => 'Fila duplicada',
        ], $headers)->assertOk();

        $op = DB::table('liq_operaciones')->where('id', $op1Id)->first();
        $this->assertNotNull($op);
        $this->assertSame(1, (int) $op->excluida);
        $this->assertSame('Fila duplicada', $op->motivo_exclusion);

        $liq = DB::table('liq_liquidaciones_cliente')->where('id', $liqClienteId)->first();
        $this->assertNotNull($liq);
        $this->assertSame(1, (int) $liq->total_operaciones);
        $this->assertSame(200.0, (float) $liq->total_importe_cliente);

        $audCount = (int) DB::table('liq_operacion_auditorias')
            ->where('operacion_id', $op1Id)
            ->where('accion', 'exclusion')
            ->count();
        $this->assertSame(1, $audCount);
    }
}


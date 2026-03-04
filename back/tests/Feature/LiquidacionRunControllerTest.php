<?php

namespace Tests\Feature;

use App\Jobs\ProcessLiquidacionPublishJob;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Tests\TestCase;

class LiquidacionRunControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $migrationPaths = [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/2025_12_06_131000_create_audit_events_table.php',
            'database/migrations/2026_03_02_000001_create_liq_import_runs_table.php',
            'database/migrations/2026_03_02_000002_create_liq_staging_rows_table.php',
            'database/migrations/2026_03_02_000003_create_liq_validation_results_table.php',
            'database/migrations/2026_03_02_000004_create_liq_publish_jobs_table.php',
            'database/migrations/2026_03_02_000005_create_liq_observations_table.php',
            'database/migrations/2026_03_02_000006_create_liq_client_rules_table.php',
            'database/migrations/2026_03_03_000001_create_liq_distributors_table.php',
            'database/migrations/2026_03_03_000002_create_liq_distributor_lines_table.php',
            'database/migrations/2026_03_03_000003_create_liq_audit_changes_table.php',
            'database/migrations/2026_03_03_000004_add_matching_fields_to_liq_staging_rows_and_aliases_table.php',
        ];

        foreach ($migrationPaths as $path) {
            $this->artisan('migrate', [
                '--path' => $path,
                '--realpath' => false,
            ])->assertExitCode(0);
        }

        if (!Schema::hasTable('personas')) {
            Schema::create('personas', function (Blueprint $table) {
                $table->id();
                $table->string('apellidos')->nullable();
                $table->string('nombres')->nullable();
                $table->string('cuil')->nullable();
                $table->string('patente')->nullable()->index();
                $table->timestamps();
                $table->softDeletes();
            });
        }
    }

    private function authHeaders(): array
    {
        $plainToken = 'token-tests-liquidaciones';
        User::factory()->create([
            'email' => 'liquidaciones.tests@example.com',
            'remember_token' => hash('sha256', $plainToken),
        ]);

        return [
            'Accept' => 'application/json',
            'Authorization' => 'Bearer ' . $plainToken,
        ];
    }

    public function test_it_lists_and_shows_runs(): void
    {
        $headers = $this->authHeaders();

        $createResponse = $this->postJson('/api/liquidaciones/runs', [
            'client_code' => 'CLIENTE-A',
            'period_from' => '2026-02-01',
            'period_to' => '2026-02-15',
            'staging_rows' => [
                [
                    'row_number' => 1,
                    'domain_norm' => 'ABC123',
                    'distributor_code' => 'DIST-1',
                    'validation_status' => 'OK',
                    'liters' => 40.5,
                    'amount' => 51000.25,
                ],
                [
                    'row_number' => 2,
                    'domain_norm' => 'XYZ987',
                    'distributor_code' => 'DIST-2',
                    'validation_status' => 'ALERTA',
                    'liters' => 20,
                    'amount' => 19000,
                ],
            ],
        ], $headers);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.clientCode', 'CLIENTE-A')
            ->assertJsonPath('data.rowsTotal', 2)
            ->assertJsonPath('data.rowsOk', 1)
            ->assertJsonPath('data.rowsAlert', 1);

        $runId = (int) $createResponse->json('data.id');

        $this->getJson('/api/liquidaciones/runs?status=PRELIQUIDACION', $headers)
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('summary.status_counts.PRELIQUIDACION', 1)
            ->assertJsonPath('data.0.id', $runId);

        $this->getJson('/api/liquidaciones/runs/' . $runId, $headers)
            ->assertOk()
            ->assertJsonPath('data.id', $runId)
            ->assertJsonPath('summary.staging_rows_count', 2);
    }

    public function test_it_upserts_and_requires_force_for_critical_approval(): void
    {
        $headers = $this->authHeaders();

        $createResponse = $this->postJson('/api/liquidaciones/runs', [
            'client_code' => 'CLIENTE-B',
            'staging_rows' => [
                [
                    'row_number' => 1,
                    'domain_norm' => 'QWE456',
                    'distributor_code' => 'DIST-1',
                    'validation_status' => 'OK',
                    'liters' => 10,
                    'amount' => 10000,
                ],
            ],
        ], $headers)->assertCreated();

        $runId = (int) $createResponse->json('data.id');

        $this->postJson('/api/liquidaciones/runs/' . $runId . '/upsert', [
            'staging_rows' => [
                [
                    'row_number' => 2,
                    'domain_norm' => 'POI741',
                    'distributor_code' => 'DIST-1',
                    'validation_status' => 'ERROR_CRITICO',
                    'liters' => 15,
                    'amount' => 15000,
                ],
            ],
            'validation_results' => [
                [
                    'row_number' => 2,
                    'rule_code' => 'TARIFA_MATCH',
                    'severity' => 'CRITICAL',
                    'result' => 'FAIL',
                    'message' => 'Tarifa fuera de rango.',
                ],
            ],
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.rowsTotal', 2)
            ->assertJsonPath('data.rowsError', 1);

        $this->postJson('/api/liquidaciones/runs/' . $runId . '/approve', [], $headers)
            ->assertStatus(422)
            ->assertJsonPath('message', 'No se puede aprobar: hay errores críticos pendientes. Usa force=true para sobrescribir.');

        $this->postJson('/api/liquidaciones/runs/' . $runId . '/approve', [
            'force' => true,
            'note' => 'Aprobado por contingencia.',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.status', 'APROBADA');

        $this->assertDatabaseHas('liq_import_runs', [
            'id' => $runId,
            'status' => 'APROBADA',
        ]);
    }

    public function test_it_publishes_run_to_erp_with_dry_run_and_real_mode(): void
    {
        $headers = $this->authHeaders();

        $createResponse = $this->postJson('/api/liquidaciones/runs', [
            'client_code' => 'CLIENTE-C',
            'status' => 'APPROVED',
            'period_from' => '2026-02-01',
            'period_to' => '2026-02-15',
            'staging_rows' => [
                [
                    'row_number' => 1,
                    'domain_norm' => 'MNO321',
                    'distributor_code' => 'DIST-ERP',
                    'distributor_name' => 'Distribuidor ERP',
                    'validation_status' => 'OK',
                    'liters' => 30,
                    'amount' => 30000,
                ],
            ],
        ], $headers)->assertCreated();

        $runId = (int) $createResponse->json('data.id');

        $this->postJson('/api/liquidaciones/runs/' . $runId . '/publicar-erp', [
            'dry_run' => true,
            'queue' => false,
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.status', 'DRY_RUN')
            ->assertJsonPath('dry_run', true);

        config([
            'services.erp.enabled' => true,
            'services.erp.base_url' => 'https://erp-sandbox.example.test',
            'services.erp.token' => 'erp-token-tests',
            'services.erp.distributor_endpoint' => '/liquidaciones/distribuidor',
            'services.erp.billing_endpoint' => '/liquidaciones/facturacion',
        ]);

        Http::fake([
            'https://erp-sandbox.example.test/liquidaciones/distribuidor' => Http::response([
                'message' => 'Distribuidor confirmado',
                'erpRequestId' => 'ERP-REQ-DIST-1',
                'erpBatchId' => 'ERP-BATCH-1',
            ], 200),
            'https://erp-sandbox.example.test/liquidaciones/facturacion' => Http::response([
                'message' => 'Facturación confirmada',
                'erpRequestId' => 'ERP-REQ-BILL-1',
                'erpBatchId' => 'ERP-BATCH-1',
            ], 200),
        ]);

        $this->postJson('/api/liquidaciones/runs/' . $runId . '/publicar-erp', [
            'queue' => false,
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.status', 'CONFIRMED')
            ->assertJsonPath('run.status', 'PUBLICADA');

        $this->assertDatabaseHas('liq_publish_jobs', [
            'run_id' => $runId,
            'status' => 'CONFIRMED',
        ]);

        $this->assertDatabaseHas('liq_import_runs', [
            'id' => $runId,
            'status' => 'PUBLICADA',
        ]);
    }

    public function test_it_queues_real_publish_when_queue_mode_is_enabled(): void
    {
        $headers = $this->authHeaders();
        Queue::fake();

        config([
            'services.erp.enabled' => true,
            'services.erp.mock_mode' => true,
            'services.erp.queue_enabled' => true,
            'services.erp.publish_queue' => 'erp-publish',
        ]);

        $createResponse = $this->postJson('/api/liquidaciones/runs', [
            'client_code' => 'CLIENTE-Q',
            'status' => 'APPROVED',
            'staging_rows' => [
                [
                    'row_number' => 1,
                    'domain_norm' => 'QQQ111',
                    'distributor_code' => 'DIST-Q',
                    'distributor_name' => 'Distribuidor Queue',
                    'validation_status' => 'OK',
                    'liters' => 15,
                    'amount' => 15500,
                ],
            ],
        ], $headers)->assertCreated();

        $runId = (int) $createResponse->json('data.id');

        $this->postJson('/api/liquidaciones/runs/' . $runId . '/publicar-erp', [
            'dry_run' => false,
            'queue' => true,
        ], $headers)
            ->assertStatus(202)
            ->assertJsonPath('queued', true)
            ->assertJsonPath('data.status', 'QUEUED');

        Queue::assertPushed(ProcessLiquidacionPublishJob::class, function (ProcessLiquidacionPublishJob $job) use ($runId) {
            return $job->publishJobId > 0 && $job->actorUserId !== null;
        });
    }

    public function test_it_uploads_extract_and_maps_product_from_column_v(): void
    {
        $headers = $this->authHeaders();

        DB::table('personas')->insert([
            'apellidos' => 'PEREZ',
            'nombres' => 'JUAN',
            'cuil' => '20999888777',
            'patente' => 'AA123BB',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $headersRow = [
            'Fecha',
            'Estacion',
            'Dominio',
            'Litros',
            'Importe',
            'Precio/Litro',
            'Conductor',
            'Nro. Factura',
            'I',
            'J',
            'K',
            'L',
            'M',
            'N',
            'O',
            'P',
            'Q',
            'R',
            'S',
            'T',
            'U',
            'Columna V',
            'W',
            'Producto',
        ];

        $rowOne = [
            '01/02/2026',
            'YPF Centro',
            'AA123BB',
            '40.5',
            '51000.25',
            '1259.26',
            'Juan Perez',
            'FAC-100',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            'Diesel V',
            '',
            'Nafta X',
        ];

        $rowTwo = [
            '01/02/2026',
            'YPF Centro',
            'AA123BB',
            '40.5',
            '51000.25',
            '1259.26',
            'Juan Perez',
            'FAC-101',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            'Diesel V',
            '',
            'Nafta X',
        ];

        $csv = implode("\n", [
            implode(',', $headersRow),
            implode(',', $rowOne),
            implode(',', $rowTwo),
        ]) . "\n";

        $extract = UploadedFile::fake()->createWithContent('extracto-cliente.csv', $csv);

        $response = $this->post('/api/liquidaciones/runs/upload', [
            'source_system' => 'powerbi',
            'client_code' => 'INTERMEDIO',
            'period_from' => '2026-02-01',
            'period_to' => '2026-02-28',
            'status' => 'RECEIVED',
            'extract_file' => $extract,
        ], $headers);

        $response
            ->assertCreated()
            ->assertJsonPath('data.clientCode', 'INTERMEDIO')
            ->assertJsonPath('data.status', 'PRELIQUIDACION')
            ->assertJsonPath('data.rowsTotal', 2)
            ->assertJsonPath('data.rowsOk', 1)
            ->assertJsonPath('data.rowsDiff', 1)
            ->assertJsonPath('data.rowsError', 0);

        $runId = (int) $response->json('data.id');

        $this->assertDatabaseHas('liq_staging_rows', [
            'run_id' => $runId,
            'row_number' => 1,
            'product' => 'Diesel V',
            'validation_status' => 'OK',
        ]);

        $this->assertDatabaseHas('liq_staging_rows', [
            'run_id' => $runId,
            'row_number' => 2,
            'product' => 'Diesel V',
            'validation_status' => 'DIFERENCIA',
            'is_duplicate' => 1,
        ]);

        $this->assertDatabaseHas('liq_validation_results', [
            'run_id' => $runId,
            'rule_code' => 'DUPLICATE_ROW',
            'severity' => 'WARNING',
            'result' => 'FAIL',
        ]);
    }

    public function test_it_previews_extract_and_reports_product_column_v(): void
    {
        $headers = $this->authHeaders();

        $headersRow = [
            'Fecha',
            'Estacion',
            'Dominio',
            'Litros',
            'Importe',
            'Precio/Litro',
            'Conductor',
            'Nro. Factura',
            'I',
            'J',
            'K',
            'L',
            'M',
            'N',
            'O',
            'P',
            'Q',
            'R',
            'S',
            'T',
            'U',
            'Columna V',
            'W',
            'Producto',
        ];

        $row = [
            '01/02/2026',
            'YPF Centro',
            'AA123BB',
            '40.5',
            '51000.25',
            '1259.26',
            'Juan Perez',
            'FAC-100',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            'Diesel V',
            '',
            'Nafta X',
        ];

        $csv = implode("\n", [
            implode(',', $headersRow),
            implode(',', $row),
        ]) . "\n";

        $extract = UploadedFile::fake()->createWithContent('preview-extracto.csv', $csv);

        $this->post('/api/liquidaciones/runs/upload-preview', [
            'extract_file' => $extract,
            'format' => 'custom',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('mapped', true)
            ->assertJsonPath('productColumn', 'V')
            ->assertJsonPath('sampleRows.0.producto', 'Diesel V')
            ->assertJsonPath('rowCount', 1);
    }

    public function test_it_upserts_and_reads_client_rules(): void
    {
        $headers = $this->authHeaders();

        $this->putJson('/api/liquidaciones/reglas-cliente/intermedio', [
            'active' => true,
            'rules' => [
                'blocking_rules' => [
                    'duplicate_row' => true,
                    'outside_period' => true,
                    'tariff_mismatch' => true,
                ],
                'tolerances' => [
                    'price_per_liter_percent' => 1.5,
                    'price_per_liter_amount' => 5,
                ],
                'tariffs' => [
                    [
                        'product' => 'Diesel V',
                        'price_per_liter' => 1200,
                        'tolerance_percent' => 1,
                    ],
                ],
            ],
            'note' => 'Reglas piloto',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.clientCode', 'INTERMEDIO')
            ->assertJsonPath('data.source', 'client')
            ->assertJsonPath('data.resolvedRules.blocking_rules.tariff_mismatch', true);

        $this->getJson('/api/liquidaciones/reglas-cliente/Intermedio', $headers)
            ->assertOk()
            ->assertJsonPath('data.exists', true)
            ->assertJsonPath('data.clientCode', 'INTERMEDIO')
            ->assertJsonPath('data.source', 'client')
            ->assertJsonPath('data.resolvedRules.tolerances.price_per_liter_percent', 1.5);
    }

    public function test_it_applies_client_tariff_rules_during_upload_validation(): void
    {
        $headers = $this->authHeaders();

        $this->putJson('/api/liquidaciones/reglas-cliente/intermedio', [
            'active' => true,
            'rules' => [
                'blocking_rules' => [
                    'tariff_mismatch' => true,
                ],
                'tolerances' => [
                    'price_per_liter_percent' => 1,
                    'price_per_liter_amount' => 5,
                ],
                'tariffs' => [
                    [
                        'product' => 'Diesel V',
                        'price_per_liter' => 1200,
                        'effective_from' => '2026-02-01',
                        'effective_to' => '2026-02-28',
                    ],
                ],
            ],
        ], $headers)->assertOk();

        $headersRow = [
            'Fecha',
            'Estacion',
            'Dominio',
            'Litros',
            'Importe',
            'Precio/Litro',
            'Conductor',
            'Nro. Factura',
            'I',
            'J',
            'K',
            'L',
            'M',
            'N',
            'O',
            'P',
            'Q',
            'R',
            'S',
            'T',
            'U',
            'Columna V',
            'W',
            'Producto',
        ];

        $row = [
            '10/02/2026',
            'YPF Centro',
            'AA123BB',
            '40.0',
            '60000',
            '1500',
            'Juan Perez',
            'FAC-900',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            'Diesel V',
            '',
            'Nafta X',
        ];

        $csv = implode("\n", [
            implode(',', $headersRow),
            implode(',', $row),
        ]) . "\n";

        $extract = UploadedFile::fake()->createWithContent('extracto-tarifa.csv', $csv);

        $response = $this->post('/api/liquidaciones/runs/upload', [
            'source_system' => 'powerbi',
            'client_code' => 'Intermedio',
            'period_from' => '2026-02-01',
            'period_to' => '2026-02-28',
            'status' => 'RECEIVED',
            'extract_file' => $extract,
        ], $headers);

        $response
            ->assertCreated()
            ->assertJsonPath('data.clientCode', 'Intermedio')
            ->assertJsonPath('data.rowsTotal', 1)
            ->assertJsonPath('data.rowsError', 1)
            ->assertJsonPath('data.rowsOk', 0);

        $runId = (int) $response->json('data.id');

        $this->assertDatabaseHas('liq_staging_rows', [
            'run_id' => $runId,
            'row_number' => 1,
            'product' => 'Diesel V',
            'validation_status' => 'ERROR_CRITICO',
        ]);

        $this->assertDatabaseHas('liq_validation_results', [
            'run_id' => $runId,
            'rule_code' => 'TARIFF_CLIENT',
            'severity' => 'CRITICAL',
            'result' => 'FAIL',
        ]);
    }

    public function test_it_blocks_approval_when_provider_match_is_pending(): void
    {
        $headers = $this->authHeaders();

        $createResponse = $this->postJson('/api/liquidaciones/runs', [
            'client_code' => 'INTERMEDIO',
            'status' => 'PRELIQUIDACION',
            'staging_rows' => [
                [
                    'row_number' => 1,
                    'domain_norm' => 'AA123BB',
                    'validation_status' => 'OK',
                    'match_status' => 'PENDIENTE_ASIGNACION',
                    'liters' => 10,
                    'amount' => 10000,
                ],
            ],
        ], $headers)->assertCreated();

        $runId = (int) $createResponse->json('data.id');

        $this->postJson('/api/liquidaciones/runs/' . $runId . '/approve', [], $headers)
            ->assertStatus(422)
            ->assertJsonPath('message', 'No se puede aprobar: hay filas con proveedor pendiente de asignación.');
    }

    public function test_it_assigns_provider_and_updates_patente_and_aliases(): void
    {
        $headers = $this->authHeaders();

        $providerId = DB::table('personas')->insertGetId([
            'apellidos' => 'TABOADA',
            'nombres' => 'MALCOM FRANCO HEREDIA',
            'cuil' => '20111222333',
            'patente' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $createResponse = $this->postJson('/api/liquidaciones/runs', [
            'client_code' => 'INTERMEDIO',
            'status' => 'PRELIQUIDACION',
            'staging_rows' => [
                [
                    'row_number' => 1,
                    'domain_norm' => 'AA123BB',
                    'conductor' => 'Malcom Franco Heredia Taboada',
                    'name_excel_raw' => 'Malcom Franco Heredia Taboada',
                    'name_excel_norm' => 'MALCOM FRANCO HEREDIA TABOADA',
                    'validation_status' => 'ALERTA',
                    'match_status' => 'PENDIENTE_ASIGNACION',
                    'liters' => 10,
                    'amount' => 10000,
                ],
            ],
            'validation_results' => [
                [
                    'row_number' => 1,
                    'rule_code' => 'PROVIDER_MATCH_PENDING',
                    'severity' => 'WARNING',
                    'result' => 'FAIL',
                    'message' => 'Proveedor pendiente',
                ],
            ],
        ], $headers)->assertCreated();

        $runId = (int) $createResponse->json('data.id');

        $this->postJson('/api/liquidaciones/importaciones/' . $runId . '/asignar-proveedor', [
            'patente_norm' => 'AA123BB',
            'nombre_excel_norm' => 'MALCOM FRANCO HEREDIA TABOADA',
            'proveedor_id' => $providerId,
            'actualizar_patente_en_proveedor' => true,
            'sobreescribir_patente_existente' => false,
            'motivo' => 'Match manual por nombre',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('patente_actualizada', true)
            ->assertJsonPath('alias_guardado', true);

        $this->assertDatabaseHas('personas', [
            'id' => $providerId,
            'patente' => 'AA123BB',
        ]);

        $this->assertDatabaseHas('liq_client_identifier_aliases', [
            'client_code' => 'INTERMEDIO',
            'alias_type' => 'PATENTE',
            'alias_norm' => 'AA123BB',
            'provider_persona_id' => $providerId,
            'active' => 1,
        ]);

        $this->assertDatabaseHas('liq_staging_rows', [
            'run_id' => $runId,
            'domain_norm' => 'AA123BB',
            'distributor_id' => $providerId,
            'match_status' => 'MANUAL_CONFIRMED',
            'validation_status' => 'OK',
        ]);
    }

    public function test_it_searches_providers_for_manual_assignment(): void
    {
        $headers = $this->authHeaders();

        $providerPatenteId = DB::table('personas')->insertGetId([
            'apellidos' => 'AVELLANEDA',
            'nombres' => 'GONZALO DAVID',
            'cuil' => '2037060985',
            'patente' => 'AH701JS',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('personas')->insert([
            'apellidos' => 'TABOADA',
            'nombres' => 'MALCOM FRANCO HEREDIA',
            'cuil' => '20111222333',
            'patente' => 'PLP086',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->getJson('/api/liquidaciones/proveedores/buscar?q=AH701JS', $headers)
            ->assertOk()
            ->assertJsonPath('data.0.id', $providerPatenteId)
            ->assertJsonPath('data.0.patente', 'AH701JS');

        $this->getJson('/api/liquidaciones/proveedores/buscar?q=GONZALO%20AVELLANEDA', $headers)
            ->assertOk()
            ->assertJsonPath('data.0.id', $providerPatenteId)
            ->assertJsonPath('data.0.cuil', '2037060985');
    }
}

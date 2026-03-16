<?php

namespace Tests\Feature;

use App\Models\ArcaCertificado;
use App\Models\ArcaEmisor;
use App\Models\ArcaPuntoVenta;
use App\Models\Cliente;
use App\Models\FacturaCabecera;
use App\Models\Sucursal;
use App\Models\User;
use App\Services\Arca\Wsaa\TaCacheService;
use App\Services\Arca\Wsaa\WsaaToken;
use App\Services\Arca\Wsfe\WsfeClient;
use Carbon\CarbonImmutable;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class FacturacionFlowTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->artisan('migrate', [
            '--path' => 'database/migrations/0001_01_01_000000_create_users_table.php',
            '--realpath' => false,
        ])->assertExitCode(0);

        if (! Schema::hasColumn('users', 'role')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('role')->nullable();
            });
        }

        if (! Schema::hasColumn('users', 'permissions')) {
            Schema::table('users', function (Blueprint $table) {
                $table->json('permissions')->nullable();
            });
        }

        if (! Schema::hasTable('clientes')) {
            Schema::create('clientes', function (Blueprint $table) {
                $table->id();
                $table->string('codigo')->nullable();
                $table->string('nombre')->nullable();
                $table->string('direccion')->nullable();
                $table->string('documento_fiscal')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('sucursals')) {
            Schema::create('sucursals', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('cliente_id')->nullable();
                $table->string('nombre')->nullable();
                $table->string('direccion')->nullable();
                $table->string('encargado_deposito')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        $migrationPaths = [
            'database/migrations/2026_03_16_000001_create_arca_facturacion_core_tables.php',
            'database/migrations/2026_03_16_000002_create_factura_cabecera_table.php',
            'database/migrations/2026_03_16_000003_create_factura_support_tables.php',
            'database/migrations/2026_03_16_000004_create_vw_clientes_facturacion_consolidado.php',
        ];

        foreach ($migrationPaths as $path) {
            $this->artisan('migrate', [
                '--path' => $path,
                '--realpath' => false,
            ])->assertExitCode(0);
        }

        config(['services.arca.storage_disk' => 'local']);
        Storage::fake('local');

        $this->bindFakes();
    }

    private function bindFakes(): void
    {
        $this->app->instance(TaCacheService::class, new class extends TaCacheService {
            public function __construct()
            {
            }

            public function getValidTa(\App\Models\ArcaCertificado $certificado, string $serviceName = 'wsfe'): WsaaToken
            {
                $now = CarbonImmutable::now('UTC');

                return new WsaaToken('token-test', 'sign-test', $now, $now->addHour(), '<ta/>');
            }
        });

        $this->app->instance(WsfeClient::class, new class extends WsfeClient {
            public function __construct()
            {
            }

            public function paramGetPtosVenta(\App\Models\ArcaCertificado $certificado, ?\App\Services\Arca\Wsaa\WsaaToken $token = null): array
            {
                return [
                    'points' => [
                        ['Nro' => 11, 'Bloqueado' => 'N', 'FchBaja' => null, 'EmisionTipo' => 'RECE'],
                        ['Nro' => 12, 'Bloqueado' => 'N', 'FchBaja' => null, 'EmisionTipo' => 'RECE'],
                    ],
                    'request_xml' => '<request/>',
                    'response_xml' => '<response/>',
                ];
            }

            public function compUltimoAutorizado(\App\Models\ArcaCertificado $certificado, int $ptoVta, int $cbteTipo, ?\App\Services\Arca\Wsaa\WsaaToken $token = null): array
            {
                return [
                    'cbte_nro' => 0,
                    'errors' => [],
                    'events' => [],
                    'request_xml' => '<request/>',
                    'response_xml' => '<response/>',
                ];
            }

            public function caeSolicitar(\App\Models\ArcaCertificado $certificado, array $request, ?\App\Services\Arca\Wsaa\WsaaToken $token = null): array
            {
                return [
                    'resultado' => 'A',
                    'cae' => '12345678901234',
                    'cae_vto' => '20300101',
                    'cbte_desde' => 1,
                    'cbte_hasta' => 1,
                    'observaciones' => [],
                    'errores' => [],
                    'eventos' => [],
                    'raw' => [],
                    'request_xml' => '<request/>',
                    'response_xml' => '<response/>',
                ];
            }
        });
    }

    /**
     * @return array{0:User,1:array<string,string>}
     */
    private function createAuthUser(): array
    {
        $plainToken = 'token-facturacion-' . Str::random(12);
        $email = 'admin.facturacion+' . Str::random(6) . '@example.com';
        $user = User::query()->create([
            'name' => 'Admin Test',
            'email' => $email,
            'password' => bcrypt('secret123'),
            'role' => 'admin',
            'permissions' => ['facturacion'],
        ]);

        $user->forceFill([
            'remember_token' => hash('sha256', $plainToken),
        ])->save();

        return [$user, $this->authHeaders($plainToken)];
    }

    /**
     * @return array<string,string>
     */
    private function authHeaders(string $plainToken): array
    {
        return [
            'Accept' => 'application/json',
            'X-Api-Token' => $plainToken,
        ];
    }

    private function seedCliente(): array
    {
        $cliente = Cliente::query()->create([
            'codigo' => 'C-01',
            'nombre' => 'Cliente Test',
            'direccion' => 'Calle 123',
            'documento_fiscal' => '30717060985',
        ]);

        $sucursal = Sucursal::query()->create([
            'cliente_id' => $cliente->id,
            'nombre' => 'Casa Central',
            'direccion' => 'Calle 123',
            'encargado_deposito' => 'Encargado',
        ]);

        return [$cliente, $sucursal];
    }

    private function seedArca(): array
    {
        $emisor = ArcaEmisor::query()->create([
            'razon_social' => 'LOGISTICA ARGENTINA S.R.L.',
            'cuit' => 30717060985,
            'condicion_iva' => 'IVA Responsable Inscripto',
            'ambiente_default' => 'PROD',
            'activo' => true,
        ]);

        $certificado = ArcaCertificado::query()->create([
            'emisor_id' => $emisor->id,
            'alias' => 'cert-test',
            'ambiente' => 'PROD',
            'activo' => true,
            'valid_from' => now()->subDay(),
            'valid_to' => now()->addYear(),
        ]);

        $puntoVenta = ArcaPuntoVenta::query()->create([
            'emisor_id' => $emisor->id,
            'ambiente' => 'PROD',
            'nro' => 11,
            'sistema_arca' => 'RECE',
            'emision_tipo' => 'RECE',
            'bloqueado' => false,
            'habilitado_para_erp' => true,
        ]);

        return [$emisor, $certificado, $puntoVenta];
    }

    private function buildPayload(int $emisorId, int $clienteId, int $sucursalId, bool $withServiceDates = true): array
    {
        $payload = [
            'emisor_id' => $emisorId,
            'ambiente' => 'PROD',
            'pto_vta' => 11,
            'cbte_tipo' => 1,
            'concepto' => 2,
            'doc_tipo' => 80,
            'doc_nro' => 30717060985,
            'cliente_id' => $clienteId,
            'sucursal_id' => $sucursalId,
            'cliente_nombre' => 'Cliente Test',
            'cliente_domicilio' => 'Calle 123',
            'fecha_cbte' => now()->format('Y-m-d'),
            'moneda_id' => 'PES',
            'moneda_cotiz' => 1,
            'imp_total' => 121.0,
            'imp_tot_conc' => 0,
            'imp_neto' => 100.0,
            'imp_op_ex' => 0,
            'imp_iva' => 21.0,
            'imp_trib' => 0,
            'anio_facturado' => (int) now()->format('Y'),
            'mes_facturado' => (int) now()->format('m'),
            'periodo_facturado' => 'MES_COMPLETO',
            'fecha_aprox_cobro' => now()->addDays(10)->format('Y-m-d'),
            'iva' => [
                [
                    'iva_id' => 5,
                    'base_imp' => 100.0,
                    'importe' => 21.0,
                ],
            ],
            'detalle_pdf' => [
                [
                    'orden' => 1,
                    'descripcion' => 'Servicio logistica',
                    'cantidad' => 1,
                    'unidad_medida' => 'servicio',
                    'precio_unitario' => 100.0,
                    'bonificacion_pct' => 0,
                    'subtotal' => 100.0,
                    'alicuota_iva_pct' => 21,
                    'subtotal_con_iva' => 121.0,
                ],
            ],
        ];

        if ($withServiceDates) {
            $payload['fecha_serv_desde'] = now()->startOfMonth()->format('Y-m-d');
            $payload['fecha_serv_hasta'] = now()->endOfMonth()->format('Y-m-d');
            $payload['fecha_vto_pago'] = now()->addDays(30)->format('Y-m-d');
        }

        return $payload;
    }

    public function test_crea_borrador_valido(): void
    {
        [, $headers] = $this->createAuthUser();
        [$cliente, $sucursal] = $this->seedCliente();
        [$emisor] = $this->seedArca();

        $payload = $this->buildPayload($emisor->id, $cliente->id, $sucursal->id);

        $response = $this->postJson('/api/facturas', $payload, $headers);

        $response
            ->assertCreated()
            ->assertJsonPath('data.estado', 'BORRADOR')
            ->assertJsonPath('data.cliente_id', $cliente->id);

        $this->assertDatabaseHas('factura_cabecera', [
            'cliente_id' => $cliente->id,
            'sucursal_id' => $sucursal->id,
            'estado' => 'BORRADOR',
        ]);
    }

    public function test_rechaza_borrador_si_falta_cliente(): void
    {
        [, $headers] = $this->createAuthUser();
        [$cliente, $sucursal] = $this->seedCliente();
        [$emisor] = $this->seedArca();

        $payload = $this->buildPayload($emisor->id, $cliente->id, $sucursal->id);
        unset($payload['cliente_id']);

        $this->postJson('/api/facturas', $payload, $headers)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['cliente_id']);
    }

    public function test_rechaza_borrador_si_falta_sucursal(): void
    {
        [, $headers] = $this->createAuthUser();
        [$cliente, $sucursal] = $this->seedCliente();
        [$emisor] = $this->seedArca();

        $payload = $this->buildPayload($emisor->id, $cliente->id, $sucursal->id);
        unset($payload['sucursal_id']);

        $this->postJson('/api/facturas', $payload, $headers)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['sucursal_id']);
    }

    public function test_rechaza_borrador_si_falta_periodo(): void
    {
        [, $headers] = $this->createAuthUser();
        [$cliente, $sucursal] = $this->seedCliente();
        [$emisor] = $this->seedArca();

        $payload = $this->buildPayload($emisor->id, $cliente->id, $sucursal->id);
        unset($payload['anio_facturado'], $payload['mes_facturado'], $payload['periodo_facturado']);

        $this->postJson('/api/facturas', $payload, $headers)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['anio_facturado', 'mes_facturado', 'periodo_facturado']);
    }

    public function test_rechaza_validacion_si_falta_fechas_servicio(): void
    {
        [, $headers] = $this->createAuthUser();
        [$cliente, $sucursal] = $this->seedCliente();
        [$emisor] = $this->seedArca();

        $payload = $this->buildPayload($emisor->id, $cliente->id, $sucursal->id, false);
        $create = $this->postJson('/api/facturas', $payload, $headers)->assertCreated();

        $facturaId = (int) $create->json('data.id');

        $this->postJson('/api/facturas/' . $facturaId . '/validar', [], $headers)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['fecha_serv_desde', 'fecha_serv_hasta', 'fecha_vto_pago']);
    }

    public function test_emite_factura_y_genera_pdf_y_xml(): void
    {
        [, $headers] = $this->createAuthUser();
        [$cliente, $sucursal] = $this->seedCliente();
        [$emisor] = $this->seedArca();

        $payload = $this->buildPayload($emisor->id, $cliente->id, $sucursal->id);
        $create = $this->postJson('/api/facturas', $payload, $headers)->assertCreated();
        $facturaId = (int) $create->json('data.id');

        $emit = $this->postJson('/api/facturas/' . $facturaId . '/emitir', [], $headers)
            ->assertOk()
            ->assertJsonPath('data.estado', 'PDF_GENERADO')
            ->assertJsonPath('data.cae', '12345678901234');

        $pdfUrl = $emit->json('data.pdf_url');
        $xmlRequestUrl = $emit->json('data.xml_request_url');
        $xmlResponseUrl = $emit->json('data.xml_response_url');

        $factura = FacturaCabecera::query()->findOrFail($facturaId);
        $this->assertNotNull($factura->pdf_path);
        $this->assertNotNull($factura->request_xml_path);
        $this->assertNotNull($factura->response_xml_path);
        Storage::disk('local')->assertExists($factura->pdf_path);
        Storage::disk('local')->assertExists($factura->request_xml_path);
        Storage::disk('local')->assertExists($factura->response_xml_path);
        $this->assertNotEmpty($pdfUrl);
        $this->assertNotEmpty($xmlRequestUrl);
        $this->assertNotEmpty($xmlResponseUrl);
    }

    public function test_idempotencia_reutiliza_factura_autorizada(): void
    {
        [, $headers] = $this->createAuthUser();
        [$cliente, $sucursal] = $this->seedCliente();
        [$emisor] = $this->seedArca();

        $payload = $this->buildPayload($emisor->id, $cliente->id, $sucursal->id);
        $first = $this->postJson('/api/facturas', $payload, $headers)->assertCreated();
        $firstId = (int) $first->json('data.id');

        $firstEmit = $this->postJson('/api/facturas/' . $firstId . '/emitir', [], $headers)
            ->assertOk()
            ->assertJsonPath('data.estado', 'PDF_GENERADO');

        $this->postJson('/api/facturas', $payload, $headers)
            ->assertStatus(409);

        $reused = $this->postJson('/api/facturas/' . $firstId . '/emitir', [], $headers)->assertOk();

        $this->assertSame($firstId, (int) $reused->json('data.id'));
        $this->assertSame($firstEmit->json('data.cae'), $reused->json('data.cae'));
    }

    public function test_actualiza_cobranza_y_registra_pago(): void
    {
        [, $headers] = $this->createAuthUser();
        [$cliente, $sucursal] = $this->seedCliente();
        [$emisor] = $this->seedArca();

        $payload = $this->buildPayload($emisor->id, $cliente->id, $sucursal->id);
        $create = $this->postJson('/api/facturas', $payload, $headers)->assertCreated();
        $facturaId = (int) $create->json('data.id');

        $this->postJson('/api/facturas/' . $facturaId . '/actualizar-cobranza', [
            'fecha_aprox_cobro' => now()->addDays(5)->format('Y-m-d'),
        ], $headers)->assertOk()->assertJsonPath('data.estado_cobranza', 'A_VENCER');

        $this->postJson('/api/facturas/' . $facturaId . '/registrar-pago', [
            'fecha_pago_manual' => now()->addDays(6)->format('Y-m-d'),
            'monto_pagado_manual' => 121.0,
        ], $headers)->assertOk()->assertJsonPath('data.estado_cobranza', 'COBRADA');
    }

    public function test_descarga_pdf_y_xml(): void
    {
        [, $headers] = $this->createAuthUser();
        [$cliente, $sucursal] = $this->seedCliente();
        [$emisor] = $this->seedArca();

        $payload = $this->buildPayload($emisor->id, $cliente->id, $sucursal->id);
        $create = $this->postJson('/api/facturas', $payload, $headers)->assertCreated();
        $facturaId = (int) $create->json('data.id');

        $this->postJson('/api/facturas/' . $facturaId . '/emitir', [], $headers)->assertOk();

        $this->get('/api/facturas/' . $facturaId . '/pdf', $headers)->assertOk();
        $this->get('/api/facturas/' . $facturaId . '/xml-request', $headers)->assertOk();
        $this->get('/api/facturas/' . $facturaId . '/xml-response', $headers)->assertOk();
    }

    public function test_estado_cobranza_vencida(): void
    {
        [, $headers] = $this->createAuthUser();
        [$cliente, $sucursal] = $this->seedCliente();
        [$emisor] = $this->seedArca();

        $payload = $this->buildPayload($emisor->id, $cliente->id, $sucursal->id);
        $create = $this->postJson('/api/facturas', $payload, $headers)->assertCreated();
        $facturaId = (int) $create->json('data.id');

        $this->postJson('/api/facturas/' . $facturaId . '/actualizar-cobranza', [
            'fecha_aprox_cobro' => now()->subDays(3)->format('Y-m-d'),
            'fecha_pago_manual' => null,
        ], $headers)->assertOk()->assertJsonPath('data.estado_cobranza', 'VENCIDA');
    }

    public function test_resumen_clientes_facturacion(): void
    {
        [, $headers] = $this->createAuthUser();
        [$cliente, $sucursal] = $this->seedCliente();
        [$emisor] = $this->seedArca();

        $payload = $this->buildPayload($emisor->id, $cliente->id, $sucursal->id);
        $create = $this->postJson('/api/facturas', $payload, $headers)->assertCreated();
        $facturaId = (int) $create->json('data.id');
        $this->postJson('/api/facturas/' . $facturaId . '/emitir', [], $headers)->assertOk();

        $this->getJson('/api/clientes-facturacion/resumen?cliente_id=' . $cliente->id, $headers)
            ->assertOk()
            ->assertJsonPath('data.0.cliente_id', $cliente->id);
    }

    public function test_sincroniza_puntos_venta_y_prueba_wsaa(): void
    {
        [, $headers] = $this->createAuthUser();
        [$emisor, $certificado] = $this->seedArca();

        $this->postJson('/api/arca/emisores/' . $emisor->id . '/puntos-venta/sincronizar', [
            'ambiente' => 'PROD',
        ], $headers)->assertOk();

        $this->assertDatabaseHas('arca_punto_venta', [
            'emisor_id' => $emisor->id,
            'nro' => 11,
        ]);

        $this->postJson('/api/arca/emisores/' . $emisor->id . '/certificados/test-wsaa', [
            'ambiente' => 'PROD',
            'certificado_id' => $certificado->id,
        ], $headers)->assertOk();
    }
}

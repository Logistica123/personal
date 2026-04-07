<?php

namespace Tests\Feature;

use App\Models\Archivo;
use App\Models\Dueno;
use App\Models\Factura;
use App\Models\FileType;
use App\Models\Persona;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PersonalLiquidacionesEndpointTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $migrationPaths = [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/2025_10_24_132731_create_personas_table.php',
        ];

        foreach ($migrationPaths as $path) {
            $this->artisan('migrate', [
                '--path' => $path,
                '--realpath' => false,
            ])->assertExitCode(0);
        }

        if (! Schema::hasTable('duenos')) {
            Schema::create('duenos', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('persona_id')->index();
                $table->string('email')->nullable();
                $table->string('cuil')->nullable();
                $table->string('cuil_cobrador')->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->timestamps();
            });
        } else {
            if (! Schema::hasColumn('duenos', 'cuil')) {
                Schema::table('duenos', fn (Blueprint $table) => $table->string('cuil')->nullable());
            }
            if (! Schema::hasColumn('duenos', 'cuil_cobrador')) {
                Schema::table('duenos', fn (Blueprint $table) => $table->string('cuil_cobrador')->nullable());
            }
        }

        if (! Schema::hasTable('fyle_types')) {
            Schema::create('fyle_types', function (Blueprint $table) {
                $table->id();
                $table->string('nombre')->nullable();
                $table->boolean('vence')->default(false);
                $table->timestamp('deleted_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('archivos')) {
            Schema::create('archivos', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('persona_id')->nullable()->index();
                $table->unsignedBigInteger('parent_document_id')->nullable()->index();
                $table->unsignedBigInteger('liquidacion_id')->nullable()->index();
                $table->boolean('es_pendiente')->default(false);
                $table->unsignedBigInteger('tipo_archivo_id')->nullable()->index();
                $table->string('carpeta')->nullable();
                $table->string('ruta')->nullable();
                $table->text('download_url')->nullable();
                $table->string('disk')->nullable();
                $table->string('nombre_original')->nullable();
                $table->string('mime')->nullable();
                $table->unsignedBigInteger('size')->nullable();
                $table->date('fecha_vencimiento')->nullable();
                $table->string('fortnight_key')->nullable();
                $table->decimal('importe_facturar', 12, 2)->nullable();
                $table->boolean('enviada')->default(false);
                $table->boolean('recibido')->default(false);
                $table->boolean('pagado')->default(false);
                $table->string('liquidacion_destinatario_tipo')->nullable();
                $table->json('liquidacion_destinatario_emails')->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('facturas')) {
            Schema::create('facturas', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('liquidacion_id')->nullable()->index();
                $table->unsignedBigInteger('persona_id')->nullable()->index();
                $table->string('estado')->nullable();
                $table->string('decision_motivo')->nullable();
                $table->text('decision_mensaje')->nullable();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('personas')) {
            if (! Schema::hasColumn('personas', 'cobrador_email')) {
                Schema::table('personas', fn (Blueprint $table) => $table->string('cobrador_email')->nullable());
            }
            if (! Schema::hasColumn('personas', 'cobrador_cuil')) {
                Schema::table('personas', fn (Blueprint $table) => $table->string('cobrador_cuil')->nullable());
            }
        }
    }

    public function test_liquidaciones_endpoint_includes_period_and_ai_validation_fields(): void
    {
        $persona = Persona::query()->create([
            'nombres' => 'Esteban',
            'apellidos' => 'Cortez',
            'email' => 'esteban@example.com',
            'cuil' => '20-12345678-9',
        ]);

        $tipoLiquidacion = FileType::query()->create([
            'nombre' => 'Liquidación',
            'vence' => false,
        ]);

        FileType::query()->create([
            'nombre' => 'Factura combustible',
            'vence' => false,
        ]);

        $doc = Archivo::create([
            'persona_id' => $persona->id,
            'parent_document_id' => null,
            'liquidacion_id' => null,
            'es_pendiente' => false,
            'tipo_archivo_id' => $tipoLiquidacion->id,
            'carpeta' => 'personal/' . $persona->id,
            'ruta' => 'personal/' . $persona->id . '/liquidacion-test.pdf',
            'download_url' => null,
            'disk' => 'public',
            'nombre_original' => 'Liquidación test.pdf',
            'mime' => 'application/pdf',
            'size' => 1234,
            'fecha_vencimiento' => '2026-03-01',
            'fortnight_key' => 'Q1',
            'importe_facturar' => 1000,
            'enviada' => true,
            'recibido' => false,
            'pagado' => false,
            'liquidacion_destinatario_tipo' => 'cobrador',
            'liquidacion_destinatario_emails' => ['cobrador@example.com'],
        ]);

        Factura::create([
            'liquidacion_id' => $doc->id,
            'persona_id' => $persona->id,
            'estado' => 'rechazada',
            'decision_motivo' => 'cuil_mismatch',
            'decision_mensaje' => 'El CUIL del emisor no coincide con el registrado.',
        ]);

        $actorCuil = '20123456789';
        $response = $this->getJson(
            sprintf('/api/personal/%d/liquidaciones?email=%s', $persona->id, urlencode($actorCuil)),
            ['Accept' => 'application/json']
        );

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $doc->id)
            ->assertJsonPath('data.0.monthKey', '2026-03')
            ->assertJsonPath('data.0.fortnightKey', 'Q1')
            ->assertJsonPath('data.0.validacionIaEstado', 'rechazada')
            ->assertJsonPath('data.0.validacionIaMotivo', 'cuil_mismatch')
            ->assertJsonPath('data.0.validacionIaMensaje', 'El CUIL del emisor no coincide con el registrado.');
    }

    public function test_liquidaciones_endpoint_honors_actor_email_header_for_recipient_filtering(): void
    {
        $persona = Persona::query()->create([
            'nombres' => 'Esteban',
            'apellidos' => 'Cortez',
            'email' => 'proveedor@example.com',
            'cuil' => '20-12345678-9',
        ]);

        Dueno::query()->create([
            'persona_id' => $persona->id,
            'email' => 'dueno@example.com',
        ]);

        $tipoLiquidacion = FileType::query()->create([
            'nombre' => 'Liquidación',
            'vence' => false,
        ]);

        $doc = Archivo::create([
            'persona_id' => $persona->id,
            'parent_document_id' => null,
            'liquidacion_id' => null,
            'es_pendiente' => false,
            'tipo_archivo_id' => $tipoLiquidacion->id,
            'carpeta' => 'personal/' . $persona->id,
            'ruta' => 'personal/' . $persona->id . '/liquidacion-test.pdf',
            'download_url' => null,
            'disk' => 'public',
            'nombre_original' => 'Liquidación test.pdf',
            'mime' => 'application/pdf',
            'size' => 1234,
            'fecha_vencimiento' => '2026-03-01',
            'fortnight_key' => 'Q1',
            'importe_facturar' => 1000,
            'enviada' => true,
            'recibido' => false,
            'pagado' => false,
            'liquidacion_destinatario_tipo' => 'proveedor',
            'liquidacion_destinatario_emails' => ['proveedor@example.com'],
        ]);

        $response = $this->getJson(
            sprintf('/api/personal/%d/liquidaciones', $persona->id),
            [
                'Accept' => 'application/json',
                'X-Actor-Email' => 'dueno@example.com',
            ]
        );

        $response
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_liquidaciones_endpoint_allows_public_post_with_actor_cuil(): void
    {
        $persona = Persona::query()->create([
            'nombres' => 'Esteban',
            'apellidos' => 'Cortez',
            'email' => 'esteban@example.com',
            'cuil' => '20-12345678-9',
        ]);

        $tipoLiquidacion = FileType::query()->create([
            'nombre' => 'Liquidación',
            'vence' => false,
        ]);

        $doc = Archivo::create([
            'persona_id' => $persona->id,
            'parent_document_id' => null,
            'liquidacion_id' => null,
            'es_pendiente' => false,
            'tipo_archivo_id' => $tipoLiquidacion->id,
            'carpeta' => 'personal/' . $persona->id,
            'ruta' => 'personal/' . $persona->id . '/liquidacion-test.pdf',
            'download_url' => null,
            'disk' => 'public',
            'nombre_original' => 'Liquidación test.pdf',
            'mime' => 'application/pdf',
            'size' => 1234,
            'fecha_vencimiento' => '2026-03-01',
            'fortnight_key' => 'Q1',
            'importe_facturar' => 1000,
            'enviada' => true,
            'recibido' => false,
            'pagado' => false,
        ]);

        $response = $this->postJson(
            sprintf('/api/personal/%d/liquidaciones', $persona->id),
            ['email' => '20123456789']
        );

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_liquidaciones_by_actor_endpoint_resolves_persona_by_cuil(): void
    {
        $persona = Persona::query()->create([
            'nombres' => 'Esteban',
            'apellidos' => 'Cortez',
            'email' => null,
            'cuil' => '20-12345678-9',
        ]);

        $tipoLiquidacion = FileType::query()->create([
            'nombre' => 'Liquidación',
            'vence' => false,
        ]);

        $doc = Archivo::create([
            'persona_id' => $persona->id,
            'parent_document_id' => null,
            'liquidacion_id' => null,
            'es_pendiente' => false,
            'tipo_archivo_id' => $tipoLiquidacion->id,
            'carpeta' => 'personal/' . $persona->id,
            'ruta' => 'personal/' . $persona->id . '/liquidacion-test.pdf',
            'download_url' => null,
            'disk' => 'public',
            'nombre_original' => 'Liquidación test.pdf',
            'mime' => 'application/pdf',
            'size' => 1234,
            'fecha_vencimiento' => '2026-03-01',
            'fortnight_key' => 'Q1',
            'importe_facturar' => 1000,
            'enviada' => true,
            'recibido' => false,
            'pagado' => false,
        ]);

        $response = $this->getJson('/api/personal/liquidaciones?email=20123456789');

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $doc->id);
    }
}

<?php

namespace Tests\Feature;

use App\Models\Persona;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PersonalApprovalPermissionsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $migrationPaths = [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/2025_10_24_132731_create_personas_table.php',
            'database/migrations/2025_10_24_140000_add_approval_fields_to_personas_table.php',
            'database/migrations/2025_10_30_000000_add_es_solicitud_to_personas_table.php',
            'database/migrations/2025_10_24_150500_create_persona_histories_table.php',
        ];

        foreach ($migrationPaths as $path) {
            $this->artisan('migrate', [
                '--path' => $path,
                '--realpath' => false,
            ])->assertExitCode(0);
        }

        if (!Schema::hasTable('clientes')) {
            Schema::create('clientes', function (Blueprint $table) {
                $table->id();
                $table->string('nombre')->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('sucursals')) {
            Schema::create('sucursals', function (Blueprint $table) {
                $table->id();
                $table->foreignId('cliente_id')->nullable();
                $table->string('nombre')->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('unidades')) {
            Schema::create('unidades', function (Blueprint $table) {
                $table->id();
                $table->string('matricula')->nullable();
                $table->string('marca')->nullable();
                $table->string('modelo')->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('estados')) {
            Schema::create('estados', function (Blueprint $table) {
                $table->id();
                $table->string('nombre')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('fyle_types')) {
            Schema::create('fyle_types', function (Blueprint $table) {
                $table->id();
                $table->string('nombre')->nullable();
                $table->boolean('vence')->default(false);
                $table->timestamp('deleted_at')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('archivos')) {
            Schema::create('archivos', function (Blueprint $table) {
                $table->id();
                $table->foreignId('persona_id')->nullable()->constrained('personas')->nullOnDelete();
                $table->unsignedBigInteger('parent_document_id')->nullable();
                $table->unsignedBigInteger('liquidacion_id')->nullable();
                $table->boolean('es_pendiente')->default(false);
                $table->unsignedBigInteger('tipo_archivo_id')->nullable();
                $table->string('nombre_original')->nullable();
                $table->string('mime')->nullable();
                $table->unsignedBigInteger('size')->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('duenos')) {
            Schema::create('duenos', function (Blueprint $table) {
                $table->id();
                $table->foreignId('persona_id')->constrained('personas')->cascadeOnDelete();
                $table->string('nombreapellido')->nullable();
                $table->string('email')->nullable();
                $table->string('cuil')->nullable();
                $table->string('cuil_cobrador')->nullable();
                $table->string('cbu_alias')->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('notifications')) {
            Schema::create('notifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('message')->nullable();
                $table->text('description')->nullable();
                $table->string('type')->nullable();
                $table->string('entity_type')->nullable();
                $table->unsignedBigInteger('entity_id')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamp('read_at')->nullable();
                $table->timestamps();
            });
        }

        if (DB::table('estados')->count() === 0) {
            DB::table('estados')->insert([
                'nombre' => 'Activo',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function test_any_authenticated_user_can_approve_pending_solicitud_personal(): void
    {
        $plainToken = 'token-tests-approve-solicitud';
        $user = User::factory()->create([
            'email' => 'approve.solicitud@example.com',
            'remember_token' => hash('sha256', $plainToken),
        ]);

        $persona = Persona::query()->create([
            'nombres' => 'Juan',
            'apellidos' => 'Perez',
            'aprobado' => false,
            'es_solicitud' => true,
            'estado_id' => 1,
        ]);

        $response = $this->postJson(
            sprintf('/api/personal/%d/aprobar', $persona->id),
            [
                'userId' => $user->id,
                'estadoId' => 1,
            ],
            [
                'Accept' => 'application/json',
                'Authorization' => 'Bearer '.$plainToken,
            ]
        );

        $response
            ->assertOk()
            ->assertJsonPath('data.aprobado', true)
            ->assertJsonPath('data.esSolicitud', false)
            ->assertJsonPath('data.aprobadoPorId', $user->id);

        $persona->refresh();
        $this->assertTrue((bool) $persona->aprobado);
        $this->assertFalse((bool) $persona->es_solicitud);
        $this->assertSame($user->id, $persona->aprobado_por);
    }
}

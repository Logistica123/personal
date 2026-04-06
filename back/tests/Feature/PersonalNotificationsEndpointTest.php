<?php

namespace Tests\Feature;

use App\Models\Dueno;
use App\Models\Persona;
use App\Models\PersonalNotification;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PersonalNotificationsEndpointTest extends TestCase
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

        if (Schema::hasTable('personas')) {
            if (! Schema::hasColumn('personas', 'cobrador_email')) {
                Schema::table('personas', fn (Blueprint $table) => $table->string('cobrador_email')->nullable());
            }
            if (! Schema::hasColumn('personas', 'cobrador_cuil')) {
                Schema::table('personas', fn (Blueprint $table) => $table->string('cobrador_cuil')->nullable());
            }
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

        if (! Schema::hasTable('personal_notifications')) {
            Schema::create('personal_notifications', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('persona_id')->index();
                $table->string('type');
                $table->string('title')->nullable();
                $table->text('message');
                $table->json('metadata')->nullable();
                $table->timestamp('read_at')->nullable();
                $table->timestamps();
            });
        }
    }

    public function test_personal_notifications_endpoint_accepts_actor_email_header(): void
    {
        $persona = Persona::query()->create([
            'nombres' => 'Esteban',
            'apellidos' => 'Cortez',
            'email' => 'esteban@example.com',
            'cuil' => '20-12345678-9',
        ]);

        PersonalNotification::query()->create([
            'persona_id' => $persona->id,
            'type' => 'liquidacion',
            'title' => 'Nueva liquidación disponible',
            'message' => 'Se cargó una nueva liquidación: Liquidación test.pdf',
            'metadata' => ['documentId' => 123],
        ]);

        $response = $this->getJson(
            sprintf('/api/personal/%d/notificaciones', $persona->id),
            [
                'Accept' => 'application/json',
                'X-Actor-Email' => 'esteban@example.com',
            ]
        );

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.type', 'liquidacion')
            ->assertJsonPath('data.0.metadata.documentId', 123);
    }

    public function test_personal_notifications_endpoint_accepts_actor_cuil_header(): void
    {
        $persona = Persona::query()->create([
            'nombres' => 'Esteban',
            'apellidos' => 'Cortez',
            'email' => 'esteban@example.com',
            'cuil' => '20-12345678-9',
        ]);

        PersonalNotification::query()->create([
            'persona_id' => $persona->id,
            'type' => 'liquidacion',
            'title' => 'Nueva liquidación disponible',
            'message' => 'Se cargó una nueva liquidación: Liquidación test.pdf',
            'metadata' => ['documentId' => 123],
        ]);

        $response = $this->getJson(
            sprintf('/api/personal/%d/notificaciones', $persona->id),
            [
                'Accept' => 'application/json',
                'X-Actor-Cuil' => '20123456789',
            ]
        );

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_personal_notifications_mark_read_accepts_actor_email_header(): void
    {
        $persona = Persona::query()->create([
            'nombres' => 'Esteban',
            'apellidos' => 'Cortez',
            'email' => 'esteban@example.com',
            'cuil' => '20-12345678-9',
        ]);

        Dueno::query()->create([
            'persona_id' => $persona->id,
            'email' => 'dueno@example.com',
        ]);

        $notification = PersonalNotification::query()->create([
            'persona_id' => $persona->id,
            'type' => 'liquidacion',
            'title' => 'Nueva liquidación disponible',
            'message' => 'Se cargó una nueva liquidación: Liquidación test.pdf',
            'metadata' => ['documentId' => 123],
        ]);

        $response = $this->postJson(
            sprintf('/api/personal/%d/notificaciones/%d/read', $persona->id, $notification->id),
            [],
            [
                'Accept' => 'application/json',
                'X-Actor-Email' => 'dueno@example.com',
            ]
        );

        $response
            ->assertOk()
            ->assertJsonPath('id', $notification->id);

        $notification->refresh();
        $this->assertNotNull($notification->read_at);
    }
}


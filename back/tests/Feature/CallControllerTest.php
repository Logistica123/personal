<?php

namespace Tests\Feature;

use App\Models\CallSession;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CallControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $migrationPaths = [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/2026_03_03_000005_create_call_sessions_table.php',
        ];

        foreach ($migrationPaths as $path) {
            $this->artisan('migrate', [
                '--path' => $path,
                '--realpath' => false,
            ])->assertExitCode(0);
        }

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

        if (! Schema::hasColumn('users', 'totp_secret')) {
            Schema::table('users', function (Blueprint $table) {
                $table->text('totp_secret')->nullable();
            });
        }

        if (! Schema::hasColumn('users', 'totp_enabled_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->timestamp('totp_enabled_at')->nullable();
            });
        }
    }

    private function createAuthUser(string $email, string $plainToken): User
    {
        $user = User::query()->create([
            'name' => 'Calls Test',
            'email' => $email,
            'password' => bcrypt('secret123'),
        ]);
        $user->forceFill([
            'remember_token' => hash('sha256', $plainToken),
        ])->save();

        return $user;
    }

    private function authHeaders(string $plainToken): array
    {
        return [
            'Accept' => 'application/json',
            'Authorization' => 'Bearer ' . $plainToken,
        ];
    }

    public function test_it_issues_mock_call_token(): void
    {
        config([
            'services.voice.driver' => 'mock',
            'services.voice.token_ttl' => 1200,
        ]);

        $token = 'token-tests-calls';
        $this->createAuthUser('calls.tests@example.com', $token);
        $headers = $this->authHeaders($token);

        $this->postJson('/api/calls/token', [], $headers)
            ->assertOk()
            ->assertJsonPath('data.provider', 'mock')
            ->assertJsonStructure([
                'data' => ['provider', 'token', 'identity', 'expiresAt'],
            ]);
    }

    public function test_it_creates_and_updates_call_session(): void
    {
        config([
            'services.voice.driver' => 'mock',
        ]);

        $token = 'token-tests-sessions';
        $this->createAuthUser('calls.sessions@example.com', $token);
        $headers = $this->authHeaders($token);

        $createResponse = $this->postJson('/api/calls/sessions', [
            'target_identity' => 'user-44',
            'channel' => 'client',
            'metadata' => [
                'source' => 'test-suite',
            ],
        ], $headers);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.status', 'initiated')
            ->assertJsonPath('data.targetIdentity', 'user-44');

        $sessionId = (int) $createResponse->json('data.id');

        $this->patchJson('/api/calls/sessions/' . $sessionId, [
            'status' => 'answered',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.status', 'answered');

        $this->patchJson('/api/calls/sessions/' . $sessionId, [
            'status' => 'completed',
            'duration_seconds' => 37,
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.durationSeconds', 37);

        $this->assertDatabaseHas('call_sessions', [
            'id' => $sessionId,
            'status' => 'completed',
            'duration_seconds' => 37,
        ]);
    }

    public function test_twilio_webhook_updates_existing_session_with_valid_signature(): void
    {
        config([
            'services.voice.driver' => 'twilio',
            'services.voice.twilio.enabled' => true,
            'services.voice.twilio.auth_token' => 'twilio-auth-token-tests',
            'services.voice.webhook_signature_validation' => true,
            'app.url' => 'http://localhost',
        ]);

        $session = CallSession::query()->create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'provider' => 'twilio',
            'direction' => 'outbound',
            'channel' => 'client',
            'status' => 'initiated',
            'provider_call_sid' => 'CA1234567890',
            'started_at' => now(),
        ]);

        $payload = [
            'CallSid' => 'CA1234567890',
            'CallStatus' => 'completed',
            'CallDuration' => '42',
            'From' => 'client:user-1',
            'To' => 'client:user-2',
        ];

        $url = 'http://localhost/api/voice/twilio/status';
        $signature = $this->twilioSignature($url, $payload, 'twilio-auth-token-tests');

        $this->post('/api/voice/twilio/status', $payload, [
            'X-Twilio-Signature' => $signature,
        ])->assertOk();

        $session->refresh();

        $this->assertSame('completed', $session->status);
        $this->assertSame(42, $session->duration_seconds);
        $this->assertNotNull($session->ended_at);
    }

    public function test_twilio_webhook_rejects_invalid_signature(): void
    {
        config([
            'services.voice.driver' => 'twilio',
            'services.voice.twilio.enabled' => true,
            'services.voice.twilio.auth_token' => 'twilio-auth-token-tests',
            'services.voice.webhook_signature_validation' => true,
        ]);

        $this->post('/api/voice/twilio/status', [
            'CallSid' => 'CA_INVALID',
            'CallStatus' => 'completed',
        ], [
            'X-Twilio-Signature' => 'invalid-signature',
        ])->assertStatus(403);
    }

    public function test_native_webrtc_signaling_flow_between_two_users(): void
    {
        config([
            'services.voice.driver' => 'mock',
            'services.voice.webrtc.enabled' => true,
            'services.voice.webrtc.ice_servers' => 'stun:stun.l.google.com:19302,turn:turn.example.test:3478',
            'services.voice.webrtc.turn_username' => 'turn-user',
            'services.voice.webrtc.turn_credential' => 'turn-secret',
        ]);

        $initiatorToken = 'token-initiator';
        $targetToken = 'token-target';
        $initiator = $this->createAuthUser('calls.initiator@example.com', $initiatorToken);
        $target = $this->createAuthUser('calls.target@example.com', $targetToken);
        $initiatorHeaders = $this->authHeaders($initiatorToken);
        $targetHeaders = $this->authHeaders($targetToken);

        $this->getJson('/api/calls/webrtc/config', $initiatorHeaders)
            ->assertOk()
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.iceServers.0.urls.0', 'stun:stun.l.google.com:19302')
            ->assertJsonPath('data.iceServers.1.username', 'turn-user');

        $createResponse = $this->postJson('/api/calls/sessions', [
            'target_user_id' => $target->id,
            'channel' => 'webrtc',
            'metadata' => [
                'source' => 'native-webrtc-tests',
            ],
        ], $initiatorHeaders)
            ->assertCreated()
            ->assertJsonPath('data.channel', 'webrtc')
            ->assertJsonPath('data.provider', 'native-webrtc');

        $sessionId = (int) $createResponse->json('data.id');

        $offerSdp = 'v=0' . "\n" . 'o=- 1 2 IN IP4 127.0.0.1';
        $answerSdp = 'v=0' . "\n" . 'o=- 3 4 IN IP4 127.0.0.1';

        $this->postJson('/api/calls/sessions/' . $sessionId . '/webrtc/offer', [
            'sdp' => $offerSdp,
        ], $initiatorHeaders)
            ->assertOk()
            ->assertJsonPath('data.status', 'ringing');

        $this->postJson('/api/calls/sessions/' . $sessionId . '/webrtc/candidate', [
            'candidate' => 'candidate:1 1 UDP 2122252543 192.168.1.10 52418 typ host',
            'sdpMid' => '0',
            'sdpMLineIndex' => 0,
        ], $initiatorHeaders)->assertOk();

        $targetSync1 = $this->getJson('/api/calls/sessions/' . $sessionId . '/webrtc/sync?since=0', $targetHeaders)
            ->assertOk();
        $signalVersion1 = (int) $targetSync1->json('webrtc.signalVersion');

        $targetSync1
            ->assertJsonPath('webrtc.offer.sdp', $offerSdp)
            ->assertJsonPath('webrtc.initiatorCandidates.0.sdpMid', '0');

        $this->postJson('/api/calls/sessions/' . $sessionId . '/webrtc/answer', [
            'sdp' => $answerSdp,
        ], $targetHeaders)
            ->assertOk()
            ->assertJsonPath('data.status', 'answered');

        $this->postJson('/api/calls/sessions/' . $sessionId . '/webrtc/candidate', [
            'candidate' => 'candidate:2 1 UDP 2122252543 192.168.1.11 52419 typ host',
            'sdpMid' => '0',
            'sdpMLineIndex' => 0,
        ], $targetHeaders)->assertOk();

        $initiatorSync = $this->getJson(
            '/api/calls/sessions/' . $sessionId . '/webrtc/sync?since=' . $signalVersion1,
            $initiatorHeaders
        )->assertOk();

        $initiatorSync
            ->assertJsonPath('webrtc.answer.sdp', $answerSdp)
            ->assertJsonPath('webrtc.targetCandidates.0.sdpMid', '0');

        $this->postJson('/api/calls/sessions/' . $sessionId . '/hangup', [
            'reason' => 'manual_finish',
        ], $initiatorHeaders)
            ->assertOk()
            ->assertJsonPath('data.endReason', 'manual_finish');

        $finalResponse = $this->getJson('/api/calls/sessions/' . $sessionId, $targetHeaders)
            ->assertOk();
        $finalVersion = (int) $finalResponse->json('data.signalVersion');

        $targetSyncFinal = $this->getJson(
            '/api/calls/sessions/' . $sessionId . '/webrtc/sync?since=' . max(0, $finalVersion - 1),
            $targetHeaders
        )->assertOk();

        $this->assertNotNull($targetSyncFinal->json('webrtc.hangup'));
        $this->assertDatabaseHas('call_sessions', [
            'id' => $sessionId,
            'status' => 'completed',
            'end_reason' => 'manual_finish',
        ]);
    }

    public function test_it_creates_whatsapp_deeplink_session(): void
    {
        config([
            'services.whatsapp.base_url' => 'https://wa.me',
        ]);

        $token = 'token-whatsapp';
        $this->createAuthUser('calls.whatsapp@example.com', $token);
        $headers = $this->authHeaders($token);

        $response = $this->postJson('/api/calls/whatsapp/start', [
            'to_phone' => '+54 9 11 5555-1234',
            'message' => 'Hola, te llamo por WhatsApp',
        ], $headers)
            ->assertCreated()
            ->assertJsonPath('data.normalizedPhone', '+5491155551234');

        $deeplink = (string) $response->json('data.deeplink');
        $this->assertStringStartsWith('https://wa.me/5491155551234', $deeplink);
        $this->assertStringContainsString('text=', $deeplink);

        $this->assertDatabaseHas('call_sessions', [
            'provider' => 'whatsapp',
            'channel' => 'whatsapp',
            'to_phone' => '+5491155551234',
            'status' => 'initiated',
        ]);
    }

    private function twilioSignature(string $url, array $params, string $authToken): string
    {
        ksort($params, SORT_STRING);

        $data = $url;
        foreach ($params as $key => $value) {
            $data .= $key . (string) $value;
        }

        return base64_encode(hash_hmac('sha1', $data, $authToken, true));
    }
}

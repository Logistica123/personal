<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CallSession;
use App\Models\User;
use App\Services\Voice\TwilioVoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use RuntimeException;

class CallController extends Controller
{
    public function __construct(private readonly TwilioVoiceService $voiceService)
    {
    }

    public function token(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'identity' => ['nullable', 'string', 'max:80'],
        ]);

        try {
            $tokenData = $this->voiceService->issueAccessToken($user, $validated['identity'] ?? null);
        } catch (RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }

        return response()->json([
            'data' => $tokenData,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            'status' => ['nullable', 'string', 'max:24'],
        ]);

        $defaultIdentity = 'user-' . $user->id;

        $query = CallSession::query()
            ->where(function ($builder) use ($user, $defaultIdentity) {
                $builder
                    ->where('initiator_user_id', $user->id)
                    ->orWhere('target_user_id', $user->id)
                    ->orWhere('initiator_identity', $defaultIdentity)
                    ->orWhere('target_identity', $defaultIdentity);
            })
            ->orderByDesc('id');

        if (! empty($validated['status'])) {
            $query->where('status', strtolower((string) $validated['status']));
        }

        $limit = (int) ($validated['limit'] ?? 30);

        $sessions = $query->limit($limit)->get()->map(fn (CallSession $session) => $this->serializeSession($session))->values();

        return response()->json([
            'data' => $sessions,
        ]);
    }

    public function show(Request $request, CallSession $session): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $this->canAccessSession($user, $session)) {
            return response()->json(['message' => 'No autorizado para esta llamada.'], 403);
        }

        return response()->json([
            'data' => $this->serializeSession($session),
            'webrtc' => $this->readWebRtcState($session),
        ]);
    }

    public function webrtcConfig(): JsonResponse
    {
        $iceServers = $this->resolveWebRtcIceServers();

        return response()->json([
            'data' => [
                'enabled' => (bool) config('services.voice.webrtc.enabled', true),
                'iceServers' => $iceServers,
                'pollIntervalMs' => 1500,
            ],
        ]);
    }

    public function whatsappStart(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'to_phone' => ['required', 'string', 'max:32'],
            'message' => ['nullable', 'string', 'max:700'],
            'target_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'target_identity' => ['nullable', 'string', 'max:120'],
        ]);

        $normalizedPhone = $this->normalizePhoneForWhatsApp((string) $validated['to_phone']);
        if ($normalizedPhone === '') {
            return response()->json([
                'message' => 'El teléfono no es válido para WhatsApp.',
            ], 422);
        }

        $targetIdentity = $validated['target_identity'] ?? null;
        if (! $targetIdentity && ! empty($validated['target_user_id'])) {
            $targetIdentity = 'user-' . (int) $validated['target_user_id'];
        }

        $defaultMessage = 'Hola, te contacto desde la app. ¿Podés atender una llamada por WhatsApp?';
        $message = trim((string) ($validated['message'] ?? $defaultMessage));

        $session = CallSession::query()->create([
            'uuid' => (string) Str::uuid(),
            'initiator_user_id' => $user->id,
            'target_user_id' => $validated['target_user_id'] ?? null,
            'provider' => 'whatsapp',
            'direction' => 'outbound',
            'channel' => 'whatsapp',
            'status' => 'initiated',
            'initiator_identity' => 'user-' . $user->id,
            'target_identity' => $targetIdentity,
            'to_phone' => '+' . $normalizedPhone,
            'started_at' => now(),
            'metadata' => [
                'source' => 'whatsapp_deeplink',
                'message' => $message,
            ],
        ]);

        $deeplink = $this->buildWhatsAppDeepLink($normalizedPhone, $message);

        return response()->json([
            'data' => [
                'session' => $this->serializeSession($session),
                'deeplink' => $deeplink,
                'normalizedPhone' => '+' . $normalizedPhone,
            ],
        ], 201);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'target_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'target_identity' => ['nullable', 'string', 'max:120'],
            'to_phone' => ['nullable', 'string', 'max:32'],
            'from_phone' => ['nullable', 'string', 'max:32'],
            'channel' => ['nullable', 'in:client,phone,webrtc'],
            'direction' => ['nullable', 'in:outbound,inbound'],
            'provider_call_sid' => ['nullable', 'string', 'max:64'],
            'metadata' => ['nullable', 'array'],
            'dial_now' => ['nullable', 'boolean'],
        ]);

        $channel = (string) ($validated['channel'] ?? 'client');

        if (
            empty($validated['target_user_id'])
            && empty($validated['target_identity'])
            && empty($validated['to_phone'])
        ) {
            return response()->json([
                'message' => 'Debes indicar target_user_id, target_identity o to_phone.',
            ], 422);
        }

        $targetIdentity = $validated['target_identity'] ?? null;
        if (! $targetIdentity && ! empty($validated['target_user_id'])) {
            $targetIdentity = 'user-' . (int) $validated['target_user_id'];
        }

        $provider = $channel === 'webrtc' ? 'native-webrtc' : $this->voiceService->providerName();
        $session = CallSession::query()->create([
            'uuid' => (string) Str::uuid(),
            'initiator_user_id' => $user->id,
            'target_user_id' => $validated['target_user_id'] ?? null,
            'provider' => $provider,
            'direction' => $validated['direction'] ?? 'outbound',
            'channel' => $channel,
            'status' => 'initiated',
            'initiator_identity' => 'user-' . $user->id,
            'target_identity' => $targetIdentity,
            'from_phone' => $validated['from_phone'] ?? null,
            'to_phone' => $validated['to_phone'] ?? null,
            'provider_call_sid' => $validated['provider_call_sid'] ?? null,
            'started_at' => now(),
            'metadata' => array_merge($validated['metadata'] ?? [], $channel === 'webrtc'
                ? ['webrtc' => ['signal_version' => 0]]
                : []),
        ]);

        if (($validated['dial_now'] ?? false) && $channel === 'phone' && ! empty($validated['to_phone'])) {
            try {
                $fromPhone = (string) ($validated['from_phone'] ?? config('services.voice.default_caller_id', ''));
                if ($fromPhone === '') {
                    throw new RuntimeException('from_phone es obligatorio para dial_now en llamadas telefónicas.');
                }

                $dialResult = $this->voiceService->createOutboundPhoneCall(
                    (string) $validated['to_phone'],
                    $fromPhone,
                    $targetIdentity
                );

                $session->forceFill([
                    'provider' => $dialResult['provider'] ?? $session->provider,
                    'provider_call_sid' => $dialResult['sid'] ?? $session->provider_call_sid,
                    'status' => 'ringing',
                ])->save();
            } catch (RuntimeException $exception) {
                $session->forceFill([
                    'status' => 'failed',
                    'end_reason' => 'dial_now_error',
                    'ended_at' => now(),
                    'metadata' => array_merge($session->metadata ?? [], [
                        'dial_now_error' => $exception->getMessage(),
                    ]),
                ])->save();

                return response()->json([
                    'message' => $exception->getMessage(),
                    'data' => $this->serializeSession($session),
                ], 422);
            }
        }

        return response()->json([
            'data' => $this->serializeSession($session),
        ], 201);
    }

    public function webrtcOffer(Request $request, CallSession $session): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $this->canAccessSession($user, $session)) {
            return response()->json(['message' => 'No autorizado para esta llamada.'], 403);
        }

        if (! $this->canManageOffer($user, $session)) {
            return response()->json(['message' => 'Solo el originador puede publicar el offer.'], 403);
        }

        $validated = $request->validate([
            'sdp' => ['required', 'string', 'max:120000'],
        ]);

        $state = $this->readWebRtcState($session);
        $version = $this->nextSignalVersion($state);
        $state['offer'] = [
            'sdp' => $validated['sdp'],
            'version' => $version,
            'by_user_id' => $user->id,
            'created_at' => now()->toIso8601String(),
        ];

        if ($session->status === 'initiated') {
            $session->status = 'ringing';
        }

        $this->persistWebRtcState($session, $state);

        return response()->json([
            'ok' => true,
            'signalVersion' => $version,
            'data' => $this->serializeSession($session),
        ]);
    }

    public function webrtcAnswer(Request $request, CallSession $session): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $this->canAccessSession($user, $session)) {
            return response()->json(['message' => 'No autorizado para esta llamada.'], 403);
        }

        if (! $this->canManageAnswer($user, $session)) {
            return response()->json(['message' => 'Solo el destinatario puede publicar el answer.'], 403);
        }

        $validated = $request->validate([
            'sdp' => ['required', 'string', 'max:120000'],
        ]);

        $state = $this->readWebRtcState($session);
        $version = $this->nextSignalVersion($state);
        $state['answer'] = [
            'sdp' => $validated['sdp'],
            'version' => $version,
            'by_user_id' => $user->id,
            'created_at' => now()->toIso8601String(),
        ];

        $session->status = 'answered';
        if (! $session->answered_at) {
            $session->answered_at = now();
        }

        $this->persistWebRtcState($session, $state);

        return response()->json([
            'ok' => true,
            'signalVersion' => $version,
            'data' => $this->serializeSession($session),
        ]);
    }

    public function webrtcCandidate(Request $request, CallSession $session): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $this->canAccessSession($user, $session)) {
            return response()->json(['message' => 'No autorizado para esta llamada.'], 403);
        }

        $validated = $request->validate([
            'role' => ['nullable', 'in:initiator,target'],
            'candidate' => ['required', 'string', 'max:3000'],
            'sdpMid' => ['nullable', 'string', 'max:256'],
            'sdpMLineIndex' => ['nullable', 'integer', 'min:0', 'max:999'],
            'usernameFragment' => ['nullable', 'string', 'max:256'],
        ]);

        $state = $this->readWebRtcState($session);
        $version = $this->nextSignalVersion($state);

        $role = $this->resolveCandidateRole($validated['role'] ?? null, $user, $session);
        $candidate = [
            'candidate' => $validated['candidate'],
            'sdpMid' => $validated['sdpMid'] ?? null,
            'sdpMLineIndex' => $validated['sdpMLineIndex'] ?? null,
            'usernameFragment' => $validated['usernameFragment'] ?? null,
            'version' => $version,
            'by_user_id' => $user->id,
            'created_at' => now()->toIso8601String(),
        ];

        $bucket = $role === 'initiator' ? 'initiator_candidates' : 'target_candidates';
        $state[$bucket] = array_slice(
            array_merge($state[$bucket] ?? [], [$candidate]),
            -500
        );

        $this->persistWebRtcState($session, $state);

        return response()->json([
            'ok' => true,
            'signalVersion' => $version,
        ]);
    }

    public function webrtcSync(Request $request, CallSession $session): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $this->canAccessSession($user, $session)) {
            return response()->json(['message' => 'No autorizado para esta llamada.'], 403);
        }

        $validated = $request->validate([
            'since' => ['nullable', 'integer', 'min:0'],
        ]);

        $since = (int) ($validated['since'] ?? 0);
        $state = $this->readWebRtcState($session);
        $signalVersion = (int) ($state['signal_version'] ?? 0);

        $offer = $state['offer'] ?? null;
        $answer = $state['answer'] ?? null;
        $hangup = $state['hangup'] ?? null;

        $initiatorCandidates = array_values(array_filter(
            $state['initiator_candidates'] ?? [],
            fn ($item) => (int) ($item['version'] ?? 0) > $since
        ));
        $targetCandidates = array_values(array_filter(
            $state['target_candidates'] ?? [],
            fn ($item) => (int) ($item['version'] ?? 0) > $since
        ));

        return response()->json([
            'data' => $this->serializeSession($session),
            'webrtc' => [
                'signalVersion' => $signalVersion,
                'changed' => $signalVersion > $since,
                'offer' => $offer && (int) ($offer['version'] ?? 0) > $since ? $offer : null,
                'answer' => $answer && (int) ($answer['version'] ?? 0) > $since ? $answer : null,
                'hangup' => $hangup && (int) ($hangup['version'] ?? 0) > $since ? $hangup : null,
                'initiatorCandidates' => $initiatorCandidates,
                'targetCandidates' => $targetCandidates,
            ],
        ]);
    }

    public function hangup(Request $request, CallSession $session): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $this->canAccessSession($user, $session)) {
            return response()->json(['message' => 'No autorizado para esta llamada.'], 403);
        }

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:64'],
        ]);

        $state = $this->readWebRtcState($session);
        $version = $this->nextSignalVersion($state);
        $state['hangup'] = [
            'reason' => $validated['reason'] ?? 'user_hangup',
            'version' => $version,
            'by_user_id' => $user->id,
            'created_at' => now()->toIso8601String(),
        ];

        if (! $session->ended_at) {
            $session->ended_at = now();
        }
        $session->status = $session->answered_at ? 'completed' : 'canceled';
        $session->end_reason = $validated['reason'] ?? 'user_hangup';
        if (! $session->duration_seconds && $session->answered_at) {
            $session->duration_seconds = max(0, $session->ended_at->diffInSeconds($session->answered_at, false));
        }

        $this->persistWebRtcState($session, $state);

        return response()->json([
            'ok' => true,
            'signalVersion' => $version,
            'data' => $this->serializeSession($session),
        ]);
    }

    public function update(Request $request, CallSession $session): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $this->canAccessSession($user, $session)) {
            return response()->json(['message' => 'No autorizado para esta llamada.'], 403);
        }

        $validated = $request->validate([
            'status' => ['nullable', 'in:initiated,ringing,answered,completed,failed,busy,no-answer,canceled'],
            'provider_call_sid' => ['nullable', 'string', 'max:64'],
            'duration_seconds' => ['nullable', 'integer', 'min:0'],
            'end_reason' => ['nullable', 'string', 'max:64'],
            'metadata' => ['nullable', 'array'],
        ]);

        if (isset($validated['provider_call_sid']) && $session->provider_call_sid === null) {
            $session->provider_call_sid = $validated['provider_call_sid'];
        }

        if (isset($validated['status'])) {
            $session->status = strtolower((string) $validated['status']);

            if ($session->status === 'answered' && ! $session->answered_at) {
                $session->answered_at = now();
            }

            if ($this->isTerminalStatus($session->status) && ! $session->ended_at) {
                $session->ended_at = now();
            }
        }

        if (array_key_exists('duration_seconds', $validated)) {
            $session->duration_seconds = $validated['duration_seconds'];
        }

        if (isset($validated['end_reason'])) {
            $session->end_reason = $validated['end_reason'];
        }

        if (isset($validated['metadata'])) {
            $session->metadata = array_merge($session->metadata ?? [], $validated['metadata']);
        }

        if (
            ! $session->duration_seconds
            && $session->answered_at
            && $session->ended_at
        ) {
            $diff = $session->ended_at->diffInSeconds($session->answered_at, false);
            $session->duration_seconds = max(0, $diff);
        }

        $session->save();

        return response()->json([
            'data' => $this->serializeSession($session),
        ]);
    }

    public function twilioStatusWebhook(Request $request): JsonResponse
    {
        if (! $this->voiceService->validateWebhookSignature($request)) {
            return response()->json(['message' => 'Firma Twilio inválida.'], 403);
        }

        $callSid = trim((string) $request->input('CallSid', ''));
        if ($callSid === '') {
            return response()->json(['message' => 'CallSid es obligatorio.'], 422);
        }

        $twilioStatus = strtolower(trim((string) $request->input('CallStatus', 'initiated')));
        $mappedStatus = $this->mapTwilioStatus($twilioStatus);
        $duration = $request->input('CallDuration');

        $from = trim((string) $request->input('From', ''));
        $to = trim((string) $request->input('To', ''));

        $session = CallSession::query()->where('provider_call_sid', $callSid)->first();

        if (! $session) {
            $direction = strtolower((string) $request->input('Direction', 'outbound-api'));
            $session = CallSession::query()->create([
                'uuid' => (string) Str::uuid(),
                'provider' => 'twilio',
                'direction' => str_contains($direction, 'inbound') ? 'inbound' : 'outbound',
                'channel' => $this->resolveChannelFromEndpoints($from, $to),
                'status' => $mappedStatus,
                'initiator_identity' => $this->identityFromEndpoint($from),
                'target_identity' => $this->identityFromEndpoint($to),
                'from_phone' => $this->phoneFromEndpoint($from),
                'to_phone' => $this->phoneFromEndpoint($to),
                'provider_call_sid' => $callSid,
                'started_at' => now(),
                'metadata' => [
                    'source' => 'twilio_webhook',
                ],
            ]);
        } else {
            $session->status = $mappedStatus;
        }

        if ($mappedStatus === 'answered' && ! $session->answered_at) {
            $session->answered_at = now();
        }

        if ($this->isTerminalStatus($mappedStatus) && ! $session->ended_at) {
            $session->ended_at = now();
        }

        if (is_numeric($duration)) {
            $session->duration_seconds = (int) $duration;
        }

        $session->save();

        return response()->json(['ok' => true]);
    }

    public function twilioOutboundTwiml(Request $request)
    {
        if (! $this->voiceService->validateWebhookSignature($request)) {
            return response('Forbidden', 403);
        }

        $to = $request->input('To');
        $from = $request->input('From');

        $xml = $this->voiceService->buildOutboundTwiml(
            is_string($to) ? $to : null,
            is_string($from) ? $from : null,
        );

        return response($xml, 200)->header('Content-Type', 'text/xml; charset=UTF-8');
    }

    private function canAccessSession(User $user, CallSession $session): bool
    {
        if (strtolower((string) $user->role) === 'admin') {
            return true;
        }

        if ($session->initiator_user_id === $user->id || $session->target_user_id === $user->id) {
            return true;
        }

        $defaultIdentity = 'user-' . $user->id;

        return $session->initiator_identity === $defaultIdentity || $session->target_identity === $defaultIdentity;
    }

    private function canManageOffer(User $user, CallSession $session): bool
    {
        if (strtolower((string) $user->role) === 'admin') {
            return true;
        }

        return $session->initiator_user_id === $user->id || $session->initiator_identity === ('user-' . $user->id);
    }

    private function canManageAnswer(User $user, CallSession $session): bool
    {
        if (strtolower((string) $user->role) === 'admin') {
            return true;
        }

        if ($session->target_user_id && $session->target_user_id === $user->id) {
            return true;
        }

        return $session->target_identity === ('user-' . $user->id);
    }

    private function isTerminalStatus(string $status): bool
    {
        return in_array($status, ['completed', 'failed', 'busy', 'no-answer', 'canceled'], true);
    }

    private function mapTwilioStatus(string $status): string
    {
        return match ($status) {
            'queued', 'initiated' => 'initiated',
            'ringing' => 'ringing',
            'in-progress' => 'answered',
            'completed' => 'completed',
            'busy' => 'busy',
            'no-answer' => 'no-answer',
            'failed' => 'failed',
            'canceled' => 'canceled',
            default => 'initiated',
        };
    }

    private function resolveChannelFromEndpoints(string $from, string $to): string
    {
        if (str_starts_with(strtolower($from), 'client:') || str_starts_with(strtolower($to), 'client:')) {
            return 'client';
        }

        return 'phone';
    }

    private function identityFromEndpoint(string $endpoint): ?string
    {
        if (! str_starts_with(strtolower($endpoint), 'client:')) {
            return null;
        }

        return substr($endpoint, 7) ?: null;
    }

    private function phoneFromEndpoint(string $endpoint): ?string
    {
        if ($endpoint === '' || str_starts_with(strtolower($endpoint), 'client:')) {
            return null;
        }

        return $endpoint;
    }

    private function serializeSession(CallSession $session): array
    {
        $webrtc = $this->readWebRtcState($session);

        return [
            'id' => $session->id,
            'uuid' => $session->uuid,
            'provider' => $session->provider,
            'direction' => $session->direction,
            'channel' => $session->channel,
            'status' => $session->status,
            'initiatorUserId' => $session->initiator_user_id,
            'targetUserId' => $session->target_user_id,
            'initiatorIdentity' => $session->initiator_identity,
            'targetIdentity' => $session->target_identity,
            'fromPhone' => $session->from_phone,
            'toPhone' => $session->to_phone,
            'providerCallSid' => $session->provider_call_sid,
            'startedAt' => $session->started_at?->toIso8601String(),
            'answeredAt' => $session->answered_at?->toIso8601String(),
            'endedAt' => $session->ended_at?->toIso8601String(),
            'durationSeconds' => $session->duration_seconds,
            'endReason' => $session->end_reason,
            'metadata' => $session->metadata,
            'signalVersion' => (int) ($webrtc['signal_version'] ?? 0),
            'createdAt' => $session->created_at?->toIso8601String(),
        ];
    }

    private function readWebRtcState(CallSession $session): array
    {
        $metadata = is_array($session->metadata) ? $session->metadata : [];
        $state = is_array($metadata['webrtc'] ?? null) ? $metadata['webrtc'] : [];

        return [
            'signal_version' => (int) ($state['signal_version'] ?? 0),
            'offer' => is_array($state['offer'] ?? null) ? $state['offer'] : null,
            'answer' => is_array($state['answer'] ?? null) ? $state['answer'] : null,
            'hangup' => is_array($state['hangup'] ?? null) ? $state['hangup'] : null,
            'initiator_candidates' => array_values(array_filter($state['initiator_candidates'] ?? [], 'is_array')),
            'target_candidates' => array_values(array_filter($state['target_candidates'] ?? [], 'is_array')),
        ];
    }

    private function persistWebRtcState(CallSession $session, array $state): void
    {
        $metadata = is_array($session->metadata) ? $session->metadata : [];
        $metadata['webrtc'] = $state;
        $session->metadata = $metadata;
        $session->save();
    }

    private function nextSignalVersion(array &$state): int
    {
        $current = (int) ($state['signal_version'] ?? 0);
        $next = $current + 1;
        $state['signal_version'] = $next;

        return $next;
    }

    private function resolveCandidateRole(?string $requestedRole, User $user, CallSession $session): string
    {
        if ($requestedRole === 'initiator' || $requestedRole === 'target') {
            return $requestedRole;
        }

        if ($session->initiator_user_id === $user->id || $session->initiator_identity === ('user-' . $user->id)) {
            return 'initiator';
        }

        return 'target';
    }

    private function resolveWebRtcIceServers(): array
    {
        $rawIce = trim((string) config('services.voice.webrtc.ice_servers', 'stun:stun.l.google.com:19302'));
        $servers = [];

        if ($rawIce !== '') {
            $parts = array_filter(array_map('trim', explode(',', $rawIce)));
            foreach ($parts as $url) {
                if ($url !== '') {
                    $servers[] = ['urls' => [$url]];
                }
            }
        }

        $turnUsername = trim((string) config('services.voice.webrtc.turn_username', ''));
        $turnCredential = trim((string) config('services.voice.webrtc.turn_credential', ''));
        if ($turnUsername !== '' && $turnCredential !== '') {
            $servers = array_map(function (array $server) use ($turnUsername, $turnCredential) {
                $urls = $server['urls'] ?? [];
                $joined = strtolower(implode(',', (array) $urls));
                if (str_contains($joined, 'turn:') || str_contains($joined, 'turns:')) {
                    return [
                        ...$server,
                        'username' => $turnUsername,
                        'credential' => $turnCredential,
                    ];
                }

                return $server;
            }, $servers);
        }

        if ($servers === []) {
            return [['urls' => ['stun:stun.l.google.com:19302']]];
        }

        return $servers;
    }

    private function normalizePhoneForWhatsApp(string $rawPhone): string
    {
        $digits = preg_replace('/\D+/', '', $rawPhone) ?? '';
        $digits = ltrim($digits, '0');

        if (strlen($digits) < 8 || strlen($digits) > 15) {
            return '';
        }

        return $digits;
    }

    private function buildWhatsAppDeepLink(string $normalizedPhone, string $message): string
    {
        $baseUrl = trim((string) config('services.whatsapp.base_url', 'https://wa.me'));
        if ($baseUrl === '') {
            $baseUrl = 'https://wa.me';
        }

        $baseUrl = rtrim($baseUrl, '/');
        $query = $message !== '' ? '?text=' . urlencode($message) : '';

        return $baseUrl . '/' . $normalizedPhone . $query;
    }
}

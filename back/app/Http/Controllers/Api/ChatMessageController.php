<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\ChatMessageReaction;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ChatMessageController extends Controller
{
    public function index(Request $request)
    {
        $userId = (int) $request->query('userId', 0);
        if ($userId <= 0) {
            return response()->json([
                'message' => 'El identificador del usuario es obligatorio.',
            ], 422);
        }

        $contactId = (int) $request->query('contactId', 0);
        $limit = (int) $request->query('limit', 200);
        $limit = max(1, min(500, $limit));
        $afterId = (int) $request->query('afterId', 0);

        try {
            if (!$this->isChatTableReady()) {
                return $this->respondFromFallback($userId, $contactId, $limit, $afterId);
            }

            $query = ChatMessage::query()
                ->where(function ($query) use ($userId) {
                    $query->where('sender_id', $userId)
                        ->orWhere('recipient_id', $userId);
                });

            if ($contactId > 0) {
                $query->where(function ($query) use ($userId, $contactId) {
                    $query->where(function ($inner) use ($userId, $contactId) {
                        $inner->where('sender_id', $userId)
                            ->where('recipient_id', $contactId);
                    })->orWhere(function ($inner) use ($userId, $contactId) {
                        $inner->where('sender_id', $contactId)
                            ->where('recipient_id', $userId);
                    });
                });
            }

            if ($afterId > 0) {
                $query->where('id', '>', $afterId);
            }

            $messages = $query
                ->orderByDesc('id')
                ->limit($limit)
                ->get()
                ->sortBy('id')
                ->values();

            $reactionsByMessage = $this->fetchReactionsForMessages($messages->pluck('id')->all());
            $typing = $this->fetchTypingPartners($userId);

            return response()->json([
                'data' => $messages->map(fn (ChatMessage $message) => $this->transformMessage($message, $reactionsByMessage)),
                'typing' => $typing,
            ]);
        } catch (\Throwable $exception) {
            report($exception);
            return $this->respondFromFallback($userId, $contactId, $limit, $afterId);
        }
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'senderId' => 'nullable|integer|min:1',
            'recipientId' => 'required|integer|min:1',
            'text' => 'nullable|string|max:2000',
            'imageData' => 'nullable|string|max:10485760',
            'imageName' => 'nullable|string|max:255',
        ]);

        if (
            empty($validated['text']) &&
            empty($validated['imageData'])
        ) {
            throw ValidationException::withMessages([
                'text' => 'Ingresa un mensaje o adjunta una imagen.',
            ]);
        }

        try {
            if (!$this->isChatTableReady()) {
                return $this->storeFallbackMessage($validated);
            }

            $message = ChatMessage::create([
                'sender_id' => $validated['senderId'] ?? null,
                'recipient_id' => $validated['recipientId'],
                'text' => $validated['text'] ?? null,
                'image_data' => $validated['imageData'] ?? null,
                'image_name' => $validated['imageName'] ?? null,
            ]);

            if (!empty($validated['senderId'])) {
                $this->clearTyping((int) $validated['senderId'], (int) $validated['recipientId']);
            }

            return response()->json([
                'message' => 'Mensaje enviado correctamente.',
                'data' => $this->transformMessage($message, []),
            ], 201);
        } catch (\Throwable $exception) {
            report($exception);
            return $this->storeFallbackMessage($validated);
        }
    }

    public function toggleReaction(Request $request, int $messageId)
    {
        $validated = $request->validate([
            'userId' => 'required|integer|min:1',
            'emoji' => 'required|string|max:16',
        ]);

        try {
            if (!Schema::hasTable('chat_message_reactions')) {
                return response()->json(['message' => 'Reacciones deshabilitadas.'], 503);
            }

            $existing = ChatMessageReaction::where('message_id', $messageId)
                ->where('user_id', $validated['userId'])
                ->where('emoji', $validated['emoji'])
                ->first();

            if ($existing) {
                $existing->delete();
                $action = 'removed';
            } else {
                ChatMessageReaction::create([
                    'message_id' => $messageId,
                    'user_id' => (int) $validated['userId'],
                    'emoji' => $validated['emoji'],
                ]);
                $action = 'added';
            }

            $reactions = $this->fetchReactionsForMessages([$messageId])[$messageId] ?? [];

            return response()->json([
                'action' => $action,
                'messageId' => $messageId,
                'reactions' => $reactions,
            ]);
        } catch (\Throwable $exception) {
            report($exception);
            return response()->json(['message' => 'No se pudo registrar la reacción.'], 500);
        }
    }

    public function heartbeatTyping(Request $request)
    {
        $validated = $request->validate([
            'userId' => 'required|integer|min:1',
            'contactId' => 'required|integer|min:1',
        ]);

        try {
            if (!Schema::hasTable('chat_typing')) {
                return response()->json(['ok' => false, 'reason' => 'disabled']);
            }

            DB::table('chat_typing')->updateOrInsert(
                ['user_id' => $validated['userId'], 'contact_id' => $validated['contactId']],
                ['updated_at' => now()]
            );
            return response()->json(['ok' => true]);
        } catch (\Throwable $exception) {
            report($exception);
            return response()->json(['ok' => false], 500);
        }
    }

    private function fetchReactionsForMessages(array $messageIds): array
    {
        if (empty($messageIds) || !Schema::hasTable('chat_message_reactions')) {
            return [];
        }
        $rows = ChatMessageReaction::whereIn('message_id', $messageIds)->get();
        $grouped = [];
        foreach ($rows as $row) {
            $grouped[$row->message_id][] = [
                'userId' => (int) $row->user_id,
                'emoji' => $row->emoji,
            ];
        }
        return $grouped;
    }

    private function fetchTypingPartners(int $userId): array
    {
        if (!Schema::hasTable('chat_typing')) {
            return [];
        }
        $threshold = now()->subSeconds(6);
        return DB::table('chat_typing')
            ->where('contact_id', $userId)
            ->where('updated_at', '>=', $threshold)
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }

    private function clearTyping(int $userId, int $contactId): void
    {
        if (!Schema::hasTable('chat_typing')) {
            return;
        }
        try {
            DB::table('chat_typing')
                ->where('user_id', $userId)
                ->where('contact_id', $contactId)
                ->delete();
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    private function transformMessage(ChatMessage $message, array $reactionsByMessage): array
    {
        return [
            'id' => $message->id,
            'senderId' => $message->sender_id,
            'recipientId' => $message->recipient_id,
            'text' => $message->text,
            'imageData' => $message->image_data,
            'imageName' => $message->image_name,
            'createdAt' => optional($message->created_at)->toIso8601String(),
            'reactions' => $reactionsByMessage[$message->id] ?? [],
        ];
    }

    private function isChatTableReady(): bool
    {
        try {
            return Schema::hasTable('chat_messages');
        } catch (\Throwable $exception) {
            report($exception);
            return false;
        }
    }

    private function respondFromFallback(int $userId, int $contactId, int $limit, int $afterId)
    {
        $messages = $this->readFallbackMessages()
            ->filter(function (array $message) use ($userId) {
                $sender = array_key_exists('senderId', $message) ? (int) $message['senderId'] : null;
                $recipient = array_key_exists('recipientId', $message) ? (int) $message['recipientId'] : null;
                return $sender === $userId || $recipient === $userId;
            })
            ->filter(function (array $message) use ($contactId, $userId) {
                if ($contactId <= 0) {
                    return true;
                }
                $sender = array_key_exists('senderId', $message) ? (int) $message['senderId'] : null;
                $recipient = array_key_exists('recipientId', $message) ? (int) $message['recipientId'] : null;
                return ($sender === $userId && $recipient === $contactId)
                    || ($sender === $contactId && $recipient === $userId);
            })
            ->filter(function (array $message) use ($afterId) {
                if ($afterId <= 0) {
                    return true;
                }
                return (int) ($message['id'] ?? 0) > $afterId;
            })
            ->sortBy('id')
            ->values()
            ->take($limit)
            ->map(fn (array $message) => $this->formatFallbackMessage($message))
            ->values();

        return response()->json([
            'data' => $messages,
            'typing' => [],
        ]);
    }

    private function storeFallbackMessage(array $payload)
    {
        $messages = $this->readFallbackMessages();
        $nextId = ($messages->max('id') ?? 0) + 1;

        $message = [
            'id' => $nextId,
            'senderId' => $payload['senderId'] ?? null,
            'recipientId' => $payload['recipientId'],
            'text' => $payload['text'] ?? null,
            'imageData' => $payload['imageData'] ?? null,
            'imageName' => $payload['imageName'] ?? null,
            'createdAt' => now()->toIso8601String(),
        ];

        $messages->push($message);
        $this->writeFallbackMessages($messages);

        return response()->json([
            'message' => 'Mensaje enviado correctamente.',
            'data' => $this->formatFallbackMessage($message),
        ], 201);
    }

    private function readFallbackMessages(): Collection
    {
        try {
            if (!Storage::disk('local')->exists($this->fallbackFilePath())) {
                return collect();
            }
            $raw = Storage::disk('local')->get($this->fallbackFilePath());
            $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($decoded)) {
                return collect();
            }

            return collect($decoded);
        } catch (\Throwable $exception) {
            report($exception);
        }

        return collect();
    }

    private function writeFallbackMessages(Collection $messages): void
    {
        try {
            Storage::disk('local')->put(
                $this->fallbackFilePath(),
                $messages->values()->toJson(JSON_PRETTY_PRINT)
            );
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    private function fallbackFilePath(): string
    {
        return 'chat/fallback-messages.json';
    }

    private function formatFallbackMessage(array $message): array
    {
        return [
            'id' => (int) ($message['id'] ?? 0),
            'senderId' => array_key_exists('senderId', $message) ? (int) $message['senderId'] : null,
            'recipientId' => array_key_exists('recipientId', $message) ? (int) $message['recipientId'] : null,
            'text' => $message['text'] ?? null,
            'imageData' => $message['imageData'] ?? null,
            'imageName' => $message['imageName'] ?? null,
            'createdAt' => $message['createdAt'] ?? now()->toIso8601String(),
            'reactions' => [],
        ];
    }
}

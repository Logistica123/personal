<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Persona;
use App\Models\PersonaComment;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

class PersonalCommentController extends Controller
{
    public function store(Request $request, Persona $persona): JsonResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string'],
            'userId' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $comment = $persona->comments()->create([
            'message' => trim($validated['message']),
            'user_id' => $validated['userId'] ?? null,
        ]);

        $comment->load('user:id,name');

        $this->notifyStakeholders($persona, $comment, $validated['userId'] ?? null);

        return response()->json([
            'message' => 'Comentario agregado correctamente.',
            'data' => $this->transformComment($comment),
        ], 201);
    }

    protected function transformComment(PersonaComment $comment): array
    {
        return [
            'id' => $comment->id,
            'message' => $comment->message,
            'userId' => $comment->user_id,
            'userName' => $comment->user?->name,
            'createdAt' => $comment->created_at?->toIso8601String(),
            'createdAtLabel' => $comment->created_at?->timezone(config('app.timezone', 'UTC'))?->format('d/m/Y H:i'),
        ];
    }

    protected function notifyStakeholders(Persona $persona, PersonaComment $comment, ?int $authorId = null): void
    {
        $recipients = collect($persona->agentes_responsables_ids ?? [])
            ->prepend($persona->agente_responsable_id)
            ->push($persona->agente_id)
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->reject(fn ($id) => $authorId !== null && $id === $authorId)
            ->values();

        if ($recipients->isEmpty()) {
            return;
        }

        $message = sprintf(
            'Nuevo comentario en la solicitud de alta para %s.',
            trim(sprintf('%s %s', $persona->nombres ?? '', $persona->apellidos ?? '')) ?: sprintf('ID #%d', $persona->id)
        );

        $hasMessageColumn = Schema::hasColumn('notifications', 'message');
        $hasDescriptionColumn = Schema::hasColumn('notifications', 'description');
        $hasTypeColumn = Schema::hasColumn('notifications', 'type');
        $hasEntityTypeColumn = Schema::hasColumn('notifications', 'entity_type');
        $hasEntityIdColumn = Schema::hasColumn('notifications', 'entity_id');
        $hasMetadataColumn = Schema::hasColumn('notifications', 'metadata');

        foreach ($recipients as $userId) {
            $payload = ['user_id' => $userId];

            if ($hasMessageColumn) {
                $payload['message'] = $message;
            } elseif ($hasDescriptionColumn) {
                $payload['description'] = $message;
            }

            if ($hasTypeColumn) {
                $payload['type'] = 'personal_comentario_nuevo';
            }

            if ($hasEntityTypeColumn) {
                $payload['entity_type'] = 'persona';
            }
            if ($hasEntityIdColumn) {
                $payload['entity_id'] = $persona->id;
            }

            if ($hasMetadataColumn) {
                $payload['metadata'] = [
                    'persona_id' => $persona->id,
                    'comment_id' => $comment->id,
                ];
            }

            try {
                Notification::create($payload);
            } catch (QueryException $exception) {
                report($exception);
            }
        }
    }
}

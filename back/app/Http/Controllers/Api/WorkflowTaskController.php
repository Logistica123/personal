<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use App\Models\WorkflowTask;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class WorkflowTaskController extends Controller
{
    protected function resolveTaskFromRoute(Request $request, WorkflowTask $task): WorkflowTask
    {
        if ($task->exists) {
            return $task;
        }

        $routeId = $request->route('workflowTask');
        $fallbackId = $request->input('taskId');
        $taskId = $routeId ?? $fallbackId;

        if ($taskId) {
            $found = WorkflowTask::query()->find($taskId);
            if ($found) {
                return $found;
            }
        }

        abort(404, 'Tarea no encontrada.');
    }

    protected function transformTask(WorkflowTask $task): array
    {
        return [
            'id' => $task->id,
            'titulo' => $task->titulo,
            'descripcion' => $task->descripcion,
            'status' => $task->status,
                'creatorId' => $task->creator_id,
                'creatorNombre' => $task->creator?->name ?? $task->creator_email,
                'responsableId' => $task->responsable_id,
                'responsableNombre' => $task->responsable?->name ?? $task->responsable_email,
            'createdAt' => $task->created_at?->toIso8601String(),
            'updatedAt' => $task->updated_at?->toIso8601String(),
        ];
    }

    protected function notifyResponsableAssignment(WorkflowTask $task): void
    {
        if (! $task->responsable_id) {
            return;
        }

        $responsableId = (int) $task->responsable_id;
        $creatorName = $task->creator?->name ?? $task->creator_email ?? 'Otro usuario';
        $titulo = trim($task->titulo ?? '') ?: 'Tarea';

        $message = sprintf(
            '%s te asignó la tarea "%s" en el flujo de trabajo.',
            $creatorName,
            $titulo
        );

        $hasMessageColumn = Schema::hasColumn('notifications', 'message');
        $hasDescriptionColumn = Schema::hasColumn('notifications', 'description');
        $hasEntityTypeColumn = Schema::hasColumn('notifications', 'entity_type');
        $hasEntityIdColumn = Schema::hasColumn('notifications', 'entity_id');
        $hasTypeColumn = Schema::hasColumn('notifications', 'type');
        $hasMetadataColumn = Schema::hasColumn('notifications', 'metadata');

        $payload = [
            'user_id' => $responsableId,
        ];

        if ($hasMessageColumn) {
            $payload['message'] = $message;
        } elseif ($hasDescriptionColumn) {
            $payload['description'] = $message;
        }

        if ($hasTypeColumn) {
            $payload['type'] = 'workflow_task_asignada';
        }

        if ($hasEntityTypeColumn) {
            $payload['entity_type'] = 'workflow_task';
        }
        if ($hasEntityIdColumn) {
            $payload['entity_id'] = $task->id;
        }

        if ($hasMetadataColumn) {
            $payload['metadata'] = [
                'workflow_task_id' => $task->id,
                'workflow_task_label' => 'Tarea asignada',
                'status' => $task->status,
                'titulo' => $titulo,
                'creator_id' => $task->creator_id,
                'creator_email' => $task->creator_email,
            ];
        }

        try {
            Notification::create($payload);
        } catch (QueryException $exception) {
            report($exception);

            $fallbackPayload = [
                'user_id' => $responsableId,
            ];

            if ($hasMessageColumn) {
                $fallbackPayload['message'] = $message;
            } elseif ($hasDescriptionColumn) {
                $fallbackPayload['description'] = $message;
            }

            if ($hasTypeColumn) {
                $fallbackPayload['type'] = 'workflow_task_asignada';
            }

            if ($hasEntityTypeColumn) {
                $fallbackPayload['entity_type'] = 'workflow_task';
            }
            if ($hasEntityIdColumn) {
                $fallbackPayload['entity_id'] = $task->id;
            }

            try {
                Notification::create($fallbackPayload);
            } catch (QueryException $retryException) {
                report($retryException);
            }
        }
    }

    protected function notifyCreatorCompletion(WorkflowTask $task, ?User $actor = null): void
    {
        $creatorId = $task->creator_id;

        if (! $creatorId && $task->creator_email) {
            $creatorId = User::query()
                ->whereRaw('LOWER(email) = ?', [strtolower($task->creator_email)])
                ->value('id');

            if ($creatorId) {
                $task->creator_id = $creatorId;
                $task->save();
            }
        }

        if (! $creatorId) {
            return;
        }

        $actorName = $actor?->name
            ?? $task->responsable?->name
            ?? $task->responsable_email
            ?? 'Otro usuario';

        $titulo = trim($task->titulo ?? '') ?: 'Tarea';

        $message = sprintf(
            '%s marcó la tarea \"%s\" como finalizada.',
            $actorName,
            $titulo
        );

        $hasMessageColumn = Schema::hasColumn('notifications', 'message');
        $hasDescriptionColumn = Schema::hasColumn('notifications', 'description');
        $hasEntityTypeColumn = Schema::hasColumn('notifications', 'entity_type');
        $hasEntityIdColumn = Schema::hasColumn('notifications', 'entity_id');
        $hasTypeColumn = Schema::hasColumn('notifications', 'type');
        $hasMetadataColumn = Schema::hasColumn('notifications', 'metadata');

        $payload = [
            'user_id' => $creatorId,
        ];

        if ($hasMessageColumn) {
            $payload['message'] = $message;
        } elseif ($hasDescriptionColumn) {
            $payload['description'] = $message;
        }

        if ($hasTypeColumn) {
            $payload['type'] = 'workflow_task_finalizada';
        }

        if ($hasEntityTypeColumn) {
            $payload['entity_type'] = 'workflow_task';
        }
        if ($hasEntityIdColumn) {
            $payload['entity_id'] = $task->id;
        }

        if ($hasMetadataColumn) {
            $payload['metadata'] = [
                'workflow_task_id' => $task->id,
                'workflow_task_label' => 'Tarea finalizada',
                'status' => $task->status,
                'titulo' => $titulo,
                'responsable_id' => $task->responsable_id,
                'responsable_email' => $task->responsable_email,
                'actor_id' => $actor?->id,
            ];
        }

        try {
            Notification::create($payload);
        } catch (QueryException $exception) {
            report($exception);

            $fallbackPayload = [
                'user_id' => $creatorId,
            ];

            if ($hasMessageColumn) {
                $fallbackPayload['message'] = $message;
            } elseif ($hasDescriptionColumn) {
                $fallbackPayload['description'] = $message;
            }

            if ($hasTypeColumn) {
                $fallbackPayload['type'] = 'workflow_task_finalizada';
            }

            if ($hasEntityTypeColumn) {
                $fallbackPayload['entity_type'] = 'workflow_task';
            }
            if ($hasEntityIdColumn) {
                $fallbackPayload['entity_id'] = $task->id;
            }

            try {
                Notification::create($fallbackPayload);
            } catch (QueryException $retryException) {
                report($retryException);
            }
        }
    }

    protected function authorizeActor(WorkflowTask $task, ?int $actorId): void
    {
        if (! $task->exists) {
            abort(404, 'Tarea no encontrada.');
        }

        if (! $actorId) {
            abort(403, 'Usuario no autorizado.');
        }

        $actorId = (int) $actorId;

        $user = User::query()->find($actorId);
        if (! $user) {
            abort(403, 'Usuario no autorizado.');
        }

        $role = strtolower(trim((string) $user->role));
        $permissions = $user->permissions ?? null;
        $canByPermission = is_array($permissions) && in_array('flujo-trabajo', $permissions, true);

        if (str_contains($role, 'admin') || $role === 'encargado' || $canByPermission) {
            return;
        }

        // Autocorrige tareas antiguas sin datos
        if (! $task->creator_id && ! $task->creator_email) {
            $task->creator_id = $actorId;
            $task->creator_email = $user->email;
            $task->save();
            return;
        }

        if (! $task->responsable_id && ! $task->responsable_email) {
            $task->responsable_id = $actorId;
            $task->responsable_email = $user->email;
            $task->save();
            return;
        }

        if ((int) $task->creator_id === $actorId || (int) $task->responsable_id === $actorId) {
            return;
        }

        $task->loadMissing(['creator:id,email,name', 'responsable:id,email,name']);

        $actorEmail = strtolower((string) $user->email);
        $actorName = strtolower(trim((string) $user->name));
        if ($actorEmail) {
            $creatorEmail = strtolower((string) ($task->creator_email ?? $task->creator?->email));
            $responsableEmail = strtolower((string) ($task->responsable_email ?? $task->responsable?->email));

            if ($creatorEmail && $creatorEmail === $actorEmail) {
                if (! $task->creator_id) {
                    $task->creator_id = $actorId;
                    $task->save();
                }
                return;
            }

            if ($responsableEmail && $responsableEmail === $actorEmail) {
                if (! $task->responsable_id) {
                    $task->responsable_id = $actorId;
                    $task->save();
                }
                return;
            }
        }

        if ($actorName) {
            $creatorName = strtolower(trim((string) ($task->creator?->name ?? $task->creator_email)));
            $responsableName = strtolower(trim((string) ($task->responsable?->name ?? $task->responsable_email)));

            if ($creatorName && $creatorName === $actorName) {
                if (! $task->creator_id) {
                    $task->creator_id = $actorId;
                    $task->save();
                }
                return;
            }

            if ($responsableName && $responsableName === $actorName) {
                if (! $task->responsable_id) {
                    $task->responsable_id = $actorId;
                    $task->save();
                }
                return;
            }
        }

        logger()->warning('Workflow task unauthorized', [
            'task_id' => $task->id,
            'actor_id' => $actorId,
            'actor_email' => $actorEmail,
            'actor_name' => $actorName,
            'creator_id' => $task->creator_id,
            'creator_email' => $task->creator_email ?? $task->creator?->email,
            'creator_name' => $task->creator?->name ?? $task->creator_email,
            'responsable_id' => $task->responsable_id,
            'responsable_email' => $task->responsable_email ?? $task->responsable?->email,
            'responsable_name' => $task->responsable?->name ?? $task->responsable_email,
        ]);

        abort(403, 'No tienes permisos para modificar esta tarea (actor '.$actorId.').');
    }

    protected function buildTaskQueryForUser(User $user): Builder
    {
        $normalizedEmail = strtolower((string) $user->email);
        $normalizedName = strtolower(trim((string) $user->name));

        return WorkflowTask::query()
            ->with(['creator:id,name,email', 'responsable:id,name,email'])
            ->where(function ($query) use ($user) {
                $query->where('creator_id', $user->id)
                    ->orWhere('responsable_id', $user->id);
            })
            ->when($normalizedEmail, function ($query) use ($normalizedEmail) {
                $query->orWhere(function ($subQuery) use ($normalizedEmail) {
                    $subQuery->whereRaw('LOWER(creator_email) = ?', [$normalizedEmail])
                        ->orWhereRaw('LOWER(responsable_email) = ?', [$normalizedEmail])
                        ->orWhereHas('creator', fn ($rel) => $rel->whereRaw('LOWER(email) = ?', [$normalizedEmail]))
                        ->orWhereHas('responsable', fn ($rel) => $rel->whereRaw('LOWER(email) = ?', [$normalizedEmail]));
                });
            })
            ->when($normalizedName, function ($query) use ($normalizedName) {
                $query->orWhereHas('creator', fn ($rel) => $rel->whereRaw('LOWER(TRIM(name)) = ?', [$normalizedName]))
                    ->orWhereHas('responsable', fn ($rel) => $rel->whereRaw('LOWER(TRIM(name)) = ?', [$normalizedName]));
            });
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'userId' => ['required', 'integer', 'exists:users,id'],
        ]);

        /** @var \App\Models\User|null $user */
        $user = User::query()->find($validated['userId']);
        if (! $user) {
            return response()->json(['data' => []]);
        }

        $tasks = $this->buildTaskQueryForUser($user)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (WorkflowTask $task) => $this->transformTask($task));

        return response()->json(['data' => $tasks]);
    }

    public function export(Request $request): StreamedResponse
    {
        $validated = $request->validate([
            'userId' => ['required', 'integer', 'exists:users,id'],
        ]);

        $user = User::query()->findOrFail($validated['userId']);

        $tasks = $this->buildTaskQueryForUser($user)
            ->orderByDesc('created_at')
            ->get();

        $filename = sprintf('workflow-tasks-%d-%s.csv', $user->id, now()->format('Ymd_His'));
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ];

        return response()->streamDownload(function () use ($tasks): void {
            $handle = fopen('php://output', 'w');
            if (! $handle) {
                return;
            }

            fputcsv($handle, [
                'ID',
                'Título',
                'Descripción',
                'Estado',
                'Creador',
                'Email Creador',
                'Responsable',
                'Email Responsable',
                'Creado',
                'Actualizado',
            ]);

            foreach ($tasks as $task) {
                fputcsv($handle, [
                    $task->id,
                    $task->titulo,
                    $task->descripcion,
                    $task->status,
                    $task->creator?->name ?? $task->creator_email,
                    $task->creator_email ?? $task->creator?->email,
                    $task->responsable?->name ?? $task->responsable_email,
                    $task->responsable_email ?? $task->responsable?->email,
                    optional($task->created_at)->toDateTimeString(),
                    optional($task->updated_at)->toDateTimeString(),
                ]);
            }

            fclose($handle);
        }, $filename, $headers);
    }

    public function store(Request $request): JsonResponse
    {
        logger()->info('workflow.store.payload', $request->all());

        $validated = $request->validate([
            'titulo' => ['nullable', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['nueva', 'proceso', 'finalizado'])],
            'creatorId' => ['required', 'integer', 'exists:users,id'],
            'responsableId' => ['required', 'integer', 'exists:users,id'],
        ]);

        $creatorEmail = User::query()->where('id', $validated['creatorId'])->value('email');
        $responsableEmail = User::query()->where('id', $validated['responsableId'])->value('email');

        $titulo = trim($validated['titulo'] ?? '') ?: 'Tarea';

        $task = WorkflowTask::query()->create([
            'titulo' => $titulo,
            'descripcion' => $validated['descripcion'] ?? null,
            'status' => $validated['status'] ?? 'nueva',
            'creator_id' => $validated['creatorId'],
            'creator_email' => $creatorEmail,
            'responsable_id' => $validated['responsableId'],
            'responsable_email' => $responsableEmail,
        ]);

        $task->load(['creator:id,name,email', 'responsable:id,name,email']);
        $this->notifyResponsableAssignment($task);

        return response()->json([
            'message' => 'Tarea creada correctamente.',
            'data' => $this->transformTask($task),
        ], 201);
    }

    public function update(Request $request, WorkflowTask $task): JsonResponse
    {
        $task = $this->resolveTaskFromRoute($request, $task);

        $validated = $request->validate([
            'titulo' => ['nullable', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['nueva', 'proceso', 'finalizado'])],
            'responsableId' => ['nullable', 'integer', 'exists:users,id'],
            'actorId' => ['required', 'integer', 'exists:users,id'],
        ]);

        $this->authorizeActor($task, $validated['actorId']);

        $previousStatus = $task->status;

        if (isset($validated['titulo'])) {
            $task->titulo = trim($validated['titulo']);
        }

        if (array_key_exists('descripcion', $validated)) {
            $task->descripcion = $validated['descripcion'] ?? null;
        }

        if (isset($validated['status'])) {
            $task->status = $validated['status'];
        }

        if (isset($validated['responsableId'])) {
            $task->responsable_id = $validated['responsableId'];
        }

        $task->save();
        $task->load(['creator:id,name,email', 'responsable:id,name,email']);

        if ($previousStatus !== 'finalizado' && $task->status === 'finalizado') {
            $actor = User::query()->find($validated['actorId']);
            $this->notifyCreatorCompletion($task, $actor);
        }

        return response()->json([
            'message' => 'Tarea actualizada correctamente.',
            'data' => $this->transformTask($task),
        ]);
    }

    public function updateStatus(Request $request, WorkflowTask $task): JsonResponse
    {
        $task = $this->resolveTaskFromRoute($request, $task);

        $validated = $request->validate([
            'status' => ['required', Rule::in(['nueva', 'proceso', 'finalizado'])],
            'actorId' => ['required', 'integer', 'exists:users,id'],
        ]);

        $actor = User::query()->find($validated['actorId']);
        $previousStatus = $task->status;

        logger()->info('workflow.updateStatus', [
            'task_id' => $task->id,
            'payload' => $validated,
        ]);

        $this->authorizeActor($task, $validated['actorId']);

        $task->status = $validated['status'];
        $task->save();
        $task->load(['creator:id,name', 'responsable:id,name']);

        if ($previousStatus !== 'finalizado' && $task->status === 'finalizado') {
            $this->notifyCreatorCompletion($task, $actor);
        }

        return response()->json([
            'message' => 'Estado actualizado correctamente.',
            'data' => $this->transformTask($task),
        ]);
    }

    public function destroy(Request $request, WorkflowTask $task): JsonResponse
    {
        $task = $this->resolveTaskFromRoute($request, $task);

        $validated = $request->validate([
            'actorId' => ['required', 'integer', 'exists:users,id'],
        ]);

        $this->authorizeActor($task, $validated['actorId']);
        $task->delete();

        return response()->json([
            'message' => 'Tarea eliminada correctamente.',
        ]);
    }

    public function users(): JsonResponse
    {
        $users = User::query()
            ->select('id', 'name')
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'nombre' => $user->name,
            ]);

        return response()->json(['data' => $users]);
    }
}

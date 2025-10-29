<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Persona;
use App\Models\Reclamo;
use App\Models\ReclamoDocument;
use App\Models\ReclamoType;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ReclamoController extends Controller
{
    public function index(): JsonResponse
    {
        $reclamos = Reclamo::query()
            ->with([
                'creator:id,name',
                'agente:id,name',
                'tipo:id,nombre',
                'persona' => fn ($query) => $query->select(
                    'id',
                    'nombres',
                    'apellidos',
                    'cliente_id'
                ),
                'persona.cliente:id,nombre',
            ])
            ->orderByDesc('fecha_alta')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Reclamo $reclamo) => $this->transformReclamo($reclamo))
            ->values();

        return response()->json(['data' => $reclamos]);
    }

    public function meta(): JsonResponse
    {
        $agentes = User::query()
            ->select('id', 'name')
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'nombre' => $user->name,
            ])
            ->values();

        $transportistas = Persona::query()
            ->select('id', 'nombres', 'apellidos')
            ->where('aprobado', true)
            ->orderBy('apellidos')
            ->orderBy('nombres')
            ->get()
            ->map(fn (Persona $persona) => [
                'id' => $persona->id,
                'nombre' => trim(($persona->nombres ?? '').' '.($persona->apellidos ?? '')) ?: 'Sin nombre',
            ])
            ->values();

        $tipos = ReclamoType::query()
            ->select('id', 'nombre')
            ->orderBy('nombre')
            ->get()
            ->map(fn (ReclamoType $tipo) => [
                'id' => $tipo->id,
                'nombre' => $tipo->nombre,
            ])
            ->values();

        $estados = collect($this->statusLabels())
            ->map(fn (string $label, string $value) => [
                'value' => $value,
                'label' => $label,
            ])
            ->values();

        return response()->json([
            'data' => [
                'agentes' => $agentes,
                'creadores' => $agentes,
                'transportistas' => $transportistas,
                'tipos' => $tipos,
                'estados' => $estados,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'detalle' => ['nullable', 'string'],
            'agenteId' => ['nullable', 'integer', 'exists:users,id'],
            'creatorId' => ['nullable', 'integer', 'exists:users,id'],
            'transportistaId' => ['required', 'integer', 'exists:personas,id'],
            'tipoId' => ['required', 'integer', 'exists:reclamo_types,id'],
            'status' => ['required', Rule::in(array_keys($this->statusLabels()))],
            'pagado' => ['required', 'boolean'],
            'fechaReclamo' => ['nullable', 'date'],
        ]);

        $reclamo = DB::transaction(function () use ($request, $validated) {
            /** @var \App\Models\User|null $authenticated */
            $authenticated = $request->user();
            $creatorId = $validated['creatorId'] ?? $authenticated?->id ?? null;

            $reclamo = Reclamo::create([
                'creator_id' => $creatorId,
                'agente_id' => $validated['agenteId'] ?? null,
                'persona_id' => $validated['transportistaId'],
                'reclamo_type_id' => $validated['tipoId'],
                'detalle' => isset($validated['detalle']) ? trim($validated['detalle']) : null,
                'fecha_alta' => isset($validated['fechaReclamo'])
                    ? Carbon::parse($validated['fechaReclamo'])
                    : null,
                'status' => $validated['status'],
                'pagado' => (bool) $validated['pagado'],
            ]);

            $actorId = $creatorId ?? $validated['agenteId'] ?? null;

            $this->recordComment($reclamo, 'Reclamo creado inicialmente', [
                'status' => $reclamo->status,
            ], $actorId);

            $this->recordStatusChange($reclamo, null, $reclamo->status, $actorId);

            return $reclamo;
        });

        $reclamo->loadMissing([
            'creator:id,name',
            'agente:id,name',
            'tipo:id,nombre',
            'persona' => fn ($query) => $query->select(
                'id',
                'nombres',
                'apellidos',
                'cliente_id',
                'cuil',
                'telefono',
                'email',
                'patente',
                'fecha_alta',
                'sucursal_id',
                'unidad_id',
                'agente_id'
            ),
            'persona.cliente:id,nombre',
            'persona.sucursal:id,nombre',
            'persona.unidad:id,matricula,marca,modelo',
            'persona.agente:id,name',
            'comments.creator:id,name',
            'comments.senderUser:id,name',
            'comments.senderPersona:id,nombres,apellidos',
            'logs.actor:id,name',
            'documents' => fn ($query) => $query->orderByDesc('created_at'),
        ]);

        if ($reclamo->agente_id) {
            $this->createAssignmentNotification($reclamo, (int) $reclamo->agente_id);
        }

        return response()->json([
            'message' => 'Reclamo creado correctamente.',
            'data' => $this->transformReclamo($reclamo, true),
        ], 201);
    }

    public function show(Reclamo $reclamo): JsonResponse
    {
        $reclamo->loadMissing([
            'creator:id,name',
            'agente:id,name',
            'tipo:id,nombre',
            'persona' => fn ($query) => $query->select(
                'id',
                'nombres',
                'apellidos',
                'cliente_id',
                'cuil',
                'telefono',
                'email',
                'patente',
                'fecha_alta',
                'sucursal_id',
                'unidad_id',
                'agente_id'
            ),
            'persona.cliente:id,nombre',
            'persona.sucursal:id,nombre',
            'persona.unidad:id,matricula,marca,modelo',
            'persona.agente:id,name',
            'comments' => fn ($query) => $query->orderBy('created_at'),
            'comments.creator:id,name',
            'comments.senderUser:id,name',
            'comments.senderPersona:id,nombres,apellidos',
            'logs' => fn ($query) => $query->orderBy('created_at'),
            'logs.actor:id,name',
            'documents' => fn ($query) => $query->orderByDesc('created_at'),
        ]);

        return response()->json([
            'data' => $this->transformReclamo($reclamo, true),
        ]);
    }

    public function update(Request $request, Reclamo $reclamo): JsonResponse
    {
        $validated = $request->validate([
            'detalle' => ['nullable', 'string'],
            'agenteId' => ['nullable', 'integer', 'exists:users,id'],
            'creatorId' => ['nullable', 'integer', 'exists:users,id'],
            'transportistaId' => ['required', 'integer', 'exists:personas,id'],
            'tipoId' => ['required', 'integer', 'exists:reclamo_types,id'],
            'status' => ['required', Rule::in(array_keys($this->statusLabels()))],
            'pagado' => ['required', 'boolean'],
            'fechaReclamo' => ['nullable', 'date'],
        ]);

        $reclamo->loadMissing('agente:id,name');
        $originalAgente = $reclamo->agente_id;
        $originalAgenteName = $reclamo->agente?->name;
        $agentChanged = false;
        $newAgenteId = null;

        DB::transaction(function () use ($reclamo, $validated, $originalAgente, $originalAgenteName, &$agentChanged, &$newAgenteId) {
            $originalStatus = $reclamo->status;
            $originalPagado = (bool) $reclamo->pagado;

            $reclamo->creator_id = $validated['creatorId'] ?? null;
            $reclamo->agente_id = $validated['agenteId'] ?? null;
            $reclamo->persona_id = $validated['transportistaId'];
            $reclamo->reclamo_type_id = $validated['tipoId'];
            $reclamo->detalle = isset($validated['detalle']) ? trim($validated['detalle']) : null;
            $reclamo->fecha_alta = isset($validated['fechaReclamo'])
                ? Carbon::parse($validated['fechaReclamo'])
                : null;
            $reclamo->status = $validated['status'];
            $reclamo->pagado = (bool) $validated['pagado'];

            $reclamo->save();

            $actorId = $validated['creatorId'] ?? $validated['agenteId'] ?? null;
            $newAgenteId = $reclamo->agente_id;

            if ($originalStatus !== $reclamo->status) {
                $this->recordStatusChange($reclamo, $originalStatus, $reclamo->status, $actorId);
            }

            if ($originalPagado !== (bool) $reclamo->pagado) {
                $this->recordComment(
                    $reclamo,
                    sprintf('Pagado actualizado a %s', $reclamo->pagado ? 'Sí' : 'No'),
                    [
                        'old' => $originalPagado,
                        'new' => (bool) $reclamo->pagado,
                        'field' => 'pagado',
                    ],
                    $actorId
                );
            }

            if ($originalAgente !== $reclamo->agente_id) {
                $agentChanged = true;

                $oldName = $originalAgente ? (User::query()->find($originalAgente)?->name ?? 'Sin asignar') : ($originalAgenteName ?? 'Sin asignar');
                $newName = $reclamo->agente_id ? (User::query()->find($reclamo->agente_id)?->name ?? 'Sin asignar') : 'Sin asignar';

                $this->recordComment(
                    $reclamo,
                    sprintf('Responsable actualizado de %s a %s', $oldName, $newName),
                    [
                        'old' => $originalAgente,
                        'new' => $reclamo->agente_id,
                        'field' => 'agente_id',
                    ],
                    $actorId
                );
            }
        });

        $reclamo->refresh()->loadMissing([
            'creator:id,name',
            'agente:id,name',
            'tipo:id,nombre',
            'persona' => fn ($query) => $query->select(
                'id',
                'nombres',
                'apellidos',
                'cliente_id',
                'cuil',
                'telefono',
                'email',
                'patente',
                'fecha_alta',
                'sucursal_id',
                'unidad_id',
                'agente_id'
            ),
            'persona.cliente:id,nombre',
            'persona.sucursal:id,nombre',
            'persona.unidad:id,matricula,marca,modelo',
            'persona.agente:id,name',
            'comments' => fn ($query) => $query->orderBy('created_at'),
            'comments.creator:id,name',
            'comments.senderUser:id,name',
            'comments.senderPersona:id,nombres,apellidos',
            'logs' => fn ($query) => $query->orderBy('created_at'),
            'logs.actor:id,name',
        ]);

        if ($agentChanged && $newAgenteId) {
            $this->createAssignmentNotification($reclamo, (int) $newAgenteId);
        }

        return response()->json([
            'message' => 'Reclamo actualizado correctamente.',
            'data' => $this->transformReclamo($reclamo, true),
        ]);
    }

    public function storeComment(Request $request, Reclamo $reclamo): JsonResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'creatorId' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $message = trim($validated['message']);
        if ($message === '') {
            return response()->json([
                'message' => 'El comentario no puede estar vacío.',
            ], 422);
        }

        DB::transaction(function () use ($reclamo, $message, $validated) {
            $this->recordComment(
                $reclamo,
                $message,
                null,
                $validated['creatorId'] ?? null
            );
        });

        $reclamo->refresh()->loadMissing([
            'creator:id,name',
            'agente:id,name',
            'tipo:id,nombre',
            'persona' => fn ($query) => $query->select(
                'id',
                'nombres',
                'apellidos',
                'cliente_id',
                'cuil',
                'telefono',
                'email',
                'patente',
                'fecha_alta',
                'sucursal_id',
                'unidad_id',
                'agente_id'
            ),
            'persona.cliente:id,nombre',
            'persona.sucursal:id,nombre',
            'persona.unidad:id,matricula,marca,modelo',
            'persona.agente:id,name',
            'comments' => fn ($query) => $query->orderBy('created_at'),
            'comments.creator:id,name',
            'comments.senderUser:id,name',
            'comments.senderPersona:id,nombres,apellidos',
            'logs' => fn ($query) => $query->orderBy('created_at'),
            'logs.actor:id,name',
            'documents' => fn ($query) => $query->orderByDesc('created_at'),
        ]);

        return response()->json([
            'message' => 'Comentario agregado correctamente.',
            'data' => $this->transformReclamo($reclamo, true),
        ], 201);
    }

    public function storeDocument(Request $request, Reclamo $reclamo): JsonResponse
    {
        $validated = $request->validate([
            'archivo' => ['required', 'file', 'max:5120'],
            'nombre' => ['nullable', 'string', 'max:255'],
            'creatorId' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        /** @var UploadedFile $file */
        $file = $validated['archivo'];
        $disk = 'public';
        $directory = 'reclamos/'.$reclamo->id;
        $storedPath = $file->store($directory, $disk);
        $downloadUrl = Storage::disk($disk)->url($storedPath);

        $document = $reclamo->documents()->create([
            'nombre_original' => $validated['nombre'] ?? $file->getClientOriginalName(),
            'disk' => $disk,
            'path' => $storedPath,
            'download_url' => $downloadUrl,
            'mime' => $file->getClientMimeType(),
            'size' => $file->getSize(),
        ]);

        $this->recordComment(
            $reclamo,
            sprintf('Documento "%s" agregado.', $document->nombre_original ?? basename($document->path)),
            [
                'document_id' => $document->id,
                'path' => $document->path,
            ],
            $validated['creatorId'] ?? null
        );

        $reclamo->refresh()->loadMissing([
            'creator:id,name',
            'agente:id,name',
            'tipo:id,nombre',
            'persona' => fn ($query) => $query->select(
                'id',
                'nombres',
                'apellidos',
                'cliente_id',
                'cuil',
                'telefono',
                'email',
                'patente',
                'fecha_alta',
                'sucursal_id',
                'unidad_id',
                'agente_id'
            ),
            'persona.cliente:id,nombre',
            'persona.sucursal:id,nombre',
            'persona.unidad:id,matricula,marca,modelo',
            'persona.agente:id,name',
            'comments' => fn ($query) => $query->orderBy('created_at'),
            'comments.creator:id,name',
            'comments.senderUser:id,name',
            'comments.senderPersona:id,nombres,apellidos',
            'logs' => fn ($query) => $query->orderBy('created_at'),
            'logs.actor:id,name',
            'documents' => fn ($query) => $query->orderByDesc('created_at'),
        ]);

        return response()->json([
            'message' => 'Documento cargado correctamente.',
            'data' => $this->transformReclamo($reclamo, true),
        ], 201);
    }

    public function destroy(Reclamo $reclamo): JsonResponse
    {
        DB::transaction(function () use ($reclamo) {
            $documents = $reclamo->documents()->get();

            foreach ($documents as $documento) {
                if ($documento->disk && $documento->path) {
                    try {
                        Storage::disk($documento->disk)->delete($documento->path);
                    } catch (\Throwable $exception) {
                        report($exception);
                    }
                }

                $documento->delete();
            }

            $reclamo->comments()->delete();
            $reclamo->logs()->delete();
            $reclamo->delete();
        });

        return response()->json([
            'message' => 'Reclamo eliminado correctamente.',
        ]);
    }

    public function downloadDocument(Reclamo $reclamo, ReclamoDocument $documento)
    {
        if ($documento->reclamo_id !== $reclamo->id) {
            abort(404);
        }

        $disk = $documento->disk ?? config('filesystems.default');

        if (! Storage::disk($disk)->exists($documento->path)) {
            abort(404, 'Archivo no encontrado.');
        }

        $filename = $documento->nombre_original ?? basename($documento->path);

        return Storage::disk($disk)->download($documento->path, $filename);
    }

    protected function transformReclamo(Reclamo $reclamo, bool $withHistory = false): array
    {
        $statusLabels = $this->statusLabels();
        $statusLabel = $statusLabels[$reclamo->status] ?? Str::title(str_replace('_', ' ', (string) $reclamo->status));
        $fechaReferencia = $reclamo->fecha_alta ?? $reclamo->created_at;

        $persona = $reclamo->persona;
        $transportistaDetail = null;

        if ($withHistory && $persona) {
            $transportistaDetail = [
                'id' => $persona->id,
                'nombreCompleto' => trim(($persona->nombres ?? '').' '.($persona->apellidos ?? '')) ?: null,
                'cuil' => $persona->cuil,
                'telefono' => $persona->telefono,
                'email' => $persona->email,
                'cliente' => $persona->cliente?->nombre,
                'sucursal' => $persona->sucursal?->nombre,
                'unidad' => $persona->unidad?->matricula,
                'unidadDetalle' => $persona->unidad
                    ? trim(($persona->unidad->marca ?? '').' '.($persona->unidad->modelo ?? '')) ?: null
                    : null,
                'patente' => $persona->patente,
                'agente' => $persona->agente?->name,
                'agenteId' => $persona->agente_id,
                'fechaAlta' => optional($persona->fecha_alta)->format('Y-m-d'),
            ];
        }

        $base = [
            'id' => $reclamo->id,
            'codigo' => $this->formatReclamoCodigo($reclamo),
            'detalle' => $reclamo->detalle,
            'fechaReclamo' => $fechaReferencia?->format('Y-m-d'),
            'fechaReclamoIso' => $fechaReferencia?->toIso8601String(),
            'status' => $reclamo->status,
            'statusLabel' => $statusLabel,
            'pagado' => (bool) $reclamo->pagado,
            'pagadoLabel' => $reclamo->pagado ? 'Sí' : 'No',
            'creator' => $reclamo->creator?->name,
            'creatorId' => $reclamo->creator_id,
            'agente' => $reclamo->agente?->name,
            'agenteId' => $reclamo->agente_id,
            'transportista' => $reclamo->persona ? trim(($reclamo->persona->nombres ?? '').' '.($reclamo->persona->apellidos ?? '')) ?: null : null,
            'transportistaId' => $reclamo->persona_id,
            'cliente' => $reclamo->persona?->cliente?->nombre,
            'tipo' => $reclamo->tipo?->nombre,
            'tipoId' => $reclamo->reclamo_type_id,
            'createdAt' => $reclamo->created_at?->toIso8601String(),
            'updatedAt' => $reclamo->updated_at?->toIso8601String(),
            'transportistaDetail' => $transportistaDetail,
        ];

        if ($withHistory) {
            $documents = $reclamo->documents ?? collect();
            $base['documents'] = $documents
                ->map(fn (ReclamoDocument $document) => [
                    'id' => $document->id,
                    'nombre' => $document->nombre_original ?? basename($document->path),
                    'downloadUrl' => $document->download_url,
                    'mime' => $document->mime,
                    'size' => $document->size,
                    'uploadedAt' => $document->created_at?->toIso8601String(),
                    'uploadedAtLabel' => $document->created_at?->format('Y-m-d H:i'),
                ])
                ->values()
                ->all();
        }

        if (! $withHistory) {
            return $base;
        }

        $comments = $reclamo->comments ?? collect();
        $logs = $reclamo->logs ?? collect();

        $history = collect();

        foreach ($logs as $log) {
            $oldLabel = $log->old_status
                ? ($statusLabels[$log->old_status] ?? Str::title(str_replace('_', ' ', (string) $log->old_status)))
                : 'Sin estado';
            $newLabel = $log->new_status
                ? ($statusLabels[$log->new_status] ?? Str::title(str_replace('_', ' ', (string) $log->new_status)))
                : 'Sin estado';

            $history->push([
                'id' => 'log-'.$log->id,
                'type' => 'status_change',
                'message' => sprintf('Estado cambiado de %s a %s', $oldLabel, $newLabel),
                'oldStatus' => $log->old_status,
                'oldStatusLabel' => $log->old_status ? ($statusLabels[$log->old_status] ?? $oldLabel) : null,
                'newStatus' => $log->new_status,
                'newStatusLabel' => $statusLabels[$log->new_status] ?? $newLabel,
                'actor' => $log->actor?->name ?? 'Sistema',
                'actorId' => $log->changed_by,
                'timestamp' => $log->created_at?->toIso8601String(),
                'timestampLabel' => $log->created_at?->format('Y-m-d H:i'),
            ]);
        }

        foreach ($comments as $comment) {
            $author = $comment->creator?->name
                ?? $comment->senderUser?->name
                ?? ($comment->senderPersona ? trim(($comment->senderPersona->nombres ?? '').' '.($comment->senderPersona->apellidos ?? '')) : null)
                ?? Str::title(str_replace('_', ' ', (string) $comment->sender_type));

            $history->push([
                'id' => 'comment-'.$comment->id,
                'type' => 'comment',
                'message' => $comment->message,
                'meta' => $comment->meta,
                'author' => $author,
                'authorId' => $comment->creator_id ?? $comment->sender_user_id,
                'timestamp' => $comment->created_at?->toIso8601String(),
                'timestampLabel' => $comment->created_at?->format('Y-m-d H:i'),
            ]);
        }

        $base['history'] = $history
            ->sortBy(fn (array $item) => $item['timestamp'] ?? '')
            ->values()
            ->all();

        return $base;
    }

    /**
     * @return array<string, string>
     */
    protected function statusLabels(): array
    {
        return [
            'creado' => 'Creado',
            'en_proceso' => 'En proceso',
            'aceptado' => 'Aceptado',
            'rechazado' => 'Rechazado',
            'finalizado' => 'Finalizado',
        ];
    }

    protected function recordStatusChange(Reclamo $reclamo, ?string $oldStatus, string $newStatus, ?int $actorId = null): void
    {
        if ($oldStatus === $newStatus) {
            return;
        }

        $statusLabels = $this->statusLabels();

        $reclamo->logs()->create([
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'changed_by' => $actorId,
        ]);

        $oldLabel = $oldStatus ? ($statusLabels[$oldStatus] ?? Str::title(str_replace('_', ' ', $oldStatus))) : 'Sin estado';
        $newLabel = $statusLabels[$newStatus] ?? Str::title(str_replace('_', ' ', $newStatus));

        $this->recordComment(
            $reclamo,
            sprintf('Estado cambiado de %s a %s', $oldLabel, $newLabel),
            [
                'old' => $oldStatus,
                'new' => $newStatus,
                'field' => 'status',
            ],
            $actorId
        );
    }

    protected function recordComment(Reclamo $reclamo, string $message, ?array $meta = null, ?int $actorId = null): void
    {
        $reclamo->comments()->create([
            'creator_id' => $actorId,
            'sender_type' => $actorId ? 'user' : 'sistema',
            'sender_user_id' => $actorId,
            'message' => $message,
            'meta' => $meta ?: null,
        ]);
    }

    protected function createAssignmentNotification(Reclamo $reclamo, int $userId): void
    {
        $message = sprintf(
            'Se te asignó como responsable del reclamo %s.',
            $this->formatReclamoCodigo($reclamo)
        );

        $hasMessageColumn = Schema::hasColumn('notifications', 'message');
        $hasDescriptionColumn = Schema::hasColumn('notifications', 'description');
        $hasReclamoIdColumn = Schema::hasColumn('notifications', 'reclamo_id');
        $hasEntityTypeColumn = Schema::hasColumn('notifications', 'entity_type');
        $hasEntityIdColumn = Schema::hasColumn('notifications', 'entity_id');
        $hasTypeColumn = Schema::hasColumn('notifications', 'type');
        $hasMetadataColumn = Schema::hasColumn('notifications', 'metadata');

        $payload = [
            'user_id' => $userId,
        ];

        if ($hasMessageColumn) {
            $payload['message'] = $message;
        } elseif ($hasDescriptionColumn) {
            $payload['description'] = $message;
        }

        if ($hasTypeColumn) {
            $payload['type'] = 'reclamo_responsable_actualizado';
        }

        if ($hasReclamoIdColumn) {
            $payload['reclamo_id'] = $reclamo->id;
        } else {
            if ($hasEntityTypeColumn) {
                $payload['entity_type'] = 'reclamo';
            }
            if ($hasEntityIdColumn) {
                $payload['entity_id'] = $reclamo->id;
            }
        }

        if ($hasMetadataColumn) {
            $payload['metadata'] = [
                'reclamo_id' => $reclamo->id,
                'status' => $reclamo->status,
            ];
        }

        try {
            Notification::create($payload);
        } catch (QueryException $exception) {
            report($exception);

            $fallbackPayload = [
                'user_id' => $userId,
            ];

            if ($hasMessageColumn) {
                $fallbackPayload['message'] = $message;
            } elseif ($hasDescriptionColumn) {
                $fallbackPayload['description'] = $message;
            }

            if ($hasTypeColumn) {
                $fallbackPayload['type'] = 'reclamo_responsable_actualizado';
            }

            if ($hasEntityTypeColumn) {
                $fallbackPayload['entity_type'] = 'reclamo';
            }
            if ($hasEntityIdColumn) {
                $fallbackPayload['entity_id'] = $reclamo->id;
            }

            try {
                Notification::create($fallbackPayload);
            } catch (QueryException $retryException) {
                report($retryException);
            }
        }
    }

    protected function formatReclamoCodigo(Reclamo $reclamo): string
    {
        return sprintf('R-%05d', $reclamo->id);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\SolicitudPersonal;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class SolicitudPersonalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $scope = $request->query('scope', 'visible');

        $query = SolicitudPersonal::query()
            ->with(['solicitante:id,name'])
            ->orderByDesc('created_at');

        if ($scope === 'mine') {
            $query->where('solicitante_id', $user?->id);
        } elseif ($scope === 'assigned') {
            $query->where(function ($builder) use ($user) {
                $builder
                    ->where('destinatario_id', $user?->id)
                    ->orWhereJsonContains('destinatario_ids', $user?->id);
            });
        } else {
            $query->where(function ($builder) use ($user) {
                $builder
                    ->where('solicitante_id', $user?->id)
                    ->orWhere('destinatario_id', $user?->id)
                    ->orWhereJsonContains('destinatario_ids', $user?->id);
            });
        }

        $items = $query->get();
        $destinatarioIds = $items
            ->flatMap(function (SolicitudPersonal $item) {
                $ids = collect($item->destinatario_ids ?? []);
                if ($item->destinatario_id) {
                    $ids->push($item->destinatario_id);
                }
                return $ids->filter();
            })
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
        $destinatarioMap = $destinatarioIds->isNotEmpty()
            ? User::query()->whereIn('id', $destinatarioIds)->pluck('name', 'id')
            : collect();

        $data = $items->map(function (SolicitudPersonal $item) use ($destinatarioMap) {
            $ids = collect($item->destinatario_ids ?? [])
                ->map(fn ($id) => (int) $id)
                ->filter()
                ->values();
            if ($item->destinatario_id && ! $ids->contains($item->destinatario_id)) {
                $ids->push((int) $item->destinatario_id);
            }
            $nombres = $ids
                ->map(fn ($id) => $destinatarioMap[$id] ?? null)
                ->filter()
                ->values();
            return [
                'id' => $item->id,
                'tipo' => $item->tipo,
                'estado' => $item->estado,
                'form' => $item->form ?? [],
                'solicitanteId' => $item->solicitante_id,
                'solicitanteNombre' => $item->solicitante?->name,
                'destinatarioId' => $ids->first(),
                'destinatarioIds' => $ids->values(),
                'destinatarioNombre' => $nombres->first(),
                'destinatarioNombres' => $nombres->values(),
                'createdAt' => $item->created_at?->toIso8601String(),
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tipo' => ['required', 'string', 'in:prestamo,adelanto,vacaciones'],
            'estado' => ['nullable', 'string', 'max:50'],
            'form' => ['nullable', 'array'],
            'destinatarioId' => ['nullable', 'integer', 'exists:users,id'],
            'destinatarioIds' => ['nullable', 'array'],
            'destinatarioIds.*' => ['integer', 'distinct', 'exists:users,id'],
        ]);

        $user = $request->user();
        $destinatarioIds = collect($validated['destinatarioIds'] ?? [])
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->values();
        if ($destinatarioIds->isEmpty() && ! empty($validated['destinatarioId'])) {
            $destinatarioIds->push((int) $validated['destinatarioId']);
        }
        $destinatarioId = $destinatarioIds->first();
        $estado = $validated['estado'] ?? 'Pendiente';

        $item = SolicitudPersonal::create([
            'tipo' => $validated['tipo'],
            'estado' => $estado,
            'form' => $validated['form'] ?? [],
            'solicitante_id' => $user?->id,
            'destinatario_id' => $destinatarioId,
            'destinatario_ids' => $destinatarioIds->values()->all(),
        ]);

        if ($destinatarioIds->isNotEmpty()
            && (Schema::hasColumn('notifications', 'message') || Schema::hasColumn('notifications', 'description'))
        ) {
            $messageText = sprintf('Nueva solicitud personal de %s.', $user?->name ?? 'Usuario');
            foreach ($destinatarioIds as $recipientId) {
                try {
                    $notificationData = [
                        'user_id' => $recipientId,
                    ];
                    if (Schema::hasColumn('notifications', 'message')) {
                        $notificationData['message'] = $messageText;
                    } elseif (Schema::hasColumn('notifications', 'description')) {
                        $notificationData['description'] = $messageText;
                    }
                    if (Schema::hasColumn('notifications', 'entity_type')) {
                        $notificationData['entity_type'] = 'solicitud_personal';
                    }
                    if (Schema::hasColumn('notifications', 'entity_id')) {
                        $notificationData['entity_id'] = $item->id;
                    }
                    if (Schema::hasColumn('notifications', 'type')) {
                        $notificationData['type'] = 'solicitud_personal';
                    }
                    if (Schema::hasColumn('notifications', 'metadata')) {
                        $notificationData['metadata'] = [
                            'solicitud_personal_id' => $item->id,
                            'tipo' => $item->tipo,
                            'solicitante_id' => $user?->id,
                            'solicitante_nombre' => $user?->name,
                        ];
                    }
                    Notification::create($notificationData);
                } catch (\Throwable $e) {
                    // Ignore notification errors to avoid breaking the main request.
                }
            }
        }

        $item->load(['solicitante:id,name']);
        $destinatarioNames = $destinatarioIds->isNotEmpty()
            ? User::query()->whereIn('id', $destinatarioIds)->pluck('name', 'id')
            : collect();
        $destinatarioNombres = $destinatarioIds
            ->map(fn ($id) => $destinatarioNames[$id] ?? null)
            ->filter()
            ->values();

        return response()->json([
            'message' => 'Solicitud personal registrada.',
            'data' => [
                'id' => $item->id,
                'tipo' => $item->tipo,
                'estado' => $item->estado,
                'form' => $item->form ?? [],
                'solicitanteId' => $item->solicitante_id,
                'solicitanteNombre' => $item->solicitante?->name,
                'destinatarioId' => $destinatarioIds->first(),
                'destinatarioIds' => $destinatarioIds->values(),
                'destinatarioNombre' => $destinatarioNombres->first(),
                'destinatarioNombres' => $destinatarioNombres->values(),
                'createdAt' => $item->created_at?->toIso8601String(),
            ],
        ], 201);
    }

    public function update(Request $request, SolicitudPersonal $solicitudPersonal): JsonResponse
    {
        $validated = $request->validate([
            'estado' => ['nullable', 'string', 'max:50'],
            'form' => ['nullable', 'array'],
            'destinatarioIds' => ['nullable', 'array'],
            'destinatarioIds.*' => ['integer', 'distinct', 'exists:users,id'],
        ]);

        $user = $request->user();
        $isSolicitante = $solicitudPersonal->solicitante_id === $user?->id;
        $destinatarioIds = collect($solicitudPersonal->destinatario_ids ?? []);
        if ($solicitudPersonal->destinatario_id) {
            $destinatarioIds->push($solicitudPersonal->destinatario_id);
        }
        $destinatarioIds = $destinatarioIds->filter()->unique();
        $isDestinatario = $destinatarioIds->contains($user?->id);

        if (! $isSolicitante && ! $isDestinatario) {
            return response()->json(['message' => 'No tenés permisos para modificar esta solicitud.'], 403);
        }

        if (array_key_exists('form', $validated) && $isSolicitante) {
            $solicitudPersonal->form = $validated['form'] ?? [];
        }

        if (array_key_exists('destinatarioIds', $validated) && $isSolicitante) {
            $nextDestinatarioIds = collect($validated['destinatarioIds'] ?? [])
                ->filter()
                ->map(fn ($id) => (int) $id)
                ->values();
            $solicitudPersonal->destinatario_ids = $nextDestinatarioIds->all();
            $solicitudPersonal->destinatario_id = $nextDestinatarioIds->first();
        }

        if (array_key_exists('estado', $validated) && $isDestinatario) {
            $solicitudPersonal->estado = $validated['estado'] ?? $solicitudPersonal->estado;
        }

        $solicitudPersonal->save();
        $solicitudPersonal->load(['solicitante:id,name']);
        $destinatarioIds = collect($solicitudPersonal->destinatario_ids ?? []);
        if ($solicitudPersonal->destinatario_id) {
            $destinatarioIds->push($solicitudPersonal->destinatario_id);
        }
        $destinatarioIds = $destinatarioIds->filter()->unique()->values();
        $destinatarioNames = $destinatarioIds->isNotEmpty()
            ? User::query()->whereIn('id', $destinatarioIds)->pluck('name', 'id')
            : collect();
        $destinatarioNombres = $destinatarioIds
            ->map(fn ($id) => $destinatarioNames[$id] ?? null)
            ->filter()
            ->values();

        return response()->json([
            'message' => 'Solicitud personal actualizada.',
            'data' => [
                'id' => $solicitudPersonal->id,
                'tipo' => $solicitudPersonal->tipo,
                'estado' => $solicitudPersonal->estado,
                'form' => $solicitudPersonal->form ?? [],
                'solicitanteId' => $solicitudPersonal->solicitante_id,
                'solicitanteNombre' => $solicitudPersonal->solicitante?->name,
                'destinatarioId' => $destinatarioIds->first(),
                'destinatarioIds' => $destinatarioIds->values(),
                'destinatarioNombre' => $destinatarioNombres->first(),
                'destinatarioNombres' => $destinatarioNombres->values(),
                'createdAt' => $solicitudPersonal->created_at?->toIso8601String(),
            ],
        ]);
    }

    public function destroy(Request $request, SolicitudPersonal $solicitudPersonal): JsonResponse
    {
        $user = $request->user();

        $isSolicitante = $solicitudPersonal->solicitante_id === $user?->id;
        $destinatarioIds = collect($solicitudPersonal->destinatario_ids ?? []);
        if ($solicitudPersonal->destinatario_id) {
            $destinatarioIds->push($solicitudPersonal->destinatario_id);
        }
        $isDestinatario = $destinatarioIds
            ->filter()
            ->unique()
            ->contains($user?->id);

        if (! $isSolicitante && ! $isDestinatario) {
            return response()->json(['message' => 'No tenés permisos para eliminar esta solicitud.'], 403);
        }

        $solicitudPersonal->delete();

        return response()->json([
            'message' => 'Solicitud eliminada correctamente.',
        ]);
    }
}

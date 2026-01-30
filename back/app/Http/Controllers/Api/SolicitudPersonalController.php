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
            ->with(['solicitante:id,name', 'destinatario:id,name'])
            ->orderByDesc('created_at');

        if ($scope === 'mine') {
            $query->where('solicitante_id', $user?->id);
        } elseif ($scope === 'assigned') {
            $query->where('destinatario_id', $user?->id);
        } else {
            $query->where(function ($builder) use ($user) {
                $builder
                    ->where('solicitante_id', $user?->id)
                    ->orWhere('destinatario_id', $user?->id);
            });
        }

        $data = $query->get()->map(function (SolicitudPersonal $item) {
            return [
                'id' => $item->id,
                'tipo' => $item->tipo,
                'estado' => $item->estado,
                'form' => $item->form ?? [],
                'solicitanteId' => $item->solicitante_id,
                'solicitanteNombre' => $item->solicitante?->name,
                'destinatarioId' => $item->destinatario_id,
                'destinatarioNombre' => $item->destinatario?->name,
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
        ]);

        $user = $request->user();
        $destinatarioId = $validated['destinatarioId'] ?? null;
        $estado = $validated['estado'] ?? 'Pendiente';

        $item = SolicitudPersonal::create([
            'tipo' => $validated['tipo'],
            'estado' => $estado,
            'form' => $validated['form'] ?? [],
            'solicitante_id' => $user?->id,
            'destinatario_id' => $destinatarioId,
        ]);

        if ($destinatarioId && (Schema::hasColumn('notifications', 'message') || Schema::hasColumn('notifications', 'description'))) {
            try {
                $notificationData = [
                    'user_id' => $destinatarioId,
                ];
                $messageText = sprintf('Nueva solicitud personal de %s.', $user?->name ?? 'Usuario');
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

        $item->load(['solicitante:id,name', 'destinatario:id,name']);

        return response()->json([
            'message' => 'Solicitud personal registrada.',
            'data' => [
                'id' => $item->id,
                'tipo' => $item->tipo,
                'estado' => $item->estado,
                'form' => $item->form ?? [],
                'solicitanteId' => $item->solicitante_id,
                'solicitanteNombre' => $item->solicitante?->name,
                'destinatarioId' => $item->destinatario_id,
                'destinatarioNombre' => $item->destinatario?->name,
                'createdAt' => $item->created_at?->toIso8601String(),
            ],
        ], 201);
    }

    public function update(Request $request, SolicitudPersonal $solicitudPersonal): JsonResponse
    {
        $validated = $request->validate([
            'estado' => ['nullable', 'string', 'max:50'],
            'form' => ['nullable', 'array'],
        ]);

        $user = $request->user();
        $isSolicitante = $solicitudPersonal->solicitante_id === $user?->id;
        $isDestinatario = $solicitudPersonal->destinatario_id === $user?->id;

        if (! $isSolicitante && ! $isDestinatario) {
            return response()->json(['message' => 'No tenés permisos para modificar esta solicitud.'], 403);
        }

        if (array_key_exists('form', $validated) && $isSolicitante) {
            $solicitudPersonal->form = $validated['form'] ?? [];
        }

        if (array_key_exists('estado', $validated) && $isDestinatario) {
            $solicitudPersonal->estado = $validated['estado'] ?? $solicitudPersonal->estado;
        }

        $solicitudPersonal->save();
        $solicitudPersonal->load(['solicitante:id,name', 'destinatario:id,name']);

        return response()->json([
            'message' => 'Solicitud personal actualizada.',
            'data' => [
                'id' => $solicitudPersonal->id,
                'tipo' => $solicitudPersonal->tipo,
                'estado' => $solicitudPersonal->estado,
                'form' => $solicitudPersonal->form ?? [],
                'solicitanteId' => $solicitudPersonal->solicitante_id,
                'solicitanteNombre' => $solicitudPersonal->solicitante?->name,
                'destinatarioId' => $solicitudPersonal->destinatario_id,
                'destinatarioNombre' => $solicitudPersonal->destinatario?->name,
                'createdAt' => $solicitudPersonal->created_at?->toIso8601String(),
            ],
        ]);
    }
}

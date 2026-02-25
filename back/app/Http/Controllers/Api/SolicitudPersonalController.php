<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\Notification;
use App\Models\Persona;
use App\Models\SolicitudPersonal;
use App\Models\Sucursal;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SolicitudPersonalController extends Controller
{
    private function resolveDestinatarioIds(SolicitudPersonal $item): Collection
    {
        $destinatarioIds = collect($item->destinatario_ids ?? []);
        if ($item->destinatario_id) {
            $destinatarioIds->push($item->destinatario_id);
        }

        return $destinatarioIds
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
    }

    private function ensureCanResolveCambioAsignacion(Request $request, SolicitudPersonal $solicitudPersonal): void
    {
        $user = $request->user();
        $destinatarioIds = $this->resolveDestinatarioIds($solicitudPersonal);
        if ($destinatarioIds->isEmpty()) {
            abort(response()->json([
                'message' => 'La solicitud no tiene agente responsable asignado.',
            ], 422));
        }

        $isDestinatario = $user?->id && $destinatarioIds->contains((int) $user->id);
        if ($isDestinatario) {
            return;
        }

        abort(response()->json([
            'message' => 'Solo el agente responsable puede resolver esta solicitud.',
        ], 403));
    }

    private function applyCambioAsignacion(SolicitudPersonal $solicitudPersonal, Request $request): array
    {
        $form = is_array($solicitudPersonal->form) ? $solicitudPersonal->form : [];
        $personaId = isset($form['personaId']) ? (int) $form['personaId'] : 0;
        if ($personaId <= 0) {
            throw ValidationException::withMessages([
                'form.personaId' => 'La solicitud no tiene un proveedor válido para aplicar el cambio.',
            ]);
        }

        /** @var Persona|null $persona */
        $persona = Persona::query()->find($personaId);
        if (! $persona) {
            throw ValidationException::withMessages([
                'form.personaId' => 'El proveedor asociado a la solicitud no existe.',
            ]);
        }

        $hasNewCliente = array_key_exists('clienteIdNuevo', $form);
        $hasNewSucursal = array_key_exists('sucursalIdNueva', $form);
        $newClienteId = $hasNewCliente && $form['clienteIdNuevo'] !== null && $form['clienteIdNuevo'] !== ''
            ? (int) $form['clienteIdNuevo']
            : null;
        $newSucursalId = $hasNewSucursal && $form['sucursalIdNueva'] !== null && $form['sucursalIdNueva'] !== ''
            ? (int) $form['sucursalIdNueva']
            : null;

        if (! $hasNewCliente && ! $hasNewSucursal) {
            throw ValidationException::withMessages([
                'form' => 'La solicitud no contiene cambios de cliente o sucursal para aplicar.',
            ]);
        }

        if ($newClienteId !== null && ! Cliente::query()->whereKey($newClienteId)->exists()) {
            throw ValidationException::withMessages([
                'form.clienteIdNuevo' => 'El cliente nuevo no existe.',
            ]);
        }

        if ($newSucursalId !== null) {
            $sucursal = Sucursal::query()->find($newSucursalId);
            if (! $sucursal) {
                throw ValidationException::withMessages([
                    'form.sucursalIdNueva' => 'La sucursal nueva no existe.',
                ]);
            }
            if ($newClienteId !== null && (int) $sucursal->cliente_id !== $newClienteId) {
                throw ValidationException::withMessages([
                    'form.sucursalIdNueva' => 'La sucursal nueva no pertenece al cliente seleccionado.',
                ]);
            }
        }

        $oldClienteId = $persona->cliente_id;
        $oldSucursalId = $persona->sucursal_id;
        $oldCliente = $oldClienteId ? Cliente::query()->find($oldClienteId) : null;
        $oldSucursal = $oldSucursalId ? Sucursal::query()->find($oldSucursalId) : null;
        $newCliente = $newClienteId ? Cliente::query()->find($newClienteId) : null;
        $newSucursal = $newSucursalId ? Sucursal::query()->find($newSucursalId) : null;

        $changes = [];

        if ((string) ($oldClienteId ?? '') !== (string) ($newClienteId ?? '')) {
            $changes[] = [
                'field' => 'cliente_id',
                'label' => 'Cliente',
                'oldValue' => $oldCliente?->nombre,
                'newValue' => $newCliente?->nombre,
            ];
            $persona->cliente_id = $newClienteId;
        }

        if ((string) ($oldSucursalId ?? '') !== (string) ($newSucursalId ?? '')) {
            $changes[] = [
                'field' => 'sucursal_id',
                'label' => 'Sucursal',
                'oldValue' => $oldSucursal?->nombre,
                'newValue' => $newSucursal?->nombre,
            ];
            $persona->sucursal_id = $newSucursalId;
        }

        if (empty($changes)) {
            throw ValidationException::withMessages([
                'form' => 'No hay diferencias para aplicar en cliente o sucursal.',
            ]);
        }

        $persona->save();

        $persona->histories()->create([
            'user_id' => $request->user()?->id,
            'description' => 'Cambio de asignación aprobado',
            'changes' => $changes,
        ]);

        $form['estado'] = 'Aprobado';
        $form['resueltoAt'] = now()->toIso8601String();
        $form['resueltoPorId'] = $request->user()?->id;
        $form['resultado'] = [
            'clienteId' => $persona->cliente_id,
            'clienteNombre' => $newCliente?->nombre,
            'sucursalId' => $persona->sucursal_id,
            'sucursalNombre' => $newSucursal?->nombre,
        ];

        $solicitudPersonal->form = $form;

        return [
            'persona' => $persona,
            'clienteId' => $persona->cliente_id,
            'clienteNombre' => $newCliente?->nombre,
            'sucursalId' => $persona->sucursal_id,
            'sucursalNombre' => $newSucursal?->nombre,
        ];
    }

    private function normalizeResolutionEstado(?string $estado): string
    {
        $normalized = Str::lower(trim((string) $estado));

        if ($normalized === 'aprobado') {
            return 'Aprobado';
        }
        if ($normalized === 'rechazado') {
            return 'Rechazado';
        }

        return 'Pendiente';
    }

    private function normalizePrestamoForm(array $form): array
    {
        if (! array_key_exists('cantidadCuotas', $form)) {
            return $form;
        }

        $rawCuotas = $form['cantidadCuotas'];
        if (is_string($rawCuotas)) {
            $rawCuotas = trim($rawCuotas);
        }

        if ($rawCuotas === '' || $rawCuotas === null || ! is_numeric($rawCuotas)) {
            throw ValidationException::withMessages([
                'form.cantidadCuotas' => 'Ingresá una cantidad de cuotas válida.',
            ]);
        }

        $cuotas = (int) $rawCuotas;
        if ($cuotas < 1 || $cuotas > 12) {
            throw ValidationException::withMessages([
                'form.cantidadCuotas' => 'La cantidad de cuotas debe estar entre 1 y 12.',
            ]);
        }

        $form['cantidadCuotas'] = (string) $cuotas;

        if (array_key_exists('cuotasPagadas', $form)) {
            $rawPagadas = $form['cuotasPagadas'];
            if (is_string($rawPagadas)) {
                $rawPagadas = trim($rawPagadas);
            }

            $cuotasPagadas = is_numeric($rawPagadas) ? (int) $rawPagadas : 0;
            $cuotasPagadas = max(0, min($cuotasPagadas, $cuotas));
            $form['cuotasPagadas'] = (string) $cuotasPagadas;
        }

        return $form;
    }

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
            'tipo' => ['required', 'string', 'in:prestamo,adelanto,vacaciones,cambio_asignacion'],
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
        $tipo = $validated['tipo'] ?? null;

        if ($tipo === 'cambio_asignacion' && $destinatarioIds->isEmpty()) {
            throw ValidationException::withMessages([
                'destinatarioIds' => 'Debes asignar un agente responsable para esta solicitud.',
            ]);
        }

        $form = $validated['form'] ?? [];
        if ($tipo === 'prestamo') {
            $form = $this->normalizePrestamoForm($form);
        }

        $item = SolicitudPersonal::create([
            'tipo' => $tipo,
            'estado' => $estado,
            'form' => $form,
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

    public function approve(Request $request, SolicitudPersonal $solicitudPersonal): JsonResponse
    {
        if ($solicitudPersonal->tipo !== 'cambio_asignacion') {
            return response()->json([
                'message' => 'Solo se puede aprobar con este endpoint una solicitud de cambio de asignación.',
            ], 422);
        }

        $this->ensureCanResolveCambioAsignacion($request, $solicitudPersonal);

        if ($this->normalizeResolutionEstado($solicitudPersonal->estado) === 'Aprobado') {
            return response()->json([
                'message' => 'La solicitud ya estaba aprobada.',
                'data' => [
                    'id' => $solicitudPersonal->id,
                    'estado' => $solicitudPersonal->estado,
                ],
            ]);
        }

        $resolutionData = DB::transaction(function () use ($solicitudPersonal, $request) {
            $resolutionData = $this->applyCambioAsignacion($solicitudPersonal, $request);
            $solicitudPersonal->estado = 'Aprobado';
            $solicitudPersonal->save();
            return $resolutionData;
        });

        return response()->json([
            'message' => 'Cambio de asignación aprobado correctamente.',
            'data' => [
                'id' => $solicitudPersonal->id,
                'tipo' => $solicitudPersonal->tipo,
                'estado' => $solicitudPersonal->estado,
                'personaId' => $resolutionData['persona']->id,
                'clienteId' => $resolutionData['clienteId'],
                'clienteNombre' => $resolutionData['clienteNombre'],
                'sucursalId' => $resolutionData['sucursalId'],
                'sucursalNombre' => $resolutionData['sucursalNombre'],
                'resueltoPorId' => $request->user()?->id,
                'resueltoAt' => now()->toIso8601String(),
            ],
        ]);
    }

    public function reject(Request $request, SolicitudPersonal $solicitudPersonal): JsonResponse
    {
        if ($solicitudPersonal->tipo !== 'cambio_asignacion') {
            return response()->json([
                'message' => 'Solo se puede rechazar con este endpoint una solicitud de cambio de asignación.',
            ], 422);
        }

        $this->ensureCanResolveCambioAsignacion($request, $solicitudPersonal);

        $validated = $request->validate([
            'motivo' => ['nullable', 'string', 'max:1000'],
        ]);

        $form = is_array($solicitudPersonal->form) ? $solicitudPersonal->form : [];
        $form['estado'] = 'Rechazado';
        $form['resueltoAt'] = now()->toIso8601String();
        $form['resueltoPorId'] = $request->user()?->id;
        $form['motivoRechazo'] = $validated['motivo'] ?? null;

        $solicitudPersonal->form = $form;
        $solicitudPersonal->estado = 'Rechazado';
        $solicitudPersonal->save();

        return response()->json([
            'message' => 'Cambio de asignación rechazado.',
            'data' => [
                'id' => $solicitudPersonal->id,
                'tipo' => $solicitudPersonal->tipo,
                'estado' => $solicitudPersonal->estado,
                'resueltoPorId' => $request->user()?->id,
                'resueltoAt' => now()->toIso8601String(),
            ],
        ]);
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

        if (! $isDestinatario) {
            return response()->json(['message' => 'Solo los destinatarios pueden editar esta solicitud.'], 403);
        }

        if (array_key_exists('form', $validated)) {
            $form = $validated['form'] ?? [];
            if ($solicitudPersonal->tipo === 'prestamo') {
                $form = $this->normalizePrestamoForm($form);
            }
            $solicitudPersonal->form = $form;
        }

        if (array_key_exists('estado', $validated)) {
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

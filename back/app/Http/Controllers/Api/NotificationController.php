<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Reclamo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'userId' => ['required', 'integer', 'exists:users,id'],
            'onlyUnread' => ['nullable', 'boolean'],
        ]);

        $query = Notification::query()
            ->where('user_id', $validated['userId'])
            ->orderByDesc('created_at');

        if ($request->boolean('onlyUnread')) {
            $query->whereNull('read_at');
        }

        $hasMessageColumn = Schema::hasColumn('notifications', 'message');
        $hasDescriptionColumn = Schema::hasColumn('notifications', 'description');
        $hasReclamoIdColumn = Schema::hasColumn('notifications', 'reclamo_id');
        $hasEntityColumns = Schema::hasColumn('notifications', 'entity_id') && Schema::hasColumn('notifications', 'entity_type');

        $notifications = $query->get();

        $reclamoIds = $notifications
            ->map(function (Notification $notification) use ($hasReclamoIdColumn, $hasEntityColumns) {
                if ($hasReclamoIdColumn && $notification->reclamo_id) {
                    return (int) $notification->reclamo_id;
                }

                if (
                    $hasEntityColumns &&
                    $notification->entity_type === 'reclamo' &&
                    $notification->entity_id
                ) {
                    return (int) $notification->entity_id;
                }

                return null;
            })
            ->filter()
            ->unique()
            ->values();

        $reclamos = $reclamoIds->isEmpty()
            ? collect()
            : Reclamo::query()
                ->select('id', 'status')
                ->whereIn('id', $reclamoIds)
                ->get()
                ->keyBy('id');

        $notifications = $notifications
            ->map(function (Notification $notification) use (
                $hasMessageColumn,
                $hasDescriptionColumn,
                $hasReclamoIdColumn,
                $hasEntityColumns,
                $reclamos
            ) {
                $message = null;
                if ($hasMessageColumn) {
                    $message = $notification->message;
                }
                if ($message === null && $hasDescriptionColumn) {
                    $message = $notification->description;
                }

                $reclamoId = null;
                if ($hasReclamoIdColumn && $notification->reclamo_id) {
                    $reclamoId = (int) $notification->reclamo_id;
                } elseif (
                    $hasEntityColumns &&
                    $notification->entity_type === 'reclamo' &&
                    $notification->entity_id
                ) {
                    $reclamoId = (int) $notification->entity_id;
                }

                $reclamoCodigo = null;
                $reclamoEstado = null;

                if ($reclamoId && $reclamos->has($reclamoId)) {
                    $reclamo = $reclamos->get($reclamoId);
                    $reclamoCodigo = sprintf('R-%05d', $reclamo->id);
                    $reclamoEstado = $reclamo->status;
                }

                return [
                    'id' => $notification->id,
                    'message' => $message,
                    'reclamoId' => $reclamoId,
                    'reclamoCodigo' => $reclamoCodigo,
                    'reclamoEstado' => $reclamoEstado,
                    'readAt' => $notification->read_at?->toIso8601String(),
                    'createdAt' => $notification->created_at?->toIso8601String(),
                    'createdAtLabel' => $notification->created_at?->timezone(config('app.timezone', 'UTC'))?->format('d/m/Y H:i'),
                ];
            })
            ->values();

        return response()->json(['data' => $notifications]);
    }

    public function markAsRead(Notification $notification): JsonResponse
    {
        if (! $notification->read_at) {
            $notification->read_at = Carbon::now();
            $notification->save();
        }

        return response()->json([
            'message' => 'Notificación marcada como leída.',
        ]);
    }
}

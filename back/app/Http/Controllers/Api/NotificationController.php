<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

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

        $notifications = $query
            ->get()
            ->map(fn (Notification $notification) => [
                'id' => $notification->id,
                'message' => $notification->message,
                'readAt' => $notification->read_at?->toIso8601String(),
                'createdAt' => $notification->created_at?->toIso8601String(),
            ])
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

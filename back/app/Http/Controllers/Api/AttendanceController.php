<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class AttendanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
            'userId' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $limit = $validated['limit'] ?? 200;

        $query = AttendanceRecord::query()
            ->with('user:id,name')
            ->orderByDesc('recorded_at');

        if (! empty($validated['userId'])) {
            $query->where('user_id', $validated['userId']);
        }

        $records = $query->limit($limit)->get();

        $data = $records->map(function (AttendanceRecord $record) {
            $recordedAt = $record->recorded_at;

            return [
                'id' => $record->id,
                'status' => $record->status,
                'userId' => $record->user_id,
                'userName' => $record->user_name ?? $record->user?->name,
                'recordedAt' => $recordedAt?->toIso8601String(),
                'recordedAtLabel' => $recordedAt?->timezone(config('app.timezone', 'UTC'))?->format('d/m/Y H:i:s'),
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(['entrada', 'salida'])],
            'timestamp' => ['nullable', 'date'],
            'userId' => ['nullable', 'integer', 'exists:users,id'],
            'userName' => ['nullable', 'string', 'max:255'],
        ]);

        $userId = $validated['userId'] ?? $request->user()?->id;
        $userName = $validated['userName'] ?? $request->user()?->name;

        if (! $userName && $userId) {
            $userName = User::query()->find($userId)?->name;
        }

        $record = AttendanceRecord::query()->create([
            'user_id' => $userId,
            'user_name' => $userName,
            'status' => $validated['status'],
            'recorded_at' => isset($validated['timestamp'])
                ? Carbon::parse($validated['timestamp'])
                : Carbon::now(),
        ]);

        return response()->json([
            'message' => 'Registro de asistencia guardado correctamente.',
            'data' => [
                'id' => $record->id,
                'status' => $record->status,
                'userId' => $record->user_id,
                'userName' => $record->user_name ?? $record->user?->name,
                'recordedAt' => $record->recorded_at?->toIso8601String(),
                'recordedAtLabel' => $record->recorded_at?->timezone(config('app.timezone', 'UTC'))?->format('d/m/Y H:i:s'),
            ],
        ], 201);
    }
}

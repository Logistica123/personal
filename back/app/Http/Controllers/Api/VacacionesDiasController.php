<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VacacionesDias;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VacacionesDiasController extends Controller
{
    public function index(): JsonResponse
    {
        $items = VacacionesDias::query()
            ->select('user_id', 'dias')
            ->get()
            ->map(fn ($item) => [
                'userId' => $item->user_id,
                'dias' => (int) $item->dias,
            ])
            ->values();

        return response()->json(['data' => $items]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'userId' => ['required', 'integer', 'exists:users,id'],
            'dias' => ['required', 'integer', 'min:0'],
        ]);

        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (! in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['message' => 'No tenés permisos para actualizar días hábiles.'], 403);
        }

        $record = VacacionesDias::query()->updateOrCreate(
            ['user_id' => $validated['userId']],
            ['dias' => $validated['dias']]
        );

        return response()->json([
            'message' => 'Días hábiles actualizados.',
            'data' => [
                'userId' => $record->user_id,
                'dias' => (int) $record->dias,
            ],
        ]);
    }
}

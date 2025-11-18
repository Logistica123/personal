<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GeneralInfoEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GeneralInfoController extends Controller
{
    public function index(): JsonResponse
    {
        $entries = GeneralInfoEntry::query()
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $entries,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'authorId' => ['nullable', 'integer'],
            'authorName' => ['nullable', 'string', 'max:255'],
            'authorRole' => ['nullable', 'string', 'max:255'],
            'imageData' => ['nullable', 'string'],
            'imageAlt' => ['nullable', 'string', 'max:255'],
        ]);

        $entry = GeneralInfoEntry::create([
            'title' => $payload['title'],
            'body' => $payload['body'],
            'author_id' => $payload['authorId'] ?? null,
            'author_name' => $payload['authorName'] ?? null,
            'author_role' => $payload['authorRole'] ?? null,
            'image_data' => $payload['imageData'] ?? null,
            'image_alt' => $payload['imageAlt'] ?? null,
        ]);

        return response()->json([
            'data' => $entry,
        ], 201);
    }

    public function destroy(string $id): JsonResponse
    {
        $entry = GeneralInfoEntry::query()->findOrFail($id);
        $entry->delete();

        return response()->json(null, 204);
    }
}

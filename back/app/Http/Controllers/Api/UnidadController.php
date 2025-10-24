<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Unidad;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UnidadController extends Controller
{
    public function index(): JsonResponse
    {
        $unidades = Unidad::query()
            ->orderBy('id')
            ->get()
            ->map(fn (Unidad $unidad) => [
                'id' => $unidad->id,
                'matricula' => $unidad->matricula,
                'marca' => $unidad->marca,
                'modelo' => $unidad->modelo,
                'anio' => $unidad->anio,
                'observacion' => $unidad->observacion,
            ])
            ->values();

        return response()->json(['data' => $unidades]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'matricula' => ['nullable', 'string'],
            'marca' => ['nullable', 'string'],
            'modelo' => ['nullable', 'string'],
            'anio' => ['nullable', 'string'],
            'observacion' => ['nullable', 'string'],
        ]);

        $unidad = Unidad::create([
            'matricula' => $this->sanitizeString($validated['matricula'] ?? null),
            'marca' => $this->sanitizeString($validated['marca'] ?? null),
            'modelo' => $this->sanitizeString($validated['modelo'] ?? null),
            'anio' => $this->sanitizeString($validated['anio'] ?? null),
            'observacion' => $this->sanitizeString($validated['observacion'] ?? null),
        ]);

        return response()->json([
            'message' => 'Unidad creada correctamente.',
            'data' => $this->formatUnidad($unidad),
        ], 201);
    }

    public function show(Unidad $unidad): JsonResponse
    {
        return response()->json([
            'data' => [
                'id' => $unidad->id,
                'matricula' => $unidad->matricula,
                'marca' => $unidad->marca,
                'modelo' => $unidad->modelo,
                'anio' => $unidad->anio,
                'observacion' => $unidad->observacion,
            ],
        ]);
    }

    public function update(Request $request, Unidad $unidad): JsonResponse
    {
        $validated = $request->validate([
            'matricula' => ['nullable', 'string'],
            'marca' => ['nullable', 'string'],
            'modelo' => ['nullable', 'string'],
            'anio' => ['nullable', 'string'],
            'observacion' => ['nullable', 'string'],
        ]);

        $unidad->fill([
            'matricula' => $this->sanitizeString($validated['matricula'] ?? null),
            'marca' => $this->sanitizeString($validated['marca'] ?? null),
            'modelo' => $this->sanitizeString($validated['modelo'] ?? null),
            'anio' => $this->sanitizeString($validated['anio'] ?? null),
            'observacion' => $this->sanitizeString($validated['observacion'] ?? null),
        ]);

        $unidad->save();

        return response()->json([
            'message' => 'Unidad actualizada correctamente.',
            'data' => $this->formatUnidad($unidad),
        ]);
    }

    public function destroy(Unidad $unidad): JsonResponse
    {
        $unidad->delete();

        return response()->json([
            'message' => 'Unidad eliminada correctamente.',
        ]);
    }

    private function sanitizeString(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function formatUnidad(Unidad $unidad): array
    {
        return [
            'id' => $unidad->id,
            'matricula' => $unidad->matricula,
            'marca' => $unidad->marca,
            'modelo' => $unidad->modelo,
            'anio' => $unidad->anio,
            'observacion' => $unidad->observacion,
        ];
    }
}

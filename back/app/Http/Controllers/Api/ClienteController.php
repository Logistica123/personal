<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ClienteController extends Controller
{
    public function index(): JsonResponse
    {
        $clientes = Cliente::query()
            ->with(['sucursales' => fn ($query) => $query->orderBy('nombre')])
            ->orderBy('id')
            ->get()
            ->map(fn (Cliente $cliente) => $this->formatCliente($cliente))
            ->values();

        return $this->jsonResponse(['data' => $clientes]);
    }

    public function show(Cliente $cliente): JsonResponse
    {
        $cliente->load(['sucursales' => fn ($query) => $query->orderBy('nombre')]);

        return $this->jsonResponse(['data' => $this->formatCliente($cliente)]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'codigo' => ['nullable', 'string'],
            'nombre' => ['nullable', 'string'],
            'direccion' => ['nullable', 'string'],
            'documento_fiscal' => ['nullable', 'string'],
            'sucursales' => ['sometimes', 'array'],
            'sucursales.*.nombre' => ['nullable', 'string'],
            'sucursales.*.direccion' => ['nullable', 'string'],
            'sucursales.*.encargado_deposito' => ['nullable', 'string'],
        ]);

        $cliente = DB::transaction(function () use ($validated) {
            $cliente = Cliente::create([
                'codigo' => $this->sanitizeString($validated['codigo'] ?? null),
                'nombre' => $this->sanitizeString($validated['nombre'] ?? null),
                'direccion' => $this->sanitizeString($validated['direccion'] ?? null),
                'documento_fiscal' => $this->sanitizeString($validated['documento_fiscal'] ?? null),
            ]);

            foreach ($validated['sucursales'] ?? [] as $sucursalData) {
                $nombre = $this->sanitizeString($sucursalData['nombre'] ?? null);
                $direccion = $this->sanitizeString($sucursalData['direccion'] ?? null);
                $encargado = $this->sanitizeString($sucursalData['encargado_deposito'] ?? null);

                if ($nombre === null && $direccion === null && $encargado === null) {
                    continue;
                }

                $cliente->sucursales()->create([
                    'nombre' => $nombre,
                    'direccion' => $direccion,
                    'encargado_deposito' => $encargado,
                ]);
            }

            return $cliente->fresh(['sucursales' => fn ($query) => $query->orderBy('nombre')]);
        });

        return $this->jsonResponse([
            'message' => 'Cliente creado correctamente.',
            'data' => $this->formatCliente($cliente),
        ], 201);
    }

    public function update(Request $request, Cliente $cliente): JsonResponse
    {
        $validated = $request->validate([
            'codigo' => ['nullable', 'string'],
            'nombre' => ['nullable', 'string'],
            'direccion' => ['nullable', 'string'],
            'documento_fiscal' => ['nullable', 'string'],
            'sucursales' => ['sometimes', 'array'],
            'sucursales.*.id' => [
                'nullable',
                'integer',
                Rule::exists('sucursals', 'id')->where('cliente_id', $cliente->id),
            ],
            'sucursales.*.nombre' => ['nullable', 'string'],
            'sucursales.*.direccion' => ['nullable', 'string'],
            'sucursales.*.encargado_deposito' => ['nullable', 'string'],
        ]);

        $cliente = DB::transaction(function () use ($cliente, $validated) {
            $cliente->fill([
                'codigo' => $this->sanitizeString($validated['codigo'] ?? null),
                'nombre' => $this->sanitizeString($validated['nombre'] ?? null),
                'direccion' => $this->sanitizeString($validated['direccion'] ?? null),
                'documento_fiscal' => $this->sanitizeString($validated['documento_fiscal'] ?? null),
            ]);

            $cliente->save();

            $existing = $cliente->sucursales()->get()->keyBy('id');
            $idsToKeep = [];

            foreach ($validated['sucursales'] ?? [] as $sucursalData) {
                $id = $sucursalData['id'] ?? null;
                $nombre = $this->sanitizeString($sucursalData['nombre'] ?? null);
                $direccion = $this->sanitizeString($sucursalData['direccion'] ?? null);
                $encargado = $this->sanitizeString($sucursalData['encargado_deposito'] ?? null);

                if ($id !== null && $existing->has($id)) {
                    $sucursal = $existing->get($id);
                    $sucursal->fill([
                        'nombre' => $nombre,
                        'direccion' => $direccion,
                        'encargado_deposito' => $encargado,
                    ]);
                    $sucursal->save();

                    $idsToKeep[] = $sucursal->id;
                    continue;
                }

                if ($nombre === null && $direccion === null && $encargado === null) {
                    continue;
                }

                $newSucursal = $cliente->sucursales()->create([
                    'nombre' => $nombre,
                    'direccion' => $direccion,
                    'encargado_deposito' => $encargado,
                ]);

                $idsToKeep[] = $newSucursal->id;
            }

            $idsToKeep = array_filter($idsToKeep);

            if (!empty($idsToKeep)) {
                $cliente->sucursales()
                    ->whereNotIn('id', $idsToKeep)
                    ->get()
                    ->each
                    ->delete();
            } else {
                $cliente->sucursales()->get()->each->delete();
            }

            return $cliente->fresh(['sucursales' => fn ($query) => $query->orderBy('nombre')]);
        });

        return $this->jsonResponse([
            'message' => 'Cliente actualizado correctamente.',
            'data' => $this->formatCliente($cliente),
        ]);
    }

    public function destroy(Cliente $cliente): JsonResponse
    {
        $cliente->delete();

        return $this->jsonResponse([
            'message' => 'Cliente eliminado correctamente.',
        ]);
    }

    private function jsonResponse(array $payload, int $status = 200): JsonResponse
    {
        return response()->json($payload, $status);
    }

    private function formatCliente(Cliente $cliente): array
    {
        $cliente->setRelation(
            'sucursales',
            $cliente->sucursales->sortBy('nombre')->values()
        );

        return [
            'id' => $cliente->id,
            'codigo' => $cliente->codigo,
            'nombre' => $cliente->nombre,
            'direccion' => $cliente->direccion,
            'documento_fiscal' => $cliente->documento_fiscal,
            'sucursales' => $cliente->sucursales->map(fn ($sucursal) => [
                'id' => $sucursal->id,
                'nombre' => $sucursal->nombre,
                'direccion' => $sucursal->direccion,
                'encargado_deposito' => $sucursal->encargado_deposito,
            ])->values(),
        ];
    }

    private function sanitizeString(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }
}

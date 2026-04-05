<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClienteRequerimiento;
use App\Models\Sucursal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ClienteRequerimientoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cliente_id' => ['nullable', 'integer', 'exists:clientes,id'],
            'sucursal_id' => ['nullable', 'integer', 'exists:sucursals,id'],
            'include_sources' => ['nullable', 'boolean'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);

        $query = ClienteRequerimiento::query()
            ->with(['cliente:id,nombre', 'sucursal:id,cliente_id,nombre', 'unidad:id,matricula,marca,modelo'])
            ->orderByDesc('created_at');

        $includeSources = array_key_exists('include_sources', $validated) ? (bool) $validated['include_sources'] : false;
        if (! $includeSources) {
            $query->whereNull('source_type');
        }

        if (! empty($validated['cliente_id'])) {
            $query->where('cliente_id', (int) $validated['cliente_id']);
        }

        if (! empty($validated['sucursal_id'])) {
            $query->where('sucursal_id', (int) $validated['sucursal_id']);
        }

        $limit = (int) ($validated['limit'] ?? 500);
        $items = $query->limit($limit)->get();

        return response()->json([
            'data' => $items->map(fn (ClienteRequerimiento $item) => $this->serialize($item))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatePayload($request);

        $item = ClienteRequerimiento::query()->create($validated);
        $item->load(['cliente:id,nombre', 'sucursal:id,cliente_id,nombre', 'unidad:id,matricula,marca,modelo']);

        return response()->json([
            'message' => 'Requerimiento creado.',
            'data' => $this->serialize($item),
        ], 201);
    }

    public function update(Request $request, ClienteRequerimiento $requerimiento): JsonResponse
    {
        $validated = $this->validatePayload($request);

        $requerimiento->fill($validated);
        $requerimiento->save();
        $requerimiento->load(['cliente:id,nombre', 'sucursal:id,cliente_id,nombre', 'unidad:id,matricula,marca,modelo']);

        return response()->json([
            'message' => 'Requerimiento actualizado.',
            'data' => $this->serialize($requerimiento),
        ]);
    }

    public function destroy(Request $request, ClienteRequerimiento $requerimiento): JsonResponse
    {
        $requerimiento->delete();

        return response()->json(['message' => 'Requerimiento eliminado.']);
    }

    private function validatePayload(Request $request): array
    {
        $validated = $request->validate([
            'cliente_id' => ['required', 'integer', 'exists:clientes,id'],
            'sucursal_id' => ['nullable', 'integer', 'exists:sucursals,id'],
            'unidad_id' => ['nullable', 'integer', 'exists:unidades,id'],
            'requerimiento' => ['required', 'string', 'max:255'],
        ]);

        if (array_key_exists('sucursal_id', $validated) && $validated['sucursal_id'] !== null) {
            $sucursal = Sucursal::query()->select(['id', 'cliente_id'])->find($validated['sucursal_id']);
            if ($sucursal && (int) $sucursal->cliente_id !== (int) $validated['cliente_id']) {
                throw ValidationException::withMessages([
                    'sucursal_id' => ['La sucursal seleccionada no pertenece al cliente.'],
                ]);
            }
        }

        return $validated;
    }

    private function serialize(ClienteRequerimiento $item): array
    {
        $unidadLabel = null;
        if ($item->unidad) {
            $matricula = trim((string) ($item->unidad->matricula ?? ''));
            $detalle = trim(implode(' · ', array_filter([trim((string) ($item->unidad->marca ?? '')), trim((string) ($item->unidad->modelo ?? ''))])));
            $unidadLabel = $matricula !== '' ? $matricula : null;
            if ($detalle !== '') {
                $unidadLabel = $unidadLabel ? "{$unidadLabel} ({$detalle})" : $detalle;
            }
        }

        return [
            'id' => $item->id,
            'cliente_id' => $item->cliente_id,
            'cliente_nombre' => $item->cliente?->nombre,
            'sucursal_id' => $item->sucursal_id,
            'sucursal_nombre' => $item->sucursal?->nombre,
            'unidad_id' => $item->unidad_id,
            'unidad_label' => $unidadLabel,
            'requerimiento' => $item->requerimiento,
            'created_at' => optional($item->created_at)?->toISOString(),
            'updated_at' => optional($item->updated_at)?->toISOString(),
        ];
    }
}

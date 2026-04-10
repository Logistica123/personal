<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqJurisdiccionSucursal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LiqJurisdiccionController extends Controller
{
    /**
     * GET /api/liq/jurisdicciones
     * Catalogo fijo de jurisdicciones IIBB (901-924).
     */
    public function index(): JsonResponse
    {
        $list = collect(LiqJurisdiccionSucursal::JURISDICCIONES)
            ->map(fn (string $nombre, int $id) => ['id' => $id, 'nombre' => $nombre])
            ->values();

        return response()->json(['data' => $list]);
    }

    /**
     * GET /api/liq/jurisdicciones/sucursal?cliente_id=X
     * Lista mapeos sucursal->jurisdiccion de un cliente.
     */
    public function sucursales(Request $request): JsonResponse
    {
        $query = LiqJurisdiccionSucursal::query()->orderBy('sucursal');

        if ($request->filled('cliente_id')) {
            $query->where('cliente_id', $request->integer('cliente_id'));
        }

        return response()->json(['data' => $query->get()]);
    }

    /**
     * POST /api/liq/jurisdicciones/sucursal
     * Crear o actualizar mapeo sucursal->jurisdiccion.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cliente_id'          => ['required', 'integer', 'exists:liq_clientes,id'],
            'sucursal'            => ['required', 'string', 'max:100'],
            'jurisdiccion_id'     => ['required', 'integer', 'between:901,924'],
        ]);

        $jurisdiccionNombre = LiqJurisdiccionSucursal::nombreJurisdiccion($validated['jurisdiccion_id']);

        if (! $jurisdiccionNombre) {
            return response()->json(['message' => 'Jurisdiccion invalida.'], 422);
        }

        $record = LiqJurisdiccionSucursal::updateOrCreate(
            [
                'cliente_id' => $validated['cliente_id'],
                'sucursal'   => $validated['sucursal'],
            ],
            [
                'jurisdiccion_id'     => $validated['jurisdiccion_id'],
                'jurisdiccion_nombre' => $jurisdiccionNombre,
            ]
        );

        return response()->json([
            'message' => 'Jurisdiccion asignada correctamente.',
            'data'    => $record,
        ], $record->wasRecentlyCreated ? 201 : 200);
    }
}

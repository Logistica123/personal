<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqCliente;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * SPEC INTEGRAL Fase B — ABM de motivos exitosos por cliente.
 *
 * Los motivos exitosos son los códigos del YCC (Z4, Z1, 2, 4...) que cuentan como "entrega exitosa"
 * en el cálculo de eficiencia. Matías necesita poder ajustarlos sin tocar SQL.
 *
 * Rutas:
 *   GET    /liq/clientes/{cliente}/motivos-exitosos
 *   POST   /liq/clientes/{cliente}/motivos-exitosos        body: {codigo, es_exitoso, descripcion?}
 *   PATCH  /liq/motivos-exitosos/{id}                       body: {es_exitoso, descripcion}
 *   DELETE /liq/motivos-exitosos/{id}
 */
class LiqMotivosExitososController extends Controller
{
    public function index(LiqCliente $cliente): JsonResponse
    {
        $rows = DB::table('liq_motivos_exitosos')
            ->where('cliente_id', $cliente->id)
            ->orderByDesc('es_exitoso')
            ->orderBy('codigo')
            ->get(['id', 'codigo', 'es_exitoso', 'descripcion', 'updated_at']);

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request, LiqCliente $cliente): JsonResponse
    {
        $data = $request->validate([
            'codigo'      => 'required|string|max:20',
            'es_exitoso'  => 'required|boolean',
            'descripcion' => 'nullable|string|max:200',
        ]);

        $existing = DB::table('liq_motivos_exitosos')
            ->where('cliente_id', $cliente->id)
            ->where('codigo', $data['codigo'])
            ->first();

        if ($existing) {
            return response()->json([
                'error' => 'duplicado',
                'message' => "Ya existe el motivo '{$data['codigo']}' para este cliente",
                'id' => $existing->id,
            ], 409);
        }

        $id = DB::table('liq_motivos_exitosos')->insertGetId([
            'cliente_id' => $cliente->id,
            'codigo' => $data['codigo'],
            'es_exitoso' => (bool) $data['es_exitoso'],
            'descripcion' => $data['descripcion'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Motivo creado',
            'data' => DB::table('liq_motivos_exitosos')->where('id', $id)->first(),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $row = DB::table('liq_motivos_exitosos')->where('id', $id)->first();
        if (!$row) return response()->json(['error' => 'no_existe'], 404);

        $data = $request->validate([
            'es_exitoso'  => 'sometimes|boolean',
            'descripcion' => 'sometimes|nullable|string|max:200',
        ]);

        DB::table('liq_motivos_exitosos')->where('id', $id)->update(array_merge(
            $data,
            ['updated_at' => now()]
        ));

        return response()->json([
            'message' => 'Actualizado',
            'data' => DB::table('liq_motivos_exitosos')->where('id', $id)->first(),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $deleted = DB::table('liq_motivos_exitosos')->where('id', $id)->delete();
        if (!$deleted) return response()->json(['error' => 'no_existe'], 404);
        return response()->json(['message' => 'Eliminado']);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PolizaAsegurado;
use App\Models\PolizaAseguradoComentario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ADDENDUM 10 Parte B — comentarios por asegurado (CRUD + listado).
 *
 * Solo el autor del comentario o un usuario con rol elevado puede borrarlo.
 * Editar comentarios no está soportado a propósito (los comentarios son
 * registro histórico — para corregir, agregás uno nuevo).
 */
class PolizaAseguradoComentarioController extends Controller
{
    public function index(PolizaAsegurado $asegurado): JsonResponse
    {
        $rows = PolizaAseguradoComentario::query()
            ->where('asegurado_id', $asegurado->id)
            ->with('user:id,name,email')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($c) => [
                'id'          => $c->id,
                'comentario'  => $c->comentario,
                'created_at'  => $c->created_at?->toIso8601String(),
                'user' => [
                    'id'    => $c->user?->id,
                    'name'  => $c->user?->name,
                    'email' => $c->user?->email,
                ],
            ]);

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request, PolizaAsegurado $asegurado): JsonResponse
    {
        $data = $request->validate([
            'comentario' => ['required', 'string', 'max:5000'],
        ]);
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        $row = PolizaAseguradoComentario::create([
            'asegurado_id' => $asegurado->id,
            'user_id'      => $user->id,
            'comentario'   => trim($data['comentario']),
            'created_at'   => now(),
        ]);

        $row->load('user:id,name,email');

        return response()->json(['data' => [
            'id'         => $row->id,
            'comentario' => $row->comentario,
            'created_at' => $row->created_at?->toIso8601String(),
            'user' => [
                'id'    => $row->user?->id,
                'name'  => $row->user?->name,
                'email' => $row->user?->email,
            ],
        ]], 201);
    }

    public function destroy(Request $request, PolizaAseguradoComentario $comentario): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        // Solo el autor o un super-admin (rol 'admin') puede borrar.
        $isAdmin = ($user->role ?? null) === 'admin';
        if ($comentario->user_id !== $user->id && !$isAdmin) {
            return response()->json(['message' => 'Sólo el autor o un admin pueden eliminar este comentario.'], 403);
        }

        $comentario->delete();
        return response()->json(['data' => ['deleted' => true]]);
    }
}

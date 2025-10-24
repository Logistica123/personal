<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::query()
            ->orderBy('id')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'created_at' => optional($user->created_at)->format('Y-m-d'),
                'status' => $user->status ?? 'activo',
            ])
            ->values();

        return response()->json(['data' => $users]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);

        return response()->json([
            'message' => 'Usuario creado correctamente.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'created_at' => optional($user->created_at)->format('Y-m-d'),
                'status' => $user->status ?? 'activo',
            ],
        ], 201);
    }

    public function show(User $usuario): JsonResponse
    {
        return response()->json([
            'data' => [
                'id' => $usuario->id,
                'name' => $usuario->name,
                'email' => $usuario->email,
                'created_at' => optional($usuario->created_at)->format('Y-m-d'),
                'status' => $usuario->status ?? 'activo',
            ],
        ]);
    }

    public function update(Request $request, User $usuario): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $usuario->password = Hash::make($validated['password']);
        $usuario->save();

        return response()->json([
            'message' => 'Contraseña actualizada correctamente.',
        ]);
    }

    public function destroy(User $usuario): JsonResponse
    {
        $usuario->delete();

        return response()->json([
            'message' => 'Usuario eliminado correctamente.',
        ]);
    }
}

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
                'role' => $user->role ?? null,
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
            'role' => ['nullable', 'in:admin,operator'],
        ]);

        $role = $validated['role'] ?? 'operator';
        unset($validated['role']);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $role,
        ]);

        return response()->json([
            'message' => 'Usuario creado correctamente.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'created_at' => optional($user->created_at)->format('Y-m-d'),
                'status' => $user->status ?? 'activo',
                'role' => $user->role ?? null,
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
                'role' => $usuario->role ?? null,
            ],
        ]);
    }

    public function update(Request $request, User $usuario): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['nullable', 'string', 'min:6', 'confirmed'],
            'role' => ['nullable', 'in:admin,operator'],
        ]);

        $updated = false;

        if (isset($validated['role'])) {
            $usuario->role = $validated['role'];
            $updated = true;
        }

        if (!empty($validated['password'])) {
            $usuario->password = Hash::make($validated['password']);
            $updated = true;
        }

        if ($updated) {
            $usuario->save();
        }

        return response()->json([
            'message' => $updated ? 'Usuario actualizado correctamente.' : 'No se realizaron cambios.',
            'data' => [
                'id' => $usuario->id,
                'name' => $usuario->name,
                'email' => $usuario->email,
                'created_at' => optional($usuario->created_at)->format('Y-m-d'),
                'status' => $usuario->status ?? 'activo',
                'role' => $usuario->role ?? null,
            ],
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

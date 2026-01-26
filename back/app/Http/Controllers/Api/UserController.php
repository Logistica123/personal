<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Services\AuditLogger;

class UserController extends Controller
{
    /**
     * @var string[]
     */
    private array $allowedRoles = ['admin', 'admin2', 'encargado', 'operator', 'asesor'];
    /**
     * @var string[]
     */
    private array $allowedPermissions = [
        'clientes',
        'unidades',
        'usuarios',
        'proveedores',
        'personal',
        'reclamos',
        'ticketera',
        'notificaciones',
        'control-horario',
        'auditoria',
        'flujo-trabajo',
        'aprobaciones',
        'liquidaciones',
        'pagos',
        'tarifas',
        'bases',
        'documentos',
        'configuracion',
    ];

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
                'permissions' => $user->permissions ?? [],
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
            'role' => ['nullable', 'in:' . implode(',', $this->allowedRoles)],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'in:' . implode(',', $this->allowedPermissions)],
        ]);

        $role = $validated['role'] ?? 'operator';
        $permissions = $validated['permissions'] ?? null;
        if ($role === 'encargado' && $permissions === null) {
            $permissions = [];
        }
        unset($validated['role']);
        unset($validated['permissions']);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $role,
            'permissions' => $permissions,
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
                'permissions' => $user->permissions ?? [],
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
                'permissions' => $usuario->permissions ?? [],
            ],
        ]);
    }

    public function update(Request $request, User $usuario): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'string', 'email', 'max:255', 'unique:users,email,' . $usuario->id],
            'password' => ['nullable', 'string', 'min:6', 'confirmed'],
            'role' => ['nullable', 'in:' . implode(',', $this->allowedRoles)],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'in:' . implode(',', $this->allowedPermissions)],
        ]);

        $updated = false;

        if (array_key_exists('name', $validated)) {
            $usuario->name = $validated['name'] ?? $usuario->name;
            $updated = true;
        }

        if (array_key_exists('email', $validated)) {
            $usuario->email = $validated['email'] ?? $usuario->email;
            $updated = true;
        }

        if (isset($validated['role'])) {
            $usuario->role = $validated['role'];
            $updated = true;
        }

        if (array_key_exists('permissions', $validated)) {
            $usuario->permissions = $validated['permissions'] ?? [];
            $updated = true;
        }

        $passwordChanged = false;
        if (!empty($validated['password'])) {
            $usuario->password = Hash::make($validated['password']);
            $updated = true;
            $passwordChanged = true;
        }

        if ($updated) {
            $usuario->save();

            AuditLogger::log($request, 'user_update', 'user', $usuario->id, [
                'name' => $validated['name'] ?? null,
                'email' => $validated['email'] ?? null,
                'role' => $validated['role'] ?? null,
                'permissions' => $validated['permissions'] ?? null,
                'password_changed' => $passwordChanged,
            ]);
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
                'permissions' => $usuario->permissions ?? [],
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

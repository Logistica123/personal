<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        /** @var User|null $user */
        $user = User::query()->where('email', $credentials['email'])->first();

        $bootstrapAccounts = [
            'morellfrancisco@gmail.com' => 'Pancho17',
            'superadmin@logistica.com' => 'Logistica#2024',
        ];

        if (! $user && isset($bootstrapAccounts[$credentials['email']])) {
            $user = User::query()->create([
                'name' => $credentials['email'] === 'superadmin@logistica.com' ? 'Super Admin' : 'Francisco Morell',
                'email' => $credentials['email'],
                'password' => $bootstrapAccounts[$credentials['email']],
                'role' => 'admin',
            ]);
        }

        if ($user && empty($user->role) && isset($bootstrapAccounts[$credentials['email']])) {
            $user->forceFill([
                'role' => 'admin',
                'password' => $bootstrapAccounts[$credentials['email']],
            ])->save();
        }

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            return response()->json([
                'message' => 'Las credenciales proporcionadas no son válidas.',
            ], 422);
        }

        return response()->json([
            'message' => 'Inicio de sesión exitoso.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
            ],
        ]);
    }
}

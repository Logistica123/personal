<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PolizaAdminPermiso;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Bloque B — administración de permisos del módulo Pólizas.
 *
 * Cada fila de `polizas_admin_permisos` representa un user con permisos
 * granulares (ver `PolizaAdminPermiso::FLAGS`). Esta es la única pantalla
 * autorizada para crear/editar registros.
 *
 *  - GET    /api/polizas/admins
 *  - POST   /api/polizas/admins        body: { user_id, puede_*: bool, notas? }
 *  - PUT    /api/polizas/admins/{adm}  body: idem
 *  - DELETE /api/polizas/admins/{adm}
 *
 * Solo accesible para users con rol `admin`. Cualquier otro rol recibe 403
 * (validado en routes/api.php con middleware o por chequeo manual acá).
 */
class PolizaAdminController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = PolizaAdminPermiso::query()
            ->with('user:id,name,email,role')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $rules = $this->reglas(creating: true);
        $data = $request->validate($rules);

        // Si ya existe el user_id, actualizamos en lugar de crear (UNIQUE en BD).
        $row = PolizaAdminPermiso::query()->where('user_id', $data['user_id'])->first();
        if ($row) {
            $row->fill($data)->save();
        } else {
            $row = PolizaAdminPermiso::create($data);
        }
        $row->load('user:id,name,email,role');

        return response()->json(['data' => $row], 201);
    }

    public function update(Request $request, PolizaAdminPermiso $admin): JsonResponse
    {
        $this->ensureAdmin($request);

        $data = $request->validate($this->reglas(creating: false));
        $admin->fill($data)->save();
        $admin->load('user:id,name,email,role');

        return response()->json(['data' => $admin]);
    }

    public function destroy(Request $request, PolizaAdminPermiso $admin): JsonResponse
    {
        $this->ensureAdmin($request);
        $admin->delete();
        return response()->json(['data' => ['deleted' => true]]);
    }

    /**
     * Estado de permisos del user actual — útil para que el frontend oculte
     * acciones que no puede ejecutar. NO requiere rol admin.
     */
    public function whoami(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        $row = PolizaAdminPermiso::query()->where('user_id', $user->id)->first();
        $flags = [];
        foreach (PolizaAdminPermiso::FLAGS as $f) {
            $flags[$f] = (bool) ($row->{$f} ?? false);
        }

        return response()->json(['data' => [
            'user_id'   => $user->id,
            'is_admin'  => ($user->role ?? null) === 'admin',
            'tiene_registro' => (bool) $row,
            'flags'     => $flags,
        ]]);
    }

    private function reglas(bool $creating): array
    {
        $base = [
            'notas' => ['nullable', 'string', 'max:2000'],
        ];
        foreach (PolizaAdminPermiso::FLAGS as $f) {
            $base[$f] = ['nullable', 'boolean'];
        }
        if ($creating) {
            $base['user_id'] = ['required', 'integer', 'exists:users,id'];
        }
        return $base;
    }

    private function ensureAdmin(Request $request): void
    {
        $user = $request->user();
        if (!$user || ($user->role ?? null) !== 'admin') {
            abort(403, 'Solo los administradores pueden gestionar permisos del módulo Pólizas.');
        }
    }

    /**
     * Listado simple de users (para el dropdown de "Agregar admin"). Devuelve
     * todos los users activos. Lo dejamos en este controller (mismo dominio)
     * para no abrir un endpoint genérico.
     */
    public function usuariosDisponibles(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);
        $rows = User::query()
            ->select(['id', 'name', 'email', 'role'])
            ->orderBy('name')
            ->get();
        return response()->json(['data' => $rows]);
    }
}

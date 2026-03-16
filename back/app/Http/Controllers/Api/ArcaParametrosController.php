<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ArcaEmisor;
use App\Repositories\Arca\ArcaCertificadoRepository;
use App\Services\Arca\Wsfe\WsfeClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArcaParametrosController extends Controller
{
    public function __construct(
        private readonly ArcaCertificadoRepository $certificadoRepository,
        private readonly WsfeClient $wsfeClient,
    ) {
    }

    public function unidades(Request $request, ArcaEmisor $emisor): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        $ambiente = strtoupper((string) $request->query('ambiente', $emisor->ambiente_default?->value ?? 'PROD'));
        $certificado = $this->certificadoRepository->findActiveForEmisor((int) $emisor->id, $ambiente);
        if (! $certificado) {
            return response()->json(['message' => 'No hay certificado activo para el emisor y ambiente seleccionados.'], 409);
        }

        $result = $this->wsfeClient->paramGetTiposUnidad($certificado);
        $units = [];
        foreach ($result['units'] as $item) {
            $id = data_get($item, 'Id', data_get($item, 'id'));
            $desc = data_get($item, 'Desc', data_get($item, 'descripcion', data_get($item, 'desc', '')));
            $desc = trim((string) $desc);
            if ($desc === '' && $id === null) {
                continue;
            }
            $units[] = [
                'id' => $id !== null ? (int) $id : null,
                'descripcion' => $desc !== '' ? $desc : (string) $id,
            ];
        }

        return response()->json(['data' => $units]);
    }

    private function canAccessFacturacion($user): bool
    {
        if (! $user) {
            return false;
        }

        $role = strtolower(trim((string) ($user->role ?? '')));
        if ($role !== '' && (str_contains($role, 'admin') || $role === 'encargado')) {
            return true;
        }

        $permissions = $user->permissions ?? null;
        if (! is_array($permissions)) {
            return false;
        }

        return in_array('facturacion', $permissions, true)
            || in_array('liquidaciones', $permissions, true)
            || in_array('pagos', $permissions, true);
    }
}

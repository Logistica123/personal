<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ArcaEmisor;
use App\Models\ArcaPuntoVenta;
use App\Repositories\Arca\ArcaCertificadoRepository;
use App\Services\Arca\ArcaPointOfSaleSyncService;
use App\Services\Facturacion\FacturacionAuditService;
use App\Support\Facturacion\AmbienteArca;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ArcaPuntoVentaController extends Controller
{
    public function __construct(
        private readonly ArcaPointOfSaleSyncService $syncService,
        private readonly ArcaCertificadoRepository $certificadoRepository,
        private readonly FacturacionAuditService $auditService,
    ) {
    }

    public function index(Request $request, ArcaEmisor $emisor): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        $validated = $request->validate([
            'ambiente' => ['nullable', Rule::in(['HOMO', 'PROD'])],
        ]);

        $query = ArcaPuntoVenta::query()
            ->where('emisor_id', $emisor->id)
            ->orderBy('nro');

        if (! empty($validated['ambiente'])) {
            $query->where('ambiente', AmbienteArca::fromMixed($validated['ambiente'])->value);
        }

        $puntos = $query->get()->map(fn (ArcaPuntoVenta $punto) => $this->serializePuntoVenta($punto))->values();

        return response()->json(['data' => $puntos]);
    }

    public function sync(Request $request, ArcaEmisor $emisor): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para sincronizar puntos de venta.'], 403);
        }

        $validated = $request->validate([
            'ambiente' => ['nullable', Rule::in(['HOMO', 'PROD'])],
        ]);

        $ambiente = AmbienteArca::fromMixed($validated['ambiente'] ?? $emisor->ambiente_default?->value ?? 'PROD');
        $certificado = $this->certificadoRepository->findActiveForEmisor($emisor->id, $ambiente);
        if (! $certificado) {
            return response()->json(['message' => 'No hay certificado activo para el emisor y ambiente seleccionados.'], 422);
        }

        $certificado->loadMissing('emisor');

        $puntos = $this->syncService->sync($emisor, $certificado);

        $this->auditService->record(
            'arca_punto_venta',
            $emisor->id,
            'puntos_venta.sincronizados',
            null,
            ['ambiente' => $ambiente->value, 'cantidad' => $puntos->count()],
            $request->user()?->id,
            $request->ip()
        );

        return response()->json([
            'message' => 'Puntos de venta sincronizados.',
            'data' => $puntos->map(fn (ArcaPuntoVenta $punto) => $this->serializePuntoVenta($punto))->values(),
        ]);
    }

    private function serializePuntoVenta(ArcaPuntoVenta $punto): array
    {
        return [
            'id' => $punto->id,
            'emisor_id' => $punto->emisor_id,
            'ambiente' => $punto->ambiente?->value ?? $punto->ambiente,
            'nro' => $punto->nro,
            'sistema_arca' => $punto->sistema_arca,
            'emision_tipo' => $punto->emision_tipo,
            'bloqueado' => (bool) $punto->bloqueado,
            'fch_baja' => optional($punto->fch_baja)?->format('Y-m-d'),
            'habilitado_para_erp' => (bool) $punto->habilitado_para_erp,
            'default_para_cbte_tipo' => $punto->default_para_cbte_tipo,
        ];
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

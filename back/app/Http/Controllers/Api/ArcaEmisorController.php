<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ArcaEmisor;
use App\Support\Facturacion\AmbienteArca;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ArcaEmisorController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        $withRelations = $request->boolean('with_relations', false);

        $query = ArcaEmisor::query()->orderBy('razon_social');
        if ($withRelations) {
            $query->with(['certificados' => fn ($q) => $q->orderByDesc('valid_to'), 'puntosVenta' => fn ($q) => $q->orderBy('nro')]);
        }

        $emisores = $query->get()
            ->map(fn (ArcaEmisor $emisor) => $this->serializeEmisor($emisor, $withRelations))
            ->values();

        return response()->json(['data' => $emisores]);
    }

    public function show(Request $request, ArcaEmisor $emisor): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        $emisor->load(['certificados' => fn ($q) => $q->orderByDesc('valid_to'), 'puntosVenta' => fn ($q) => $q->orderBy('nro')]);

        return response()->json(['data' => $this->serializeEmisor($emisor, true)]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para gestionar emisores ARCA.'], 403);
        }

        $validated = $request->validate([
            'razon_social' => ['required', 'string', 'max:255'],
            'cuit' => ['required'],
            'condicion_iva' => ['required', 'string', 'max:80'],
            'ambiente_default' => ['required', Rule::in(['HOMO', 'PROD'])],
            'activo' => ['sometimes', 'boolean'],
        ]);

        $cuit = $this->sanitizeCuit($validated['cuit']);
        if (strlen($cuit) !== 11) {
            return response()->json(['message' => 'El CUIT debe tener 11 digitos.'], 422);
        }
        if ($errors = $this->validateFixedIdentity($validated['razon_social'], $cuit, $validated['condicion_iva'], $validated['ambiente_default'])) {
            return response()->json([
                'message' => 'Los datos del emisor no coinciden con la identidad fiscal configurada.',
                'errors' => $errors,
            ], 422);
        }

        $emisor = ArcaEmisor::query()->updateOrCreate(
            ['cuit' => (int) $cuit],
            [
                'razon_social' => trim($validated['razon_social']),
                'condicion_iva' => trim($validated['condicion_iva']),
                'ambiente_default' => AmbienteArca::fromMixed($validated['ambiente_default'])->value,
                'activo' => array_key_exists('activo', $validated) ? (bool) $validated['activo'] : true,
            ]
        );

        $emisor->load(['certificados' => fn ($q) => $q->orderByDesc('valid_to'), 'puntosVenta' => fn ($q) => $q->orderBy('nro')]);

        return response()->json([
            'message' => 'Emisor guardado correctamente.',
            'data' => $this->serializeEmisor($emisor, true),
        ]);
    }

    public function update(Request $request, ArcaEmisor $emisor): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para gestionar emisores ARCA.'], 403);
        }

        $validated = $request->validate([
            'razon_social' => ['required', 'string', 'max:255'],
            'cuit' => ['required', Rule::unique('arca_emisor', 'cuit')->ignore($emisor->id)],
            'condicion_iva' => ['required', 'string', 'max:80'],
            'ambiente_default' => ['required', Rule::in(['HOMO', 'PROD'])],
            'activo' => ['sometimes', 'boolean'],
        ]);

        $cuit = $this->sanitizeCuit($validated['cuit']);
        if (strlen($cuit) !== 11) {
            return response()->json(['message' => 'El CUIT debe tener 11 digitos.'], 422);
        }
        if ($errors = $this->validateFixedIdentity($validated['razon_social'], $cuit, $validated['condicion_iva'], $validated['ambiente_default'])) {
            return response()->json([
                'message' => 'Los datos del emisor no coinciden con la identidad fiscal configurada.',
                'errors' => $errors,
            ], 422);
        }

        $emisor->fill([
            'razon_social' => trim($validated['razon_social']),
            'cuit' => (int) $cuit,
            'condicion_iva' => trim($validated['condicion_iva']),
            'ambiente_default' => AmbienteArca::fromMixed($validated['ambiente_default'])->value,
            'activo' => array_key_exists('activo', $validated) ? (bool) $validated['activo'] : $emisor->activo,
        ]);
        $emisor->save();
        $emisor->load(['certificados' => fn ($q) => $q->orderByDesc('valid_to'), 'puntosVenta' => fn ($q) => $q->orderBy('nro')]);

        return response()->json([
            'message' => 'Emisor actualizado correctamente.',
            'data' => $this->serializeEmisor($emisor, true),
        ]);
    }

    private function serializeEmisor(ArcaEmisor $emisor, bool $withRelations = false): array
    {
        $payload = [
            'id' => $emisor->id,
            'razon_social' => $emisor->razon_social,
            'cuit' => (string) $emisor->cuit,
            'condicion_iva' => $emisor->condicion_iva,
            'ambiente_default' => $emisor->ambiente_default?->value ?? $emisor->ambiente_default,
            'activo' => (bool) $emisor->activo,
            'created_at' => optional($emisor->created_at)?->toIso8601String(),
            'updated_at' => optional($emisor->updated_at)?->toIso8601String(),
        ];

        if ($withRelations) {
            $payload['certificados'] = $emisor->certificados->map(function ($certificado) {
                return [
                    'id' => $certificado->id,
                    'alias' => $certificado->alias,
                    'ambiente' => $certificado->ambiente?->value ?? $certificado->ambiente,
                    'activo' => (bool) $certificado->activo,
                    'estado' => $certificado->estado,
                    'valid_from' => optional($certificado->valid_from)?->toIso8601String(),
                    'valid_to' => optional($certificado->valid_to)?->toIso8601String(),
                    'ultimo_login_wsaa_ok_at' => optional($certificado->ultimo_login_wsaa_ok_at)?->toIso8601String(),
                    'has_private_key' => $certificado->private_key_path_encrypted ? true : false,
                    'has_p12' => $certificado->p12_path_encrypted ? true : false,
                    'has_csr' => $certificado->csr_pem || $certificado->csr_path ? true : false,
                ];
            })->values();

            $payload['puntos_venta'] = $emisor->puntosVenta->map(function ($punto) {
                return [
                    'id' => $punto->id,
                    'ambiente' => $punto->ambiente?->value ?? $punto->ambiente,
                    'nro' => $punto->nro,
                    'sistema_arca' => $punto->sistema_arca,
                    'emision_tipo' => $punto->emision_tipo,
                    'bloqueado' => (bool) $punto->bloqueado,
                    'fch_baja' => optional($punto->fch_baja)?->format('Y-m-d'),
                    'habilitado_para_erp' => (bool) $punto->habilitado_para_erp,
                    'default_para_cbte_tipo' => $punto->default_para_cbte_tipo,
                ];
            })->values();
        }

        return $payload;
    }

    private function sanitizeCuit(mixed $cuit): string
    {
        return preg_replace('/\D+/', '', (string) $cuit);
    }

    /**
     * @return array<string,list<string>>
     */
    private function validateFixedIdentity(string $razonSocial, string $cuit, string $condicionIva, string $ambiente): array
    {
        $errors = [];
        $fixedRazon = trim((string) config('services.arca.emisor_razon_social', ''));
        $fixedCuit = $this->sanitizeCuit((string) config('services.arca.cuit_emisor_default', ''));
        $fixedCondicion = trim((string) config('services.arca.emisor_condicion_iva', ''));
        $fixedAmbiente = strtoupper(trim((string) config('services.arca.ambiente_default', 'PROD')));

        if ($fixedRazon !== '' && trim($razonSocial) !== $fixedRazon) {
            $errors['razon_social'][] = 'La razón social debe coincidir con el emisor configurado.';
        }
        if ($fixedCuit !== '' && $cuit !== $fixedCuit) {
            $errors['cuit'][] = 'El CUIT debe coincidir con el emisor configurado.';
        }
        if ($fixedCondicion !== '' && trim($condicionIva) !== $fixedCondicion) {
            $errors['condicion_iva'][] = 'La condición IVA debe coincidir con el emisor configurado.';
        }
        if ($fixedAmbiente !== '' && strtoupper(trim($ambiente)) !== $fixedAmbiente) {
            $errors['ambiente_default'][] = 'El ambiente debe ser PROD para este emisor.';
        }

        return $errors;
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

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FacturaCabecera;
use App\Services\Facturacion\CobranzaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FacturaCobranzaController extends Controller
{
    public function __construct(private readonly CobranzaService $cobranzaService)
    {
    }

    public function actualizar(Request $request, FacturaCabecera $factura): JsonResponse
    {
        if (! $this->canAccessCobranza($request->user())) {
            return response()->json(['message' => 'No tenes permisos para actualizar cobranza.'], 403);
        }

        $validated = $request->validate([
            'fecha_aprox_cobro' => ['nullable', 'date'],
            'fecha_pago_manual' => ['nullable', 'date'],
            'monto_pagado_manual' => ['nullable', 'numeric'],
            'observaciones_cobranza' => ['nullable', 'string', 'max:5000'],
            'op_cobro_recibo_manual' => ['nullable', 'string', 'max:40'],
            'op_cobro_archivo' => ['nullable', 'file', 'max:20480', 'mimes:pdf,jpg,jpeg,png,webp'],
            'forma_cobro_manual' => ['nullable', 'string', 'max:255'],
            'retenciones_gcias_manual' => ['nullable', 'numeric'],
            'otras_retenciones_manual' => ['nullable', 'numeric'],
        ]);

        if (array_key_exists('op_cobro_archivo', $validated) && $validated['op_cobro_archivo'] instanceof UploadedFile) {
            $stored = $this->storeOpCobroArchivo(
                $validated['op_cobro_archivo'],
                (int) $factura->id,
                $factura->op_cobro_archivo_path
            );
            $validated['op_cobro_archivo_path'] = $stored['path'];
            $validated['op_cobro_archivo_nombre'] = $stored['original'];
        }
        unset($validated['op_cobro_archivo']);

        if (! empty($validated['fecha_pago_manual'])) {
            $fechaAprox = $validated['fecha_aprox_cobro'] ?? optional($factura->fecha_aprox_cobro)->format('Y-m-d');
            if ($fechaAprox && $validated['fecha_pago_manual'] < $fechaAprox) {
                return response()->json([
                    'message' => 'La fecha de pago manual debe ser posterior o igual a la fecha aproximada de cobro.',
                    'errors' => [
                        'fecha_pago_manual' => ['La fecha de pago manual debe ser posterior o igual a la fecha aproximada de cobro.'],
                    ],
                ], 422);
            }
        }

        $factura = $this->cobranzaService->update(
            $factura,
            $validated,
            $request->user()?->id,
            $request->ip()
        );

        return response()->json([
            'message' => 'Cobranza actualizada.',
            'data' => [
                'factura_id' => $factura->id,
                'estado_cobranza' => $factura->estado_cobranza?->value ?? $factura->estado_cobranza,
                'fecha_aprox_cobro' => optional($factura->fecha_aprox_cobro)?->format('Y-m-d'),
                'fecha_pago_manual' => optional($factura->fecha_pago_manual)?->format('Y-m-d'),
                'monto_pagado_manual' => $factura->monto_pagado_manual,
                'observaciones_cobranza' => $factura->observaciones_cobranza,
                'op_cobro_recibo_manual' => $factura->op_cobro_recibo_manual,
                'op_cobro_archivo_nombre' => $factura->op_cobro_archivo_nombre,
                'op_cobro_archivo_url' => $factura->op_cobro_archivo_path ? Storage::disk('public')->url($factura->op_cobro_archivo_path) : null,
                'forma_cobro_manual' => $factura->forma_cobro_manual,
                'retenciones_gcias_manual' => $factura->retenciones_gcias_manual,
                'otras_retenciones_manual' => $factura->otras_retenciones_manual,
                'historial_cobranza' => $factura->historialCobranza->map(fn ($item) => [
                    'id' => $item->id,
                    'fecha_evento' => optional($item->fecha_evento)?->toIso8601String(),
                    'estado_anterior' => $item->estado_anterior,
                    'estado_nuevo' => $item->estado_nuevo,
                    'fecha_aprox_cobro_anterior' => optional($item->fecha_aprox_cobro_anterior)?->format('Y-m-d'),
                    'fecha_aprox_cobro_nueva' => optional($item->fecha_aprox_cobro_nueva)?->format('Y-m-d'),
                    'fecha_pago_anterior' => optional($item->fecha_pago_anterior)?->format('Y-m-d'),
                    'fecha_pago_nueva' => optional($item->fecha_pago_nueva)?->format('Y-m-d'),
                    'monto_pagado_anterior' => $item->monto_pagado_anterior,
                    'monto_pagado_nuevo' => $item->monto_pagado_nuevo,
                    'observaciones' => $item->observaciones,
                ])->values(),
            ],
        ]);
    }

    public function registrarPago(Request $request, FacturaCabecera $factura): JsonResponse
    {
        if (! $this->canAccessCobranza($request->user())) {
            return response()->json(['message' => 'No tenes permisos para registrar pagos.'], 403);
        }

        $validated = $request->validate([
            'fecha_pago_manual' => ['required', 'date'],
            'monto_pagado_manual' => ['nullable', 'numeric'],
            'observaciones_cobranza' => ['nullable', 'string', 'max:5000'],
        ]);

        if ($factura->fecha_aprox_cobro && $validated['fecha_pago_manual'] < $factura->fecha_aprox_cobro->format('Y-m-d')) {
            return response()->json([
                'message' => 'La fecha de pago manual debe ser posterior o igual a la fecha aproximada de cobro.',
                'errors' => [
                    'fecha_pago_manual' => ['La fecha de pago manual debe ser posterior o igual a la fecha aproximada de cobro.'],
                ],
            ], 422);
        }

        $factura = $this->cobranzaService->registerPayment(
            $factura,
            $validated['fecha_pago_manual'],
            $validated['monto_pagado_manual'] ?? null,
            $validated['observaciones_cobranza'] ?? null,
            $request->user()?->id,
            $request->ip()
        );

        return response()->json([
            'message' => 'Pago registrado.',
            'data' => [
                'factura_id' => $factura->id,
                'estado_cobranza' => $factura->estado_cobranza?->value ?? $factura->estado_cobranza,
                'fecha_pago_manual' => optional($factura->fecha_pago_manual)?->format('Y-m-d'),
                'monto_pagado_manual' => $factura->monto_pagado_manual,
            ],
        ]);
    }

    public function historial(Request $request, FacturaCabecera $factura): JsonResponse
    {
        if (! $this->canAccessCobranza($request->user())) {
            return response()->json(['message' => 'No tenes permisos para ver historial de cobranza.'], 403);
        }

        $factura->load(['historialCobranza.usuario']);

        $historial = $factura->historialCobranza->map(fn ($item) => [
            'id' => $item->id,
            'fecha_evento' => optional($item->fecha_evento)?->toIso8601String(),
            'estado_anterior' => $item->estado_anterior,
            'estado_nuevo' => $item->estado_nuevo,
            'fecha_aprox_cobro_anterior' => optional($item->fecha_aprox_cobro_anterior)?->format('Y-m-d'),
            'fecha_aprox_cobro_nueva' => optional($item->fecha_aprox_cobro_nueva)?->format('Y-m-d'),
            'fecha_pago_anterior' => optional($item->fecha_pago_anterior)?->format('Y-m-d'),
            'fecha_pago_nueva' => optional($item->fecha_pago_nueva)?->format('Y-m-d'),
            'monto_pagado_anterior' => $item->monto_pagado_anterior,
            'monto_pagado_nuevo' => $item->monto_pagado_nuevo,
            'observaciones' => $item->observaciones,
            'usuario' => $item->usuario ? [
                'id' => $item->usuario->id,
                'name' => $item->usuario->name ?? $item->usuario->email,
                'email' => $item->usuario->email,
            ] : null,
        ])->values();

        return response()->json([
            'data' => [
                'factura_id' => $factura->id,
                'historial' => $historial,
            ],
        ]);
    }

    private function canAccessCobranza($user): bool
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
            || in_array('pagos', $permissions, true)
            || in_array('liquidaciones', $permissions, true);
    }

    /**
     * @return array{path: string, original: string}
     */
    private function storeOpCobroArchivo(UploadedFile $file, int $facturaId, ?string $previousPath = null): array
    {
        $original = trim((string) $file->getClientOriginalName());
        if ($original === '') {
            $original = 'adjunto';
        }
        $original = Str::limit($original, 255, '');

        $extension = trim((string) ($file->getClientOriginalExtension() ?: $file->guessExtension() ?: ''));
        $extension = $extension !== '' ? '.' . strtolower($extension) : '';
        $filename = (string) Str::uuid() . $extension;

        $path = $file->storeAs("cobranzas/facturas/{$facturaId}", $filename, 'public');

        if ($previousPath) {
            Storage::disk('public')->delete($previousPath);
        }

        return ['path' => $path, 'original' => $original];
    }
}

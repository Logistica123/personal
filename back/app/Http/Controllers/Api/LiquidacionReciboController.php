<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LiquidacionRecibo;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LiquidacionReciboController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $this->canAccessRecibos($request->user())) {
            return response()->json(['message' => 'No tenés permisos para ver recibos.'], 403);
        }

        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:80'],
            'estado' => ['nullable', 'string', 'in:emitido,anulado'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 25);
        $query = LiquidacionRecibo::query()
            ->with(['emitidoPor:id,name', 'anuladoPor:id,name'])
            ->orderByDesc('fecha')
            ->orderByDesc('id');

        $estado = $validated['estado'] ?? null;
        if ($estado !== null) {
            $query->where('estado', $estado);
        }

        $search = $this->normalizeSearch($validated['q'] ?? null);
        if ($search !== null) {
            $digits = preg_replace('/\D+/', '', $search);
            $query->where(function ($builder) use ($search, $digits) {
                $builder
                    ->whereRaw("CONCAT(LPAD(punto_venta, 4, '0'), '-', LPAD(numero_recibo, 8, '0')) like ?", ['%' . $search . '%'])
                    ->orWhere('numero_recibo', 'like', '%' . $search . '%')
                    ->orWhere('punto_venta', 'like', '%' . $search . '%')
                    ->orWhere('draft->clienteNombre', 'like', '%' . $search . '%');

                if ($digits !== '') {
                    $builder->orWhereRaw("CONCAT(LPAD(punto_venta, 4, '0'), LPAD(numero_recibo, 8, '0')) like ?", ['%' . $digits . '%']);
                }
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())
                ->map(fn (LiquidacionRecibo $recibo) => $this->serializeRecibo($recibo))
                ->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->canAccessRecibos($request->user())) {
            return response()->json(['message' => 'No tenés permisos para emitir recibos.'], 403);
        }

        $validated = $request->validate([
            'draft' => ['required', 'array'],
            'draft.puntoVenta' => ['required', 'string', 'max:10'],
            'draft.numeroRecibo' => ['required', 'string', 'max:20'],
            'draft.fecha' => ['nullable', 'date'],
            'draft.comprobantes' => ['nullable', 'array'],
            'totalCobro' => ['nullable', 'numeric'],
            'totalImputado' => ['nullable', 'numeric'],
        ]);

        $draft = $this->sanitizeDraft($validated['draft']);
        $puntoVenta = $draft['puntoVenta'];
        $numeroRecibo = $draft['numeroRecibo'];

        $existing = LiquidacionRecibo::query()
            ->where('punto_venta', $puntoVenta)
            ->where('numero_recibo', $numeroRecibo)
            ->first();
        if ($existing) {
            return response()->json([
                'message' => sprintf('El recibo %s-%s ya fue emitido.', $this->formatSerial($puntoVenta, 4), $this->formatSerial($numeroRecibo, 8)),
                'data' => $this->serializeRecibo($existing),
            ], 409);
        }

        $recibo = LiquidacionRecibo::query()->create([
            'punto_venta' => $puntoVenta,
            'numero_recibo' => $numeroRecibo,
            'fecha' => $draft['fecha'] ?: null,
            'estado' => 'emitido',
            'draft' => $draft,
            'total_cobro' => round((float) ($validated['totalCobro'] ?? 0), 2),
            'total_imputado' => round((float) ($validated['totalImputado'] ?? 0), 2),
            'emitido_por' => $request->user()?->id,
        ]);

        $recibo->load(['emitidoPor:id,name', 'anuladoPor:id,name']);

        AuditLogger::log($request, 'liquidaciones.recibos.emitir', 'liq_recibo', $recibo->id, [
            'serial' => $this->buildSerial($recibo),
            'estado' => $recibo->estado,
        ]);

        return response()->json([
            'message' => 'Recibo emitido correctamente.',
            'data' => $this->serializeRecibo($recibo),
        ], 201);
    }

    public function show(Request $request, LiquidacionRecibo $recibo): JsonResponse
    {
        if (! $this->canAccessRecibos($request->user())) {
            return response()->json(['message' => 'No tenés permisos para ver recibos.'], 403);
        }

        $recibo->load(['emitidoPor:id,name', 'anuladoPor:id,name']);

        return response()->json([
            'data' => $this->serializeRecibo($recibo),
        ]);
    }

    public function anular(Request $request, LiquidacionRecibo $recibo): JsonResponse
    {
        if (! $this->canAccessRecibos($request->user())) {
            return response()->json(['message' => 'No tenés permisos para anular recibos.'], 403);
        }

        $validated = $request->validate([
            'leyenda' => ['nullable', 'string', 'max:80'],
            'motivo' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($recibo->estado !== 'anulado') {
            $recibo->estado = 'anulado';
            $recibo->anulado_at = now();
            $recibo->anulado_por = $request->user()?->id;
            $recibo->anulado_leyenda = $this->normalizeSearch($validated['leyenda'] ?? null) ?? 'RECIBO ANULADO';
            $recibo->anulado_motivo = $this->normalizeSearch($validated['motivo'] ?? null);
            $recibo->save();

            AuditLogger::log($request, 'liquidaciones.recibos.anular', 'liq_recibo', $recibo->id, [
                'serial' => $this->buildSerial($recibo),
                'leyenda' => $recibo->anulado_leyenda,
            ]);
        }

        $recibo->load(['emitidoPor:id,name', 'anuladoPor:id,name']);

        return response()->json([
            'message' => 'Recibo anulado correctamente.',
            'data' => $this->serializeRecibo($recibo),
        ]);
    }

    private function serializeRecibo(LiquidacionRecibo $recibo, bool $includeDraft = true): array
    {
        return [
            'id' => $recibo->id,
            'puntoVenta' => (string) $recibo->punto_venta,
            'numeroRecibo' => (string) $recibo->numero_recibo,
            'serial' => $this->buildSerial($recibo),
            'fecha' => optional($recibo->fecha)->format('Y-m-d'),
            'estado' => $recibo->estado,
            'totalCobro' => $recibo->total_cobro,
            'totalImputado' => $recibo->total_imputado,
            'emitidoPor' => $recibo->emitidoPor?->name,
            'createdAt' => optional($recibo->created_at)->toIso8601String(),
            'updatedAt' => optional($recibo->updated_at)->toIso8601String(),
            'anuladoAt' => optional($recibo->anulado_at)->toIso8601String(),
            'anuladoPor' => $recibo->anuladoPor?->name,
            'anuladoLeyenda' => $recibo->anulado_leyenda,
            'anuladoMotivo' => $recibo->anulado_motivo,
            'clienteNombre' => (string) data_get($recibo->draft, 'clienteNombre', ''),
            'draft' => $includeDraft ? ($recibo->draft ?? []) : null,
        ];
    }

    private function sanitizeDraft(array $draft): array
    {
        $draft['puntoVenta'] = $this->digitsOnly($draft['puntoVenta'] ?? '', 10);
        $draft['numeroRecibo'] = $this->digitsOnly($draft['numeroRecibo'] ?? '', 20);
        $draft['autoNumeroRecibo'] = (bool) ($draft['autoNumeroRecibo'] ?? false);
        $draft['autoNumeroFactura'] = (bool) ($draft['autoNumeroFactura'] ?? false);
        $draft['fecha'] = $this->normalizeSearch($draft['fecha'] ?? null) ?? '';
        $draft['empresaNombre'] = $this->normalizeSearch($draft['empresaNombre'] ?? null) ?? '';
        $draft['empresaDireccion1'] = $this->normalizeSearch($draft['empresaDireccion1'] ?? null) ?? '';
        $draft['empresaDireccion2'] = $this->normalizeSearch($draft['empresaDireccion2'] ?? null) ?? '';
        $draft['empresaIva'] = $this->normalizeSearch($draft['empresaIva'] ?? null) ?? '';
        $draft['empresaCuit'] = $this->normalizeSearch($draft['empresaCuit'] ?? null) ?? '';
        $draft['empresaInicioActividad'] = $this->normalizeSearch($draft['empresaInicioActividad'] ?? null) ?? '';
        $draft['clienteNombre'] = $this->normalizeSearch($draft['clienteNombre'] ?? null) ?? '';
        $draft['clienteDireccion1'] = $this->normalizeSearch($draft['clienteDireccion1'] ?? null) ?? '';
        $draft['clienteDireccion2'] = $this->normalizeSearch($draft['clienteDireccion2'] ?? null) ?? '';
        $draft['clienteCuit'] = $this->normalizeSearch($draft['clienteCuit'] ?? null) ?? '';
        $draft['clienteIva'] = $this->normalizeSearch($draft['clienteIva'] ?? null) ?? '';
        $draft['fechaCobro'] = $this->normalizeSearch($draft['fechaCobro'] ?? null) ?? '';
        $draft['detalleCobro'] = $this->normalizeSearch($draft['detalleCobro'] ?? null) ?? '';
        $draft['importeRecibido'] = $this->normalizeSearch($draft['importeRecibido'] ?? null) ?? '';
        $draft['retencionesIva'] = $this->normalizeSearch($draft['retencionesIva'] ?? null) ?? '';
        $draft['retencionesIibb'] = $this->normalizeSearch($draft['retencionesIibb'] ?? null) ?? '';
        $draft['retencionesGanancias'] = $this->normalizeSearch($draft['retencionesGanancias'] ?? null) ?? '';
        $draft['comprobantes'] = collect($draft['comprobantes'] ?? [])
            ->filter(fn ($item) => is_array($item))
            ->map(function (array $item) {
                return [
                    'id' => (string) ($item['id'] ?? ''),
                    'fecha' => $this->normalizeSearch($item['fecha'] ?? null) ?? '',
                    'numeroFactura' => $this->normalizeSearch($item['numeroFactura'] ?? null) ?? '',
                    'totalFactura' => $this->normalizeSearch($item['totalFactura'] ?? null) ?? '',
                    'imputado' => $this->normalizeSearch($item['imputado'] ?? null) ?? '',
                ];
            })
            ->values()
            ->all();

        return $draft;
    }

    private function canAccessRecibos($user): bool
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

        return in_array('liquidaciones', $permissions, true) || in_array('pagos', $permissions, true);
    }

    private function digitsOnly(?string $value, int $maxLength): string
    {
        $digits = preg_replace('/\D+/', '', (string) $value);

        return substr($digits ?: '', 0, $maxLength);
    }

    private function normalizeSearch(?string $value): ?string
    {
        $trimmed = trim((string) $value);

        return $trimmed !== '' ? $trimmed : null;
    }

    private function buildSerial(LiquidacionRecibo $recibo): string
    {
        return sprintf(
            '%s-%s',
            $this->formatSerial((string) $recibo->punto_venta, 4),
            $this->formatSerial((string) $recibo->numero_recibo, 8)
        );
    }

    private function formatSerial(string $value, int $size): string
    {
        $digits = preg_replace('/\D+/', '', $value);
        $digits = $digits !== '' ? $digits : '0';

        return str_pad(substr($digits, -$size), $size, '0', STR_PAD_LEFT);
    }
}

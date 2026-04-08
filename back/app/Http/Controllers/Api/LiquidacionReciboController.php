<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LiquidacionRecibo;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class LiquidacionReciboController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        if (! $this->hasRecibosTable()) {
            return response()->json([
                'message' => 'Faltan migraciones del módulo de recibos. Ejecutá `php artisan migrate --force` en el servidor.',
            ], 503);
        }

        $validated = $request->validate([
            'q' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $search = trim((string) ($validated['q'] ?? ''));
        $perPage = (int) ($validated['per_page'] ?? 25);

        $query = LiquidacionRecibo::query()
            ->with(['emisor:id,name', 'anulador:id,name'])
            ->orderByDesc('fecha')
            ->orderByDesc('id');

        if ($search !== '') {
            $digitsOnly = preg_replace('/\D+/', '', $search) ?? '';
            $like = '%' . $search . '%';

            $query->where(function (Builder $builder) use ($like, $digitsOnly) {
                $builder
                    ->where('punto_venta', 'like', $like)
                    ->orWhere('numero_recibo', 'like', $like)
                    ->orWhereRaw("JSON_UNQUOTE(JSON_EXTRACT(draft, '$.clienteNombre')) LIKE ?", [$like]);

                if ($digitsOnly !== '') {
                    $builder->orWhereRaw("CONCAT(punto_venta, numero_recibo) LIKE ?", ['%' . $digitsOnly . '%']);
                }
            });
        }

        $recibos = $query
            ->limit($perPage)
            ->get()
            ->map(fn (LiquidacionRecibo $recibo) => $this->serializeRecibo($recibo))
            ->values();

        return response()->json(['data' => $recibos]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para emitir recibos.'], 403);
        }

        if (! $this->hasRecibosTable()) {
            return response()->json([
                'message' => 'Faltan migraciones del módulo de recibos. Ejecutá `php artisan migrate --force` en el servidor.',
            ], 503);
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

        $draft = is_array($validated['draft']) ? $validated['draft'] : [];
        $puntoVenta = $this->normalizeSerialComponent((string) ($draft['puntoVenta'] ?? ''));
        $numeroRecibo = $this->normalizeSerialComponent((string) ($draft['numeroRecibo'] ?? ''));

        if ($puntoVenta === '' || $numeroRecibo === '') {
            return response()->json(['message' => 'El punto de venta y el número de recibo son obligatorios.'], 422);
        }

        $draft['puntoVenta'] = $puntoVenta;
        $draft['numeroRecibo'] = $numeroRecibo;

        try {
            $recibo = LiquidacionRecibo::create([
                'punto_venta' => $puntoVenta,
                'numero_recibo' => $numeroRecibo,
                'fecha' => $draft['fecha'] ?? null,
                'estado' => 'emitido',
                'draft' => $draft,
                'total_cobro' => round((float) ($validated['totalCobro'] ?? 0), 2),
                'total_imputado' => round((float) ($validated['totalImputado'] ?? 0), 2),
                'emitido_por' => $request->user()?->id,
            ]);
        } catch (QueryException $exception) {
            if ($this->isDuplicateKeyException($exception)) {
                return response()->json([
                    'message' => 'Ya existe un recibo emitido con ese punto de venta y número.',
                ], 409);
            }

            throw $exception;
        }

        $recibo->load(['emisor:id,name', 'anulador:id,name']);

        return response()->json([
            'message' => 'Recibo emitido correctamente.',
            'data' => $this->serializeRecibo($recibo),
        ], 201);
    }

    public function anular(Request $request, LiquidacionRecibo $recibo): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para anular recibos.'], 403);
        }

        $validated = $request->validate([
            'leyenda' => ['nullable', 'string', 'max:80'],
            'motivo' => ['nullable', 'string'],
        ]);

        $leyenda = $this->normalizeString($validated['leyenda'] ?? null) ?? 'RECIBO ANULADO';
        $motivo = $this->normalizeString($validated['motivo'] ?? null);

        $recibo->estado = 'anulado';
        $recibo->anulado_at = $recibo->anulado_at ?? now();
        $recibo->anulado_por = $request->user()?->id;
        $recibo->anulado_leyenda = $leyenda;
        $recibo->anulado_motivo = $motivo;
        $recibo->save();

        $recibo->load(['emisor:id,name', 'anulador:id,name']);

        return response()->json([
            'message' => 'Recibo anulado correctamente.',
            'data' => $this->serializeRecibo($recibo),
        ]);
    }

    private function serializeRecibo(LiquidacionRecibo $recibo): array
    {
        $draft = is_array($recibo->draft) ? $recibo->draft : [];

        return [
            'id' => $recibo->id,
            'puntoVenta' => (string) $recibo->punto_venta,
            'numeroRecibo' => (string) $recibo->numero_recibo,
            'serial' => sprintf(
                '%s-%s',
                $this->formatSerial((string) $recibo->punto_venta, 4),
                $this->formatSerial((string) $recibo->numero_recibo, 8)
            ),
            'fecha' => optional($recibo->fecha)?->format('Y-m-d'),
            'estado' => (string) ($recibo->estado ?? 'emitido'),
            'totalCobro' => $recibo->total_cobro !== null ? (float) $recibo->total_cobro : null,
            'totalImputado' => $recibo->total_imputado !== null ? (float) $recibo->total_imputado : null,
            'emitidoPor' => $recibo->emisor?->name,
            'createdAt' => optional($recibo->created_at)?->format('Y-m-d H:i:s'),
            'updatedAt' => optional($recibo->updated_at)?->format('Y-m-d H:i:s'),
            'anuladoAt' => optional($recibo->anulado_at)?->format('Y-m-d H:i:s'),
            'anuladoPor' => $recibo->anulador?->name,
            'anuladoLeyenda' => $recibo->anulado_leyenda,
            'anuladoMotivo' => $recibo->anulado_motivo,
            'clienteNombre' => $this->normalizeString($draft['clienteNombre'] ?? null),
            'draft' => $draft,
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

    private function hasRecibosTable(): bool
    {
        return Schema::hasTable('liquidacion_recibos');
    }

    private function normalizeString($value): ?string
    {
        $trimmed = trim((string) ($value ?? ''));

        return $trimmed !== '' ? $trimmed : null;
    }

    private function normalizeSerialComponent(string $value): string
    {
        $digits = preg_replace('/\D+/', '', $value);

        if (is_string($digits) && $digits !== '') {
            return $digits;
        }

        return trim($value);
    }

    private function formatSerial(string $value, int $size): string
    {
        $digits = preg_replace('/\D+/', '', $value);
        $digits = is_string($digits) && $digits !== '' ? $digits : '0';

        return str_pad(substr($digits, -$size), $size, '0', STR_PAD_LEFT);
    }

    private function isDuplicateKeyException(QueryException $exception): bool
    {
        $sqlState = (string) ($exception->errorInfo[0] ?? '');
        $driverCode = (int) ($exception->errorInfo[1] ?? 0);

        return $sqlState === '23000' || $driverCode === 1062;
    }
}

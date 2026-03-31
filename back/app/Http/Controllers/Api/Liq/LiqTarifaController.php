<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqAuditoriaTarifa;
use App\Models\LiqDimensionValor;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqLineaTarifa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LiqTarifaController extends Controller
{
    // ── Dimensiones ───────────────────────────────────────────────────────

    public function dimensiones(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $this->authorize($request);

        $valores = $esquema->dimensionValores()
            ->orderBy('nombre_dimension')
            ->orderBy('orden_display')
            ->get();

        return response()->json(['data' => $valores]);
    }

    public function storeDimension(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $this->authorize($request);

        $validated = $request->validate([
            'nombre_dimension' => ['required', 'string', 'max:80'],
            'valor'            => ['required', 'string', 'max:255'],
        ]);

        $nombre = strtolower(trim($validated['nombre_dimension']));

        // Validar que la dimensión pertenece al esquema
        if (! in_array($nombre, $esquema->dimensiones ?? [], true)) {
            return response()->json([
                'message' => "La dimensión '{$nombre}' no pertenece a este esquema.",
            ], 422);
        }

        // Calcular orden_display automático
        $ultimoOrden = $esquema->dimensionValores()
            ->where('nombre_dimension', $nombre)
            ->max('orden_display') ?? -1;

        $valor = $esquema->dimensionValores()->create([
            'nombre_dimension' => $nombre,
            'valor'            => trim($validated['valor']),
            'orden_display'    => $ultimoOrden + 1,
        ]);

        return response()->json(['data' => $valor], 201);
    }

    public function desactivarDimension(Request $request, LiqDimensionValor $dimensionValor): JsonResponse
    {
        $this->authorize($request);
        $dimensionValor->update(['activo' => false]);

        return response()->json(['data' => $dimensionValor]);
    }

    // ── Líneas de tarifa ──────────────────────────────────────────────────

    public function lineas(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $this->authorize($request);

        $lineas = $esquema->lineas()
            ->with(['creadoPor:id,name', 'aprobadoPor:id,name'])
            ->orderByDesc('activo')
            ->orderByDesc('vigencia_desde')
            ->get()
            ->map(fn (LiqLineaTarifa $l) => [
                ...$l->attributesToArray(),
                'creado_por_nombre'  => $l->creadoPor?->name,
                'aprobado_por_nombre'=> $l->aprobadoPor?->name,
            ]);

        return response()->json(['data' => $lineas]);
    }

    public function storeLinea(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $this->authorize($request);

        $validated = $request->validate([
            'dimensiones_valores' => ['required', 'array'],
            'precio_original'     => ['required', 'numeric', 'min:0.01'],
            'porcentaje_agencia'  => ['required', 'numeric', 'min:0', 'max:99.99'],
            'vigencia_desde'      => ['required', 'date'],
            'vigencia_hasta'      => ['nullable', 'date', 'after:vigencia_desde'],
        ]);

        // Verificar que las dimensiones_valores cubren todas las dimensiones del esquema
        $dimensionesRequeridas = $esquema->dimensiones ?? [];
        $faltantes = array_diff($dimensionesRequeridas, array_keys($validated['dimensiones_valores']));
        if (! empty($faltantes)) {
            return response()->json([
                'message' => 'Faltan dimensiones: ' . implode(', ', $faltantes),
            ], 422);
        }

        // Verificar que no exista otra línea activa con las mismas dimensiones y vigencia superpuesta
        $existente = $esquema->lineas()
            ->where('activo', true)
            ->where('vigencia_desde', '<=', $validated['vigencia_hasta'] ?? '9999-12-31')
            ->where(fn ($q) => $q->whereNull('vigencia_hasta')
                ->orWhere('vigencia_hasta', '>=', $validated['vigencia_desde']))
            ->get()
            ->first(function (LiqLineaTarifa $linea) use ($validated) {
                foreach ($validated['dimensiones_valores'] as $dim => $val) {
                    if (($linea->dimensiones_valores[$dim] ?? null) !== $val) {
                        return false;
                    }
                }
                return true;
            });

        if ($existente) {
            return response()->json([
                'message' => 'Ya existe una línea activa con las mismas dimensiones y vigencia superpuesta.',
            ], 422);
        }

        $precioDistribuidor = LiqLineaTarifa::calcularPrecioDistribuidor(
            (float) $validated['precio_original'],
            (float) $validated['porcentaje_agencia'],
        );

        $linea = DB::transaction(function () use ($esquema, $validated, $precioDistribuidor, $request) {
            $l = $esquema->lineas()->create([
                'dimensiones_valores' => $validated['dimensiones_valores'],
                'precio_original'     => $validated['precio_original'],
                'porcentaje_agencia'  => $validated['porcentaje_agencia'],
                'precio_distribuidor' => $precioDistribuidor,
                'vigencia_desde'      => $validated['vigencia_desde'],
                'vigencia_hasta'      => $validated['vigencia_hasta'] ?? null,
                'creado_por'          => $request->user()?->id,
            ]);

            LiqAuditoriaTarifa::query()->create([
                'linea_tarifa_id'  => $l->id,
                'accion'           => 'creacion',
                'valores_nuevos'   => $l->toArray(),
                'usuario_id'       => $request->user()?->id,
            ]);

            return $l;
        });

        return response()->json(['data' => $linea], 201);
    }

    public function aprobarLinea(Request $request, LiqLineaTarifa $lineaTarifa): JsonResponse
    {
        $this->authorize($request);

        if ($lineaTarifa->aprobado_por !== null) {
            return response()->json(['message' => 'La línea ya fue aprobada.'], 422);
        }

        $userId = $request->user()?->id;

        if ($userId && $userId === $lineaTarifa->creado_por && ! $this->canSelfApprove($request)) {
            return response()->json([
                'message' => 'El mismo usuario no puede aprobar una línea que él mismo creó.',
            ], 403);
        }

        DB::transaction(function () use ($lineaTarifa, $userId) {
            $anterior = $lineaTarifa->toArray();
            $lineaTarifa->update([
                'aprobado_por'     => $userId,
                'fecha_aprobacion' => now(),
            ]);

            LiqAuditoriaTarifa::query()->create([
                'linea_tarifa_id'   => $lineaTarifa->id,
                'accion'            => 'aprobacion',
                'valores_anteriores'=> $anterior,
                'valores_nuevos'    => $lineaTarifa->fresh()?->toArray(),
                'usuario_id'        => $userId,
            ]);
        });

        $lineaTarifa->load(['creadoPor:id,name', 'aprobadoPor:id,name']);

        return response()->json(['data' => [
            ...$lineaTarifa->attributesToArray(),
            'creado_por_nombre'  => $lineaTarifa->creadoPor?->name,
            'aprobado_por_nombre'=> $lineaTarifa->aprobadoPor?->name,
        ]]);
    }

    public function desactivarLinea(Request $request, LiqLineaTarifa $lineaTarifa): JsonResponse
    {
        $this->authorize($request);

        DB::transaction(function () use ($lineaTarifa, $request) {
            $anterior = $lineaTarifa->toArray();
            $lineaTarifa->update(['activo' => false]);

            LiqAuditoriaTarifa::query()->create([
                'linea_tarifa_id'   => $lineaTarifa->id,
                'accion'            => 'desactivacion',
                'valores_anteriores'=> $anterior,
                'usuario_id'        => $request->user()?->id,
                'motivo'            => ($m = trim((string) $request->input('motivo', ''))) !== '' ? $m : null,
            ]);
        });

        return response()->json(['data' => $lineaTarifa]);
    }

    public function desactivarMapeoConcepto(Request $request, int $id): JsonResponse
    {
        $this->authorize($request);

        \App\Models\LiqMapeoConcepto::query()->findOrFail($id)->update(['activo' => false]);

        return response()->json(['data' => ['id' => $id, 'activo' => false]]);
    }

    public function desactivarMapeoSucursal(Request $request, int $id): JsonResponse
    {
        $this->authorize($request);

        \App\Models\LiqMapeoSucursal::query()->findOrFail($id)->update(['activo' => false]);

        return response()->json(['data' => ['id' => $id, 'activo' => false]]);
    }

    private function authorize(Request $request): void
    {
        $user  = $request->user();
        $role  = strtolower(trim((string) ($user?->role ?? '')));
        $perms = is_array($user?->permissions) ? $user->permissions : [];

        $allowed = in_array($role, ['admin', 'admin2', 'encargado'], true)
            || in_array('liquidaciones', $perms, true);

        if (! $allowed) {
            abort(response()->json(['message' => 'Sin permisos para liquidaciones.'], 403));
        }
    }

    private function canSelfApprove(Request $request): bool
    {
        $user  = $request->user();
        $role  = strtolower(trim((string) ($user?->role ?? '')));
        $perms = is_array($user?->permissions) ? $user->permissions : [];

        return in_array($role, ['admin', 'admin2'], true)
            || in_array('liquidaciones_aprobar_own', $perms, true);
    }
}

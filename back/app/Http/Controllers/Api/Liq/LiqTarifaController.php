<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqDimensionValor;
use App\Models\LiqLineaTarifa;
use App\Models\LiqAuditoriaTarifa;
use App\Models\LiqOperacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class LiqTarifaController extends Controller
{
    // PUT /liq/esquemas/{esquema}/activar - activar un esquema (desactiva el resto del cliente)
    public function activarEsquema(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        DB::beginTransaction();
        try {
            LiqEsquemaTarifario::where('cliente_id', $esquema->cliente_id)
                ->where('id', '!=', $esquema->id)
                ->where('activo', true)
                ->update(['activo' => false]);

            $esquema->update(['activo' => true]);
            DB::commit();

            return response()->json(['data' => $esquema, 'message' => 'Esquema activado']);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'No se pudo activar el esquema: ' . $e->getMessage()], 500);
        }
    }

    // PUT /liq/esquemas/{esquema}/desactivar - desactivar (borrado lógico)
    public function desactivarEsquema(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $esquema->update(['activo' => false]);
        return response()->json(['data' => $esquema, 'message' => 'Esquema desactivado']);
    }

    // DELETE /liq/esquemas/{esquema} - borrado físico (solo si no está en uso)
    public function destroyEsquema(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (! in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['message' => 'No tenés permisos para eliminar esquemas.'], 403);
        }
        if ($esquema->activo) {
            return response()->json(['error' => 'No se puede eliminar un esquema activo. Desactiválo primero.'], 422);
        }

        $enUso = LiqOperacion::whereHas('lineaTarifa', function ($q) use ($esquema) {
            $q->where('esquema_id', $esquema->id);
        })->exists();
        if ($enUso) {
            return response()->json(['error' => 'No se puede eliminar: el esquema está usado en operaciones históricas.'], 422);
        }

        try {
            $esquema->delete();
            return response()->json(['message' => 'Esquema eliminado']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'No se pudo eliminar el esquema: ' . $e->getMessage()], 500);
        }
    }

    // GET /liq/esquemas/{esquema}/dimensiones
    public function dimensiones(LiqEsquemaTarifario $esquema): JsonResponse
    {
        $dimensiones = LiqDimensionValor::where('esquema_id', $esquema->id)
            ->orderBy('nombre_dimension')
            ->orderBy('orden_display')
            ->get();
        // Group by nombre_dimension
        $grouped = $dimensiones->groupBy('nombre_dimension')->map(fn($items) => $items->values());
        return response()->json(['data' => $grouped]);
    }

    // POST /liq/esquemas/{esquema}/dimensiones - add dimension value
    public function storeDimension(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $data = $request->validate([
            'nombre_dimension' => 'required|string|max:80|in:' . implode(',', $esquema->dimensiones ?? []),
            'valor' => 'required|string|max:150',
            'orden_display' => 'integer|min:0',
        ]);
        // Check if dimension name is valid for this scheme
        $existing = LiqDimensionValor::where('esquema_id', $esquema->id)
            ->where('nombre_dimension', $data['nombre_dimension'])
            ->where('valor', $data['valor'])
            ->first();
        if ($existing) {
            if (!$existing->activo) {
                $existing->update(['activo' => true, 'orden_display' => $data['orden_display'] ?? $existing->orden_display]);
                return response()->json(['data' => $existing, 'message' => 'Valor reactivado']);
            }
            return response()->json(['error' => 'Este valor ya existe para esta dimensión'], 422);
        }
        $dimension = LiqDimensionValor::create([
            'esquema_id' => $esquema->id,
            'nombre_dimension' => $data['nombre_dimension'],
            'valor' => $data['valor'],
            'orden_display' => $data['orden_display'] ?? 0,
            'activo' => true,
        ]);
        return response()->json(['data' => $dimension, 'message' => 'Valor de dimensión creado'], 201);
    }

    // PUT /liq/dimension-valores/{dimensionValor}/desactivar
    public function desactivarDimension(Request $request, LiqDimensionValor $dimensionValor): JsonResponse
    {
        $dimensionValor->update(['activo' => false]);
        return response()->json(['message' => 'Valor desactivado']);
    }

    // GET /liq/esquemas/{esquema}/lineas
    public function lineas(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $query = LiqLineaTarifa::where('esquema_id', $esquema->id)
            ->with(['creadoPor:id,name,email', 'aprobadoPor:id,name,email'])
            ->orderBy('activo', 'desc')
            ->orderBy('vigencia_desde', 'desc');
        if ($request->boolean('solo_activas')) {
            $query->where('activo', true);
        }
        $lineas = $query->get();
        return response()->json(['data' => $lineas]);
    }

    // POST /liq/esquemas/{esquema}/lineas - create tariff line
    public function storeLinea(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $data = $request->validate([
            'dimensiones_valores' => 'required|array',
            'precio_original' => 'required|numeric|min:0.01',
            'porcentaje_agencia' => 'required|numeric|min:0|max:99.99',
            'vigencia_desde' => 'required|date',
            'vigencia_hasta' => 'nullable|date|after_or_equal:vigencia_desde',
            'motivo' => 'required|string|min:3',
        ]);

        $dimensionesRequeridas = $esquema->dimensiones ?? [];
        $dimensionesValores = $this->filtrarYValidarDimensionesValores($esquema, $data['dimensiones_valores']);
        if (isset($dimensionesValores['error'])) {
            return response()->json(['error' => $dimensionesValores['error']], 422);
        }

        // No permitir solapamiento con otra línea activa NO aprobada (borrador)
        $solapadasNoAprobadas = $this->queryLineasPorDimensiones($esquema->id, $dimensionesValores)
            ->where('activo', true)
            ->whereNull('aprobado_por')
            ->where($this->vigenciaSolapaCallback($data['vigencia_desde'], $data['vigencia_hasta'] ?? null))
            ->count();
        if ($solapadasNoAprobadas > 0) {
            return response()->json(['error' => 'Ya existe una línea en borrador con las mismas dimensiones y vigencia superpuesta'], 422);
        }

        // Evitar crear una versión con vigencia_desde anterior/igual a la última aprobada (misma combinación)
        $ultimaAprobada = $this->queryLineasPorDimensiones($esquema->id, $dimensionesValores)
            ->where('activo', true)
            ->whereNotNull('aprobado_por')
            ->orderByDesc('vigencia_desde')
            ->first();
        if ($ultimaAprobada && Carbon::parse($data['vigencia_desde'])->lessThanOrEqualTo($ultimaAprobada->vigencia_desde)) {
            return response()->json(['error' => 'La vigencia_desde debe ser posterior a la última línea aprobada para estas dimensiones'], 422);
        }

        $precioDistribuidor = round($data['precio_original'] * (1 - $data['porcentaje_agencia'] / 100), 2);

        $linea = LiqLineaTarifa::create([
            'esquema_id' => $esquema->id,
            'dimensiones_valores' => $dimensionesValores,
            'precio_original' => $data['precio_original'],
            'porcentaje_agencia' => $data['porcentaje_agencia'],
            'precio_distribuidor' => $precioDistribuidor,
            'vigencia_desde' => $data['vigencia_desde'],
            'vigencia_hasta' => $data['vigencia_hasta'] ?? null,
            'creado_por' => $request->user()?->id,
            'activo' => true,
        ]);

        // Audit
        LiqAuditoriaTarifa::create([
            'linea_tarifa_id' => $linea->id,
            'accion' => 'creacion',
            'valores_anteriores' => null,
            'valores_nuevos' => $linea->toArray(),
            'usuario_id' => $request->user()?->id,
            'motivo' => $data['motivo'],
            'created_at' => now(),
        ]);

        return response()->json(['data' => $linea, 'message' => 'Línea de tarifa creada'], 201);
    }

    // PUT /liq/lineas/{lineaTarifa}/aprobar
    public function aprobarLinea(Request $request, LiqLineaTarifa $lineaTarifa): JsonResponse
    {
        $data = $request->validate([
            'motivo' => 'required|string|min:3',
        ]);

        $user = $request->user();
        $userId = $user?->id;
        if (!$userId) {
            return response()->json(['error' => 'Usuario no autenticado'], 401);
        }
        $role = strtolower(trim((string) ($user?->role ?? '')));
        $puedeAutoAprobar = in_array($role, ['admin', 'admin2'], true);

        return DB::transaction(function () use ($lineaTarifa, $userId, $data, $puedeAutoAprobar) {
            /** @var LiqLineaTarifa $linea */
            $linea = LiqLineaTarifa::whereKey($lineaTarifa->id)->lockForUpdate()->firstOrFail();

            if (!$linea->activo) {
                return response()->json(['error' => 'No se puede aprobar una línea inactiva'], 422);
            }
            if ($linea->aprobado_por) {
                return response()->json(['error' => 'Esta línea ya fue aprobada'], 422);
            }
            if ($linea->creado_por && (int) $linea->creado_por === (int) $userId && !$puedeAutoAprobar) {
                return response()->json(['error' => 'La aprobación requiere un segundo usuario (salvo Admin/Admin 2)'], 422);
            }

            $dimensiones = $linea->dimensiones_valores ?? [];
            $desde = $linea->vigencia_desde?->toDateString();
            $hasta = $linea->vigencia_hasta?->toDateString();
            if (!$desde) {
                return response()->json(['error' => 'La línea no tiene vigencia_desde válida'], 422);
            }

            // Cerrar automáticamente líneas aprobadas previas que solapan vigencia para la misma combinación
            $otras = $this->queryLineasPorDimensiones($linea->esquema_id, $dimensiones)
                ->where('activo', true)
                ->whereNotNull('aprobado_por')
                ->where('id', '!=', $linea->id)
                ->where($this->vigenciaSolapaCallback($desde, $hasta))
                ->lockForUpdate()
                ->get();

            $cierreHasta = Carbon::parse($desde)->subDay()->toDateString();
            foreach ($otras as $otra) {
                // Si la línea anterior empieza después o igual al inicio de la nueva, no podemos cerrarla sin dejar rango inválido.
                if (Carbon::parse($otra->vigencia_desde)->greaterThanOrEqualTo(Carbon::parse($desde))) {
                    return response()->json(['error' => 'Existe una línea aprobada con vigencia_desde >= a la nueva. Revise el historial antes de aprobar.'], 422);
                }
                if (Carbon::parse($cierreHasta)->lessThan(Carbon::parse($otra->vigencia_desde))) {
                    return response()->json(['error' => 'No se puede cerrar la línea anterior: el cierre quedaría antes de su vigencia_desde'], 422);
                }

                $anterior = $otra->toArray();
                $otra->update([
                    'vigencia_hasta' => $cierreHasta,
                ]);

                LiqAuditoriaTarifa::create([
                    'linea_tarifa_id' => $otra->id,
                    'accion' => 'modificacion',
                    'valores_anteriores' => $anterior,
                    'valores_nuevos' => ['vigencia_hasta' => $cierreHasta],
                    'usuario_id' => $userId,
                    'motivo' => $data['motivo'],
                    'created_at' => now(),
                ]);
            }

            $linea->update([
                'aprobado_por' => $userId,
                'fecha_aprobacion' => now(),
            ]);

            LiqAuditoriaTarifa::create([
                'linea_tarifa_id' => $linea->id,
                'accion' => 'aprobacion',
                'valores_anteriores' => null,
                'valores_nuevos' => ['aprobado_por' => $userId, 'fecha_aprobacion' => now()->toIso8601String()],
                'usuario_id' => $userId,
                'motivo' => $data['motivo'],
                'created_at' => now(),
            ]);

            return response()->json(['data' => $linea->fresh(), 'message' => 'Línea aprobada']);
        });
    }

    // PUT /liq/lineas/{lineaTarifa}/desactivar
    public function desactivarLinea(Request $request, LiqLineaTarifa $lineaTarifa): JsonResponse
    {
        $data = $request->validate([
            'motivo' => 'required|string|min:3',
        ]);
        $anterior = $lineaTarifa->toArray();
        $lineaTarifa->update(['activo' => false]);
        LiqAuditoriaTarifa::create([
            'linea_tarifa_id' => $lineaTarifa->id,
            'accion' => 'desactivacion',
            'valores_anteriores' => $anterior,
            'valores_nuevos' => ['activo' => false],
            'usuario_id' => $request->user()?->id,
            'motivo' => $data['motivo'],
            'created_at' => now(),
        ]);
        return response()->json(['message' => 'Línea desactivada']);
    }

    // PUT /liq/mapeos-concepto/{id}/desactivar (delegated from LiqClienteController)
    public function desactivarMapeoConcepto(int $id): JsonResponse
    {
        \App\Models\LiqMapeoConcepto::findOrFail($id)->update(['activo' => false]);
        return response()->json(['message' => 'Mapeo desactivado']);
    }

    // PUT /liq/mapeos-sucursal/{id}/desactivar
    public function desactivarMapeoSucursal(int $id): JsonResponse
    {
        \App\Models\LiqMapeoSucursal::findOrFail($id)->update(['activo' => false]);
        return response()->json(['message' => 'Mapeo desactivado']);
    }

    private function filtrarYValidarDimensionesValores(LiqEsquemaTarifario $esquema, array $dimensionesValores): array
    {
        $dimensionesRequeridas = $esquema->dimensiones ?? [];

        $keysExtra = array_diff(array_keys($dimensionesValores), $dimensionesRequeridas);
        if (count($keysExtra) > 0) {
            return ['error' => 'Dimensiones inválidas para el esquema: ' . implode(', ', $keysExtra)];
        }

        $filtered = [];
        foreach ($dimensionesRequeridas as $dim) {
            $valor = $dimensionesValores[$dim] ?? null;
            $valor = is_string($valor) ? trim($valor) : $valor;

            if ($valor === null || $valor === '') {
                return ['error' => "Falta la dimensión: {$dim}"];
            }
            $filtered[$dim] = $valor;
        }

        // Si la dimensión tiene valores cargados, validar contra esos valores activos para evitar typos.
        foreach ($filtered as $dim => $valor) {
            $tieneCatalogo = LiqDimensionValor::where('esquema_id', $esquema->id)->where('nombre_dimension', $dim)->exists();
            if ($tieneCatalogo) {
                $existe = LiqDimensionValor::where('esquema_id', $esquema->id)
                    ->where('nombre_dimension', $dim)
                    ->where('valor', $valor)
                    ->where('activo', true)
                    ->exists();
                if (!$existe) {
                    return ['error' => "El valor '{$valor}' no existe o está inactivo para la dimensión '{$dim}'"];
                }
            }
        }

        return $filtered;
    }

    private function queryLineasPorDimensiones(int $esquemaId, array $dimensionesValores)
    {
        $q = LiqLineaTarifa::where('esquema_id', $esquemaId);
        foreach ($dimensionesValores as $dim => $valor) {
            $q->where("dimensiones_valores->{$dim}", $valor);
        }
        return $q;
    }

    private function vigenciaSolapaCallback(string $desde, ?string $hasta): \Closure
    {
        return function ($q) use ($desde, $hasta) {
            $hasta = $hasta ?? '9999-12-31';
            $q->where('vigencia_desde', '<=', $hasta)
              ->where(function ($sub) use ($desde) {
                  $sub->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $desde);
              });
        };
    }
}

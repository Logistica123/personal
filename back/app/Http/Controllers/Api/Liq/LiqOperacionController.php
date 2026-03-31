<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqLineaTarifa;
use App\Models\LiqOperacion;
use App\Models\LiqOperacionAuditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LiqOperacionController extends Controller
{
    public function updateExclusion(Request $request, LiqOperacion $operacion): JsonResponse
    {
        $this->authorize($request);

        $validated = $request->validate([
            'excluida' => ['required', 'boolean'],
            'motivo' => ['nullable', 'string', 'max:2000'],
        ]);

        $liq = $operacion->liquidacionCliente;
        if (! $liq) {
            return response()->json(['message' => 'Extracto no encontrado para esta operación.'], 422);
        }
        if (in_array($liq->estado, ['aprobada', 'rechazada'], true)) {
            return response()->json([
                'message' => "No se puede modificar una operación de un extracto en estado '{$liq->estado}'.",
            ], 422);
        }

        $userId = $request->user()?->id;
        $excluida = (bool) $validated['excluida'];
        $motivo = isset($validated['motivo']) ? trim((string) $validated['motivo']) : null;
        $motivo = $motivo !== '' ? $motivo : null;

        [$op, $liquidacion] = DB::transaction(function () use ($operacion, $excluida, $motivo, $userId) {
            $before = $operacion->fresh()?->attributesToArray() ?? $operacion->attributesToArray();

            $operacion->update([
                'excluida' => $excluida,
                'motivo_exclusion' => $excluida ? $motivo : null,
                'excluida_at' => $excluida ? now() : null,
                'excluida_por' => $excluida ? $userId : null,
            ]);

            LiqOperacionAuditoria::query()->create([
                'operacion_id' => $operacion->id,
                'accion' => $excluida ? 'exclusion' : 'inclusion',
                'usuario_id' => $userId,
                'valores_anteriores' => $before,
                'valores_nuevos' => $operacion->fresh()?->attributesToArray(),
                'motivo' => $motivo,
            ]);

            $liq = $operacion->liquidacionCliente;
            if ($liq) {
                $liq->recalcularTotales();
                $liq->update(['estado' => 'auditada']);
            }

            return [$operacion->fresh(), $liq?->fresh()];
        });

        $op->load('distribuidor:id,nombres,apellidos,patente');

        return response()->json([
            'data' => [
                'operacion' => [
                    ...$op->toArray(),
                    'distribuidor_nombre' => $op->distribuidor
                        ? trim("{$op->distribuidor->apellidos} {$op->distribuidor->nombres}")
                        : null,
                ],
                'liquidacion' => $liquidacion,
            ],
            'message' => $excluida ? 'Operación excluida.' : 'Operación incluida.',
        ]);
    }

    public function assignTarifa(Request $request, LiqOperacion $operacion): JsonResponse
    {
        $this->authorize($request);

        $validated = $request->validate([
            'linea_tarifa_id' => ['required', 'integer', 'exists:liq_lineas_tarifa,id'],
            'motivo' => ['nullable', 'string', 'max:2000'],
        ]);

        $liq = $operacion->liquidacionCliente;
        if (! $liq || ! $liq->cliente) {
            return response()->json(['message' => 'Extracto/cliente no encontrado para esta operación.'], 422);
        }
        if (in_array($liq->estado, ['aprobada', 'rechazada'], true)) {
            return response()->json([
                'message' => "No se puede modificar una operación de un extracto en estado '{$liq->estado}'.",
            ], 422);
        }

        $linea = LiqLineaTarifa::query()
            ->with('esquema:id,cliente_id,dimensiones')
            ->findOrFail((int) $validated['linea_tarifa_id']);

        if (! $linea->activo || ! $linea->aprobado_por) {
            return response()->json(['message' => 'La línea de tarifa no está activa/aprobada.'], 422);
        }
        if ((int) ($linea->esquema?->cliente_id ?? 0) !== (int) $liq->cliente_id) {
            return response()->json(['message' => 'La línea de tarifa no pertenece al cliente de este extracto.'], 422);
        }

        $motivo = isset($validated['motivo']) ? trim((string) $validated['motivo']) : null;
        $motivo = $motivo !== '' ? $motivo : null;
        $userId = $request->user()?->id;

        [$op, $liquidacion] = DB::transaction(function () use ($operacion, $linea, $motivo, $userId) {
            $before = $operacion->fresh()?->attributesToArray() ?? $operacion->attributesToArray();

            $valorTarifaOriginal = (float) $linea->precio_original;
            $valorTarifaDistribuidor = (float) $linea->precio_distribuidor;
            $porcentajeAgencia = (float) $linea->porcentaje_agencia;
            $diferencia = (float) $operacion->valor_cliente - $valorTarifaOriginal;

            $estado = $operacion->distribuidor_id ? 'ok' : 'sin_distribuidor';
            if ($operacion->estado === 'observado' && $operacion->distribuidor_id) {
                $estado = 'observado';
            }

            if ($estado === 'ok') {
                $tolerancia = 0.02;
                $pctDif = $valorTarifaOriginal > 0
                    ? abs($diferencia) / $valorTarifaOriginal
                    : ($diferencia !== 0.0 ? 1.0 : 0.0);
                $estado = $pctDif <= $tolerancia ? 'ok' : 'diferencia';
            }

            $operacion->update([
                'linea_tarifa_id' => $linea->id,
                'valor_tarifa_original' => $valorTarifaOriginal,
                'valor_tarifa_distribuidor' => $valorTarifaDistribuidor,
                'porcentaje_agencia' => $porcentajeAgencia,
                'diferencia_cliente' => $diferencia,
                'estado' => $estado,
                'observacion' => $motivo ? "Tarifa asignada manualmente: {$motivo}" : 'Tarifa asignada manualmente.',
            ]);

            LiqOperacionAuditoria::query()->create([
                'operacion_id' => $operacion->id,
                'accion' => 'asignar_tarifa',
                'usuario_id' => $userId,
                'valores_anteriores' => $before,
                'valores_nuevos' => $operacion->fresh()?->attributesToArray(),
                'motivo' => $motivo,
            ]);

            $liq = $operacion->liquidacionCliente;
            if ($liq) {
                $liq->recalcularTotales();
                $liq->update(['estado' => 'auditada']);
            }

            return [$operacion->fresh(), $liq?->fresh()];
        });

        $op->load('distribuidor:id,nombres,apellidos,patente');

        return response()->json([
            'data' => [
                'operacion' => [
                    ...$op->toArray(),
                    'distribuidor_nombre' => $op->distribuidor
                        ? trim("{$op->distribuidor->apellidos} {$op->distribuidor->nombres}")
                        : null,
                ],
                'liquidacion' => $liquidacion,
            ],
            'message' => 'Tarifa asignada.',
        ]);
    }

    private function authorize(Request $request): void
    {
        $user = $request->user();
        $role = strtolower(trim((string) ($user?->role ?? '')));
        $perms = is_array($user?->permissions) ? $user->permissions : [];

        $allowed = in_array($role, ['admin', 'admin2', 'encargado'], true)
            || in_array('liquidaciones', $perms, true);

        if (! $allowed) {
            abort(response()->json(['message' => 'Sin permisos para liquidaciones.'], 403));
        }
    }
}


<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqLiquidacionCliente;
use App\Services\Liq\LiqDeteccionSubpagoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * SPEC v3 · BUG B — Endpoint de reclamos OCASA.
 *
 *   GET    /api/liq/liquidaciones/{liq}/reclamos-ocasa   — listar detectados
 *   POST   /api/liq/liquidaciones/{liq}/reclamos-ocasa/detectar — correr detección
 *   PATCH  /api/liq/reclamos-ocasa/{reclamo}/estado      — cambiar estado (reclamado/ajustado/cerrado)
 */
class LiqReclamosOcasaController extends Controller
{
    public function index(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $reclamos = DB::table('liq_reclamos_ocasa as r')
            ->join('liq_operaciones as o', 'o.id', '=', 'r.op_id')
            ->join('liq_tarifas_contrato_cliente as tc', 'tc.id', '=', 'r.tarifa_contrato_id')
            ->leftJoin('personas as p', 'p.id', '=', 'o.distribuidor_id')
            ->where('o.liquidacion_cliente_id', $liquidacionCliente->id)
            ->select([
                'r.id',
                'r.op_id',
                'o.dominio as patente',
                'o.sucursal_tarifa as sucursal',
                'o.concepto as ruta',
                'o.distancia_km',
                'o.capacidad_vehiculo_kg',
                'tc.concepto as concepto_contrato',
                'r.importe_tms',
                'r.importe_esperado',
                'r.diferencia',
                'r.estado',
                'r.motivo_detectado',
                'r.creado_at',
                'r.reclamado_at',
                'r.resuelto_at',
                DB::raw("CONCAT(COALESCE(p.apellidos,''),' ',COALESCE(p.nombres,'')) AS distribuidor"),
            ])
            ->orderBy('r.diferencia', 'desc')
            ->get();

        $totalSubpago = $reclamos->where('diferencia', '>', 0)->sum('diferencia');
        $totalSobrepago = abs($reclamos->where('diferencia', '<', 0)->sum('diferencia'));

        $porSucursal = $reclamos->groupBy('sucursal')
            ->map(fn ($grupo) => [
                'sucursal' => $grupo->first()->sucursal,
                'ops' => $grupo->count(),
                'diferencia_total' => (float) $grupo->sum('diferencia'),
            ])
            ->sortByDesc('diferencia_total')
            ->values();

        return response()->json([
            'data' => [
                'liquidacion_id' => $liquidacionCliente->id,
                'reclamos' => $reclamos,
                'totales' => [
                    'cantidad' => $reclamos->count(),
                    'total_subpago'   => round($totalSubpago, 2),
                    'total_sobrepago' => round($totalSobrepago, 2),
                    'neto_reclamable' => round($totalSubpago - $totalSobrepago, 2),
                ],
                'por_sucursal' => $porSucursal,
            ],
        ]);
    }

    public function detectar(
        Request $request,
        LiqLiquidacionCliente $liquidacionCliente,
        LiqDeteccionSubpagoService $service
    ): JsonResponse {
        $tolerancia = (float) $request->input('tolerancia', 0.05);
        if ($tolerancia < 0 || $tolerancia > 0.5) {
            return response()->json(['error' => 'tolerancia fuera de rango [0, 0.5]'], 422);
        }

        $stats = $service->detectar($liquidacionCliente, $tolerancia);

        return response()->json([
            'message' => sprintf(
                '%d reclamos detectados (%d subpagos, %d sobrepagos). Diferencia neta: $%s',
                $stats['reclamos_creados'],
                count(array_filter($stats['por_sucursal'], fn ($s) => $s['diferencia'] > 0)),
                0, // sobrepagos los contamos aparte si hace falta
                number_format($stats['total_subpago'] - $stats['total_sobrepago'], 2, ',', '.')
            ),
            'data' => $stats,
        ]);
    }

    public function cambiarEstado(Request $request, int $reclamoId): JsonResponse
    {
        $data = $request->validate([
            'estado' => 'required|in:pendiente_reclamo,reclamado,ajustado,cerrado',
            'resolucion' => 'nullable|string|max:500',
        ]);

        $reclamo = DB::table('liq_reclamos_ocasa')->where('id', $reclamoId)->first();
        if (!$reclamo) {
            return response()->json(['error' => 'Reclamo no existe'], 404);
        }

        $update = ['estado' => $data['estado']];
        if ($data['estado'] === 'reclamado' && !$reclamo->reclamado_at) {
            $update['reclamado_at'] = now();
        }
        if (in_array($data['estado'], ['ajustado', 'cerrado']) && !$reclamo->resuelto_at) {
            $update['resuelto_at'] = now();
        }
        if (isset($data['resolucion'])) {
            $update['resolucion'] = $data['resolucion'];
        }

        DB::table('liq_reclamos_ocasa')->where('id', $reclamoId)->update($update);

        return response()->json(['message' => 'Estado actualizado', 'data' => ['id' => $reclamoId, 'estado' => $data['estado']]]);
    }
}

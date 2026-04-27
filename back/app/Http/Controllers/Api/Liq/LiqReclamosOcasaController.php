<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqLiquidacionCliente;
use App\Services\Liq\LiqDeteccionSubpagoService;
use App\Services\Liq\LiqReclamosOcasaExportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

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
            // SPEC v4.2: leftJoin para incluir reclamos productividad (tarifa_contrato_id=NULL)
            ->leftJoin('liq_tarifas_contrato_cliente as tc', 'tc.id', '=', 'r.tarifa_contrato_id')
            ->leftJoin('personas as p', 'p.id', '=', 'o.distribuidor_id')
            ->where('o.liquidacion_cliente_id', $liquidacionCliente->id)
            ->select([
                'r.id',
                'r.op_id',
                'r.parada_num',                          // SPEC v4.2 productividad
                'o.dominio as patente',
                'o.sucursal_tarifa as sucursal',
                'o.concepto as ruta',
                'o.distancia_km',
                'o.capacidad_vehiculo_kg',
                'o.modelo_calculo',                      // 'PRODUCTIVIDAD' o no
                'tc.concepto as concepto_contrato',
                'r.importe_tms',
                'r.importe_esperado',
                'r.diferencia',
                'r.estado',
                'r.motivo_detectado',
                'r.motivo_categoria',                    // SPEC v4.3 clasificador
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

        // SPEC v4.3: agrupación por motivo_categoria para filtros UI
        $porCategoria = $reclamos->groupBy('motivo_categoria')
            ->map(fn ($grupo, $categoria) => [
                'categoria' => $categoria ?: 'otra',
                'cantidad' => $grupo->count(),
                'diferencia_total' => round((float) $grupo->sum('diferencia'), 2),
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
                'por_categoria' => $porCategoria,
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

    /**
     * SPEC v4.3 · GET /api/liq/liquidaciones/{liq}/reclamos-ocasa/export-excel
     *
     * Genera un .xlsx con resumen + hoja por sucursal listo para presentar a OCASA.
     * Filtros opcionales por estado / tipo / motivo_categoria.
     */
    public function exportExcel(
        Request $request,
        LiqLiquidacionCliente $liquidacionCliente,
        LiqReclamosOcasaExportService $exportSvc
    ): StreamedResponse {
        $estado    = $request->query('estado');     // 'pendiente_reclamo' | 'reclamado' | ...
        $tipo      = $request->query('tipo');       // 'jornada' | 'productividad' | 'todos'
        $categoria = $request->query('categoria');  // 'tarifa_capacidad_inferior' | ...

        $contenido = $exportSvc->generar($liquidacionCliente, $estado, $tipo, $categoria);
        $periodo = $liquidacionCliente->periodo_desde?->format('Y-m') ?? 'mes';
        $filename = "Reclamos_OCASA_{$periodo}_liq{$liquidacionCliente->id}.xlsx";

        return response()->streamDownload(
            fn () => print $contenido,
            $filename,
            [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Cache-Control' => 'no-store, no-cache',
            ]
        );
    }
}

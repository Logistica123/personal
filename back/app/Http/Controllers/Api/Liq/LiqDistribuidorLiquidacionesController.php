<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\Archivo;
use App\Models\LiqHistorialAuditoria;
use App\Models\LiqLiquidacionDistribuidor;
use App\Models\Persona;
use App\Support\Liq\LiqV2DocumentoHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LiqDistribuidorLiquidacionesController extends Controller
{
    // GET /liq/distribuidores/{persona}/liquidaciones - lista liquidaciones generadas (v2) para un proveedor
    public function index(Request $request, Persona $persona): JsonResponse
    {
        $items = LiqLiquidacionDistribuidor::where('distribuidor_id', $persona->id)
            ->with([
                'liquidacionCliente:id,cliente_id,periodo_desde,periodo_hasta,estado',
                'liquidacionCliente.cliente:id,nombre_corto,razon_social',
            ])
            ->orderByDesc('periodo_desde')
            ->orderByDesc('id')
            ->get();

        $disk = LiqV2DocumentoHelper::disk();
        $paths = $items
            ->flatMap(function (LiqLiquidacionDistribuidor $item) use ($persona) {
                return [
                    LiqV2DocumentoHelper::buildStoredPath((int) $persona->id, $item),
                    LiqV2DocumentoHelper::buildLegacyTxtStoredPath((int) $persona->id, $item),
                ];
            })
            ->unique()
            ->values();

        $documentosByPath = Archivo::query()
            ->where('persona_id', (int) $persona->id)
            ->where('disk', $disk)
            ->whereIn('ruta', $paths->all())
            ->get(['id', 'ruta'])
            ->keyBy('ruta');

        $data = $items->map(function (LiqLiquidacionDistribuidor $item) use ($documentosByPath, $persona) {
            $pdfPath = LiqV2DocumentoHelper::buildStoredPath((int) $persona->id, $item);
            $legacyTxtPath = LiqV2DocumentoHelper::buildLegacyTxtStoredPath((int) $persona->id, $item);
            $doc = $documentosByPath->get($pdfPath) ?: $documentosByPath->get($legacyTxtPath);
            $docPath = $doc ? (string) $doc->ruta : $pdfPath;
            $isPdf = str_ends_with(strtolower($docPath), '.pdf');

            $payload = $item->toArray();
            $payload['documento_id'] = $doc ? (int) $doc->id : null;
            $payload['documento_preparado'] = (bool) $doc;
            $payload['documento_ruta'] = $docPath;
            $payload['documento_es_pdf'] = $doc ? $isPdf : false;

            return $payload;
        })->values();

        return response()->json(['data' => $data]);
    }

    /**
     * PUT /liq/liquidaciones-distribuidor/{liquidacionDistribuidor}/editar
     *
     * Edita importe, estado u observaciones de una liquidacion de distribuidor.
     * Registra auditoria con valores anteriores/nuevos y motivo obligatorio.
     */
    public function editar(Request $request, LiqLiquidacionDistribuidor $liquidacionDistribuidor): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (!in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['error' => 'No tenes permisos para editar liquidaciones.'], 403);
        }

        if ($liquidacionDistribuidor->estado === LiqLiquidacionDistribuidor::ESTADO_PAGADA) {
            return response()->json(['error' => 'Esta liquidacion ya fue pagada y no puede modificarse.'], 422);
        }

        $data = $request->validate([
            'total_a_pagar' => 'nullable|numeric|min:0',
            'subtotal' => 'nullable|numeric|min:0',
            'estado' => 'nullable|string|in:generada,aprobada,pagada,anulada',
            'observaciones' => 'nullable|string|max:1000',
            'motivo' => 'required|string|min:5|max:1000',
        ]);

        $anteriores = [];
        $nuevos = [];
        $cambios = false;

        // Edicion de importe
        if (isset($data['total_a_pagar']) && (float) $data['total_a_pagar'] !== (float) $liquidacionDistribuidor->total_a_pagar) {
            $anteriores['total_a_pagar'] = (float) $liquidacionDistribuidor->total_a_pagar;
            $nuevos['total_a_pagar'] = (float) $data['total_a_pagar'];
            $liquidacionDistribuidor->total_a_pagar = $data['total_a_pagar'];
            $cambios = true;
        }

        if (isset($data['subtotal']) && (float) $data['subtotal'] !== (float) $liquidacionDistribuidor->subtotal) {
            $anteriores['subtotal'] = (float) $liquidacionDistribuidor->subtotal;
            $nuevos['subtotal'] = (float) $data['subtotal'];
            $liquidacionDistribuidor->subtotal = $data['subtotal'];
            $cambios = true;
        }

        // Edicion de estado
        if (isset($data['estado']) && $data['estado'] !== $liquidacionDistribuidor->estado) {
            $anteriores['estado'] = $liquidacionDistribuidor->estado;
            $nuevos['estado'] = $data['estado'];
            $liquidacionDistribuidor->estado = $data['estado'];
            $cambios = true;
        }

        if (!$cambios) {
            return response()->json(['error' => 'No se detectaron cambios.'], 422);
        }

        $liquidacionDistribuidor->save();

        // Determinar accion de auditoria
        $accion = isset($nuevos['total_a_pagar']) || isset($nuevos['subtotal'])
            ? 'edicion_importe'
            : 'edicion_estado';

        LiqHistorialAuditoria::registrar(
            'liquidacion_distribuidor',
            $liquidacionDistribuidor->id,
            $accion,
            $anteriores,
            $nuevos,
            $data['motivo'],
            $request->user(),
            $request->ip()
        );

        return response()->json([
            'data' => $liquidacionDistribuidor->fresh(),
            'message' => 'Liquidacion actualizada correctamente',
        ]);
    }

    /**
     * GET /liq/liquidaciones-distribuidor/{liquidacionDistribuidor}/historial
     *
     * Historial de auditoria de una liquidacion distribuidor especifica.
     */
    public function historial(LiqLiquidacionDistribuidor $liquidacionDistribuidor): JsonResponse
    {
        $historial = LiqHistorialAuditoria::where('entidad_tipo', 'liquidacion_distribuidor')
            ->where('entidad_id', $liquidacionDistribuidor->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json(['data' => $historial]);
    }

    /**
     * GET /liq/distribuidores/{persona}/historial-auditoria
     *
     * Historial completo de todas las liquidaciones de un distribuidor.
     */
    public function historialDistribuidor(Persona $persona): JsonResponse
    {
        $liqIds = LiqLiquidacionDistribuidor::where('distribuidor_id', $persona->id)
            ->pluck('id');

        $historial = LiqHistorialAuditoria::where('entidad_tipo', 'liquidacion_distribuidor')
            ->whereIn('entidad_id', $liqIds)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        return response()->json(['data' => $historial]);
    }
}

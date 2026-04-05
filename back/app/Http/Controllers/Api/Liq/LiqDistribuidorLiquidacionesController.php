<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\Archivo;
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
}

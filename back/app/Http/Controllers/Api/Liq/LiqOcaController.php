<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqArchivoEntrada;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqVinculacionOca;
use App\Services\Oca\OcaClient;
use App\Services\Oca\OcaIngestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class LiqOcaController extends Controller
{
    public function __construct(
        private readonly OcaIngestService $ocaIngestService,
        private readonly OcaClient $ocaClient,
    ) {}

    /**
     * POST /liq/oca/upload - Sube y procesa PDFs OCA.
     *
     * Recibe el PDF principal + PDFs de distribuidores para una liquidación.
     */
    public function upload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'liquidacion_cliente_id' => 'required|exists:liq_liquidaciones_cliente,id',
            'sucursal' => 'required|string|max:20',
            'main_pdf' => 'required|file|mimes:pdf',
            'distrib_pdfs' => 'required|array|min:1',
            'distrib_pdfs.*' => 'file|mimes:pdf',
        ]);

        $liquidacion = LiqLiquidacionCliente::with('cliente')->findOrFail($data['liquidacion_cliente_id']);
        $sucursal = strtoupper(trim($data['sucursal']));

        // Guardar PDF principal como archivo de entrada
        $mainFile = $request->file('main_pdf');
        $disk = 'local';
        $dir = "liq/{$liquidacion->cliente_id}/archivos";

        $mainNombreInterno = Str::uuid() . '.pdf';
        $mainRuta = $mainFile->storeAs($dir, $mainNombreInterno, $disk);

        $archivoPrincipal = LiqArchivoEntrada::create([
            'liquidacion_cliente_id' => $liquidacion->id,
            'tipo_archivo' => 'OCA_PRINCIPAL',
            'nombre_original' => $mainFile->getClientOriginalName(),
            'nombre_interno' => $mainNombreInterno,
            'disk' => $disk,
            'ruta_storage' => $mainRuta,
            'tamano' => (int) ($mainFile->getSize() ?? 0),
            'sucursal' => $sucursal,
        ]);

        // Guardar PDFs de distribuidores
        $archivosDistrib = [];
        foreach ($request->file('distrib_pdfs', []) as $distribFile) {
            $distribNombreInterno = Str::uuid() . '.pdf';
            $distribRuta = $distribFile->storeAs($dir, $distribNombreInterno, $disk);

            $archivosDistrib[] = LiqArchivoEntrada::create([
                'liquidacion_cliente_id' => $liquidacion->id,
                'tipo_archivo' => 'OCA_DISTRIBUIDOR',
                'nombre_original' => $distribFile->getClientOriginalName(),
                'nombre_interno' => $distribNombreInterno,
                'disk' => $disk,
                'ruta_storage' => $distribRuta,
                'tamano' => (int) ($distribFile->getSize() ?? 0),
                'sucursal' => $sucursal,
            ]);
        }

        try {
            $result = $this->ocaIngestService->procesar(
                liquidacion: $liquidacion,
                archivoPrincipal: $archivoPrincipal,
                archivosDistrib: $archivosDistrib,
                mainPdf: $mainFile,
                distribPdfs: $request->file('distrib_pdfs', []),
                sucursal: $sucursal,
            );

            return response()->json(['data' => $result, 'message' => 'PDFs OCA procesados correctamente'], 201);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Error al procesar PDFs OCA: ' . $e->getMessage()], 422);
        }
    }

    /**
     * GET /liq/oca/{liquidacionCliente}/vinculaciones - Lista vinculaciones OCA.
     */
    public function vinculaciones(Request $request, LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $query = LiqVinculacionOca::where('liquidacion_cliente_id', $liquidacionCliente->id)
            ->with('distribuidor:id,apellidos,nombres,patente');

        if ($request->filled('estado')) {
            $query->where('estado', $request->string('estado'));
        }
        if ($request->filled('fecha')) {
            $query->whereDate('fecha', $request->string('fecha'));
        }
        if ($request->filled('distribuidor_nombre')) {
            $query->where('distribuidor_nombre', 'like', '%' . $request->string('distribuidor_nombre') . '%');
        }

        $vinculaciones = $query->orderBy('fecha')->orderBy('distribuidor_nombre')->paginate(100);

        return response()->json(['data' => $vinculaciones]);
    }

    /**
     * GET /liq/oca/{liquidacionCliente}/resumen - Resumen de vinculación OCA.
     */
    public function resumen(LiqLiquidacionCliente $liquidacionCliente): JsonResponse
    {
        $liqId = $liquidacionCliente->id;

        // Por estado
        $porEstado = LiqVinculacionOca::where('liquidacion_cliente_id', $liqId)
            ->selectRaw('estado, COUNT(*) as cantidad, SUM(importe_original) as total_importe')
            ->groupBy('estado')
            ->get();

        // Por distribuidor
        $porDistribuidor = LiqVinculacionOca::where('liquidacion_cliente_id', $liqId)
            ->where('estado', '!=', 'SIN_ASIGNAR')
            ->selectRaw('distribuidor_nombre, COUNT(*) as planillas, SUM(cantidad) as total_qty, SUM(importe_original) as total_importe')
            ->groupBy('distribuidor_nombre')
            ->orderByRaw('SUM(importe_original) DESC')
            ->get();

        // Por día
        $porDia = LiqVinculacionOca::where('liquidacion_cliente_id', $liqId)
            ->selectRaw('fecha, estado, COUNT(*) as planillas, SUM(importe_original) as total_importe')
            ->groupBy('fecha', 'estado')
            ->orderBy('fecha')
            ->get()
            ->groupBy('fecha');

        return response()->json([
            'por_estado' => $porEstado,
            'por_distribuidor' => $porDistribuidor,
            'por_dia' => $porDia,
        ]);
    }

    /**
     * GET /liq/oca/health - Verifica estado del microservicio Python.
     */
    public function health(): JsonResponse
    {
        $available = $this->ocaClient->isAvailable();
        return response()->json([
            'available' => $available,
            'url' => config('services.oca.base_url'),
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Persona;
use App\Models\Poliza;
use App\Models\PolizaAsegurado;
use App\Services\Polizas\CargaPolizaService;
use App\Services\Polizas\DiscrepanciasService;
use App\Services\Polizas\PolizaPdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PolizasController extends Controller
{
    public function __construct(
        private readonly DiscrepanciasService $discrepancias,
        private readonly PolizaPdfService $pdfService,
        private readonly CargaPolizaService $cargaService,
    ) {
    }

    public function index(): JsonResponse
    {
        $polizas = Poliza::query()
            ->with('aseguradora:id,nombre,parser_perfil')
            ->withCount(['asegurados as asegurados_activos_count' => fn ($q) => $q->where('estado', 'activo')])
            ->orderByDesc('vigencia_hasta')
            ->get();

        return response()->json(['data' => $polizas]);
    }

    public function show(Poliza $poliza): JsonResponse
    {
        $poliza->load([
            'aseguradora',
            'emailConfigs',
            'endosos',
        ]);
        $poliza->loadCount(['asegurados', 'asegurados as asegurados_activos_count' => fn ($q) => $q->where('estado', 'activo')]);

        return response()->json(['data' => $poliza]);
    }

    public function discrepancias(Poliza $poliza): JsonResponse
    {
        return response()->json(['data' => $this->discrepancias->paraPoliza($poliza->id)]);
    }

    public function cargarPdf(Request $request, Poliza $poliza): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:pdf', 'max:20480'],
        ]);

        $parsed  = $this->pdfService->parse($request->file('file'));
        $preview = $this->cargaService->armarPreview($poliza, $parsed);

        return response()->json(['data' => $preview]);
    }

    public function confirmarCarga(Request $request, Poliza $poliza): JsonResponse
    {
        $payload = $request->validate([
            'endoso'                                  => ['nullable', 'array'],
            'endoso.numero_endoso'                    => ['nullable', 'string', 'max:50'],
            'endoso.tipo'                             => ['nullable', 'string'],
            'endoso.fecha_emision'                    => ['nullable', 'date'],
            'asegurados'                              => ['required', 'array'],
            'asegurados.*.tipo'                       => ['required', 'in:persona,vehiculo'],
            'asegurados.*.identificador'              => ['required', 'string', 'max:50'],
            'asegurados.*.identificador_tipo'         => ['required', 'in:dni,cuil,patente'],
            'asegurados.*.decision'                   => ['required', 'in:vincular,crear,ignorar'],
            'asegurados.*.persona_id'                 => ['nullable', 'integer', 'exists:personas,id'],
        ]);

        $result = $this->cargaService->confirmar($poliza, $payload);

        return response()->json(['data' => $result]);
    }

    /** Lista las pólizas en las que figura un proveedor (Persona) como asegurado. */
    public function polizasDePersona(Persona $persona): JsonResponse
    {
        $asegurados = PolizaAsegurado::query()
            ->where('persona_id', $persona->id)
            ->with([
                'poliza:id,nombre_descriptivo,numero_poliza,vigencia_desde,vigencia_hasta,activa,aseguradora_id,tipo_asegurado',
                'poliza.aseguradora:id,nombre,parser_perfil',
            ])
            ->orderByDesc('id')
            ->get();

        return response()->json(['data' => $asegurados]);
    }

    public function asegurados(Request $request, Poliza $poliza): JsonResponse
    {
        $query = PolizaAsegurado::query()
            ->where('poliza_id', $poliza->id)
            ->with('persona:id,apellidos,nombres,cuil,patente,estado_id');

        if ($estado = $request->query('estado')) {
            $query->where('estado', $estado);
        }
        if ($request->boolean('solo_dudosos')) {
            $query->where('revision_manual_pendiente', true);
        }

        return response()->json([
            'data' => $query->orderBy('numero_orden_aseguradora')
                ->orderBy('id')
                ->get(),
        ]);
    }
}

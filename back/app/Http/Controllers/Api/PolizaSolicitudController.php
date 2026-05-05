<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Poliza;
use App\Models\PolizaSolicitud;
use App\Services\Polizas\SolicitudService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PolizaSolicitudController extends Controller
{
    public function __construct(private readonly SolicitudService $service)
    {
    }

    /** Crear borrador de solicitud (alta o baja) con asegurados seleccionados. */
    public function store(Request $request, Poliza $poliza): JsonResponse
    {
        $data = $request->validate([
            'tipo'                                        => ['required', 'in:alta,baja'],
            'asegurado_ids'                               => ['required', 'array', 'min:1'],
            'asegurado_ids.*'                             => ['integer', 'exists:polizas_asegurados,id'],
            'tipo_clausula_global'                        => ['nullable', 'in:ninguna,aplicar,previa_existente'],
            'clausula_global_id'                          => ['nullable', 'integer', 'exists:polizas_clausulas,id'],
            'clausulas_individuales'                      => ['nullable', 'array'],
            'clausulas_individuales.*.asegurado_id'       => ['required_with:clausulas_individuales', 'integer'],
            'clausulas_individuales.*.clausula_id'        => ['required_with:clausulas_individuales', 'integer', 'exists:polizas_clausulas,id'],
        ]);

        $admin = $request->user();
        if (!$admin) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        $opciones = [
            'tipo_clausula_global'   => $data['tipo_clausula_global']   ?? 'ninguna',
            'clausula_global_id'     => $data['clausula_global_id']     ?? null,
            'clausulas_individuales' => $data['clausulas_individuales'] ?? null,
        ];

        $solicitud = $this->service->crearBorrador(
            $poliza, $data['tipo'], $data['asegurado_ids'], $admin, $opciones
        );

        return response()->json(['data' => $solicitud->fresh(['asegurados.asegurado'])], 201);
    }

    /** Bandeja: lista con filtros opcionales (estado, tipo, poliza_id). */
    public function index(Request $request): JsonResponse
    {
        $query = PolizaSolicitud::query()
            ->with([
                'poliza:id,nombre_descriptivo,numero_poliza,aseguradora_id',
                'poliza.aseguradora:id,nombre',
                'administrativo:id,name,email',
            ])
            ->withCount('asegurados')
            ->orderByDesc('id');

        if ($estado = $request->query('estado'))   $query->where('estado', $estado);
        if ($tipo   = $request->query('tipo'))     $query->where('tipo', $tipo);
        if ($pid    = $request->query('poliza_id')) $query->where('poliza_id', $pid);

        return response()->json(['data' => $query->get()]);
    }

    public function show(PolizaSolicitud $solicitud): JsonResponse
    {
        $solicitud->load([
            'poliza.aseguradora',
            'administrativo:id,name,email',
            'asegurados.asegurado.persona:id,apellidos,nombres,cuil,patente',
        ]);
        return response()->json(['data' => $solicitud]);
    }

    /** Render del email para preview en UI (no envía). */
    public function preview(PolizaSolicitud $solicitud): JsonResponse
    {
        $preview = $this->service->previewRender($solicitud);
        return response()->json(['data' => $preview]);
    }

    /** Envía vía SMTP y deja la solicitud en estado 'enviado'. */
    public function enviar(PolizaSolicitud $solicitud): JsonResponse
    {
        $solicitud = $this->service->enviar($solicitud);
        return response()->json(['data' => $solicitud]);
    }

    /** Cierra la solicitud según la respuesta de la aseguradora. */
    public function confirmar(Request $request, PolizaSolicitud $solicitud): JsonResponse
    {
        $data = $request->validate([
            'tipo_respuesta'    => ['required', 'in:ok,rechazada'],
            'respuesta_resumen' => ['nullable', 'string', 'max:2000'],
        ]);

        $solicitud = $this->service->confirmar($solicitud, $data['tipo_respuesta'], $data['respuesta_resumen'] ?? null);
        return response()->json(['data' => $solicitud]);
    }
}

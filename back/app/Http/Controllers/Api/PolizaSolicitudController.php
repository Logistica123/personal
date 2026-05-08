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
        // BUGFIX 02 Issue 2: el wizard "Solicitar alta" puede mandar `persona_ids`
        // (proveedores que aún NO son asegurados de esta póliza) en lugar de
        // `asegurado_ids`. Al menos uno de los dos arrays debe venir.
        $data = $request->validate([
            'tipo'                                        => ['required', 'in:alta,baja'],
            'asegurado_ids'                               => ['nullable', 'array'],
            'asegurado_ids.*'                             => ['integer', 'exists:polizas_asegurados,id'],
            'persona_ids'                                 => ['nullable', 'array'],
            'persona_ids.*'                               => ['integer', 'exists:personas,id'],
            'tipo_clausula_global'                        => ['nullable', 'in:ninguna,aplicar,previa_existente'],
            'clausula_global_id'                          => ['nullable', 'integer', 'exists:polizas_clausulas,id'],
            'clausulas_individuales'                      => ['nullable', 'array'],
            'clausulas_individuales.*.asegurado_id'       => ['required_with:clausulas_individuales', 'integer'],
            'clausulas_individuales.*.clausula_id'        => ['required_with:clausulas_individuales', 'integer', 'exists:polizas_clausulas,id'],
        ]);

        $aseguradoIds = $data['asegurado_ids'] ?? [];
        $personaIds   = $data['persona_ids']   ?? [];
        if (empty($aseguradoIds) && empty($personaIds)) {
            return response()->json(['message' => 'Sin asegurados ni personas seleccionados.'], 422);
        }

        $admin = $request->user();
        if (!$admin) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        $opciones = [
            'tipo_clausula_global'   => $data['tipo_clausula_global']   ?? 'ninguna',
            'clausula_global_id'     => $data['clausula_global_id']     ?? null,
            'clausulas_individuales' => $data['clausulas_individuales'] ?? null,
            'persona_ids'            => $personaIds,
        ];

        $solicitud = $this->service->crearBorrador(
            $poliza, $data['tipo'], $aseguradoIds, $admin, $opciones
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

        if ($search = trim((string) $request->query('search', ''))) {
            $like = '%' . str_replace('%', '\\%', $search) . '%';
            $query->where(function ($q) use ($like) {
                $q->where('asunto', 'LIKE', $like)
                  ->orWhereHas('poliza', fn ($qp) => $qp
                      ->where('nombre_descriptivo', 'LIKE', $like)
                      ->orWhere('numero_poliza', 'LIKE', $like))
                  ->orWhereHas('administrativo', fn ($qa) => $qa
                      ->where('name', 'LIKE', $like)
                      ->orWhere('email', 'LIKE', $like));
            });
        }

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

        $resultado = $this->service->confirmar($solicitud, $data['tipo_respuesta'], $data['respuesta_resumen'] ?? null);
        return response()->json(['data' => [
            'solicitud'                      => $resultado['solicitud'],
            'personas_pendientes_aprobacion' => $resultado['personas_pendientes_aprobacion'],
        ]]);
    }

    /**
     * Bloque C.3 — cancela una solicitud que está en estado `borrador` o
     * `enviado`. Si estaba `enviado`, los asegurados que pasaron a
     * `alta_solicitada`/`baja_solicitada` vuelven a su estado anterior
     * razonable (`no_matcheado` para alta, `activo` para baja).
     */
    public function cancelar(Request $request, PolizaSolicitud $solicitud): JsonResponse
    {
        if (!in_array($solicitud->estado, ['borrador', 'enviado'], true)) {
            return response()->json([
                'message' => "No se puede cancelar una solicitud en estado '{$solicitud->estado}'.",
            ], 422);
        }
        $resumen = $request->input('motivo');

        \DB::transaction(function () use ($solicitud, $resumen) {
            $estabaEnviado = $solicitud->estado === 'enviado';
            $solicitud->update([
                'estado'             => 'cancelada',
                'respuesta_resumen'  => $resumen
                    ? "Cancelada: {$resumen}"
                    : 'Cancelada manualmente.',
                'respuesta_recibida_en' => now(),
            ]);

            if ($estabaEnviado) {
                $aseguradoIds = \App\Models\PolizaSolicitudAsegurado::where('solicitud_id', $solicitud->id)
                    ->pluck('asegurado_id')
                    ->all();
                $estadoVuelta = $solicitud->tipo === 'alta' ? 'no_matcheado' : 'activo';
                \App\Models\PolizaAsegurado::whereIn('id', $aseguradoIds)
                    ->update(['estado' => $estadoVuelta]);
            }
        });

        return response()->json(['data' => $solicitud->fresh()]);
    }

    /** ADD 15 — aprueba varias personas a la vez tras confirmar un alta. */
    public function aprobarPersonas(Request $request): JsonResponse
    {
        $data = $request->validate([
            'persona_ids'   => ['required', 'array', 'min:1'],
            'persona_ids.*' => ['integer', 'exists:personas,id'],
        ]);
        $admin = $request->user();
        if (!$admin) return response()->json(['message' => 'No autenticado.'], 401);

        return response()->json(['data' => $this->service->aprobarPersonasMasivo($data['persona_ids'], $admin)]);
    }
}

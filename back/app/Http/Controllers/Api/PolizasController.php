<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Persona;
use App\Models\Poliza;
use App\Models\PolizaAsegurado;
use App\Services\Polizas\CargaPolizaService;
use App\Services\Polizas\DiscrepanciasService;
use App\Services\Polizas\PolizaCertificadoIndividualService;
use App\Services\Polizas\PolizaPdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PolizasController extends Controller
{
    public function __construct(
        private readonly DiscrepanciasService $discrepancias,
        private readonly PolizaPdfService $pdfService,
        private readonly CargaPolizaService $cargaService,
        private readonly PolizaCertificadoIndividualService $certificadoService,
    ) {
    }

    /**
     * ADDENDUM 9 Parte B — regenera el certificado individual de un asegurado.
     * Útil cuando el alta se confirmó antes de que existiera la feature, o
     * cuando hubo un fallo transitorio al generarlo automáticamente.
     */
    public function regenerarCertificadoIndividual(PolizaAsegurado $asegurado): JsonResponse
    {
        try {
            $archivo = $this->certificadoService->generarYGuardar($asegurado);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
        return response()->json(['data' => [
            'archivo_id' => $archivo->id,
            'nombre'     => $archivo->nombre_original,
            'ruta'       => $archivo->ruta,
        ]]);
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
            'asegurados.*.sugerencia_fuzzy_persona_id' => ['nullable', 'integer', 'exists:personas,id'],
            'asegurados.*.sugerencia_fuzzy_score'      => ['nullable', 'numeric', 'between:0,1'],
        ]);

        $result = $this->cargaService->confirmar($poliza, $payload);

        return response()->json(['data' => $result]);
    }

    /**
     * ADD 15 — Pólizas aplicables (sugeridas) para una persona según su perfil.
     * Heurística simple: todas las pólizas activas del tipo correspondiente al
     * perfil de la persona (vehículo si tiene patente, persona si no).
     */
    public function polizasAplicablesParaPersona(Persona $persona): JsonResponse
    {
        $tieneVehiculo = !empty($persona->patente)
            || $persona->patentesAdicionales()->exists();

        $query = Poliza::query()
            ->with('aseguradora:id,nombre,parser_perfil')
            ->where('activa', true);

        if (!$tieneVehiculo) {
            $query->where('tipo_asegurado', 'persona');
        }

        $polizas = $query->orderBy('nombre_descriptivo')->get()->map(fn ($p) => [
            'poliza_id'    => $p->id,
            'nombre'       => $p->nombre_descriptivo,
            'aseguradora'  => $p->aseguradora?->nombre,
            'tipo_asegurado' => $p->tipo_asegurado,
            'razon'        => $p->tipo_asegurado === 'vehiculo'
                ? 'Persona con patente registrada'
                : 'Persona AP',
        ]);

        return response()->json(['data' => $polizas]);
    }

    /**
     * BUGFIX 02 Issue 4 — Personas candidatas para alta en una póliza.
     *
     * Devuelve personas que NO son asegurados activos en la póliza, con badge de
     * estado actual (`estado_actual`) y soporta `?search=`. Sin filtro de
     * estado de persona — el spec quiere ver Activos / Solicitud / Suspendidos /
     * Bajas con su badge correspondiente.
     */
    public function personasDisponiblesParaAlta(Request $request, Poliza $poliza): JsonResponse
    {
        $excluidos = PolizaAsegurado::query()
            ->where('poliza_id', $poliza->id)
            ->whereIn('estado', ['activo', 'alta_solicitada'])
            ->whereNotNull('persona_id')
            ->pluck('persona_id')
            ->all();

        $query = Persona::query()
            ->whereNotIn('id', $excluidos)
            ->select(['id', 'apellidos', 'nombres', 'cuil', 'patente', 'estado_id', 'fecha_baja', 'es_solicitud', 'aprobado', 'tipo']);

        // En pólizas de vehículos solo personas con patente registrada (principal o adicional).
        if ($poliza->tipo_asegurado === 'vehiculo') {
            $query->where(function ($q) {
                $q->whereNotNull('patente')
                  ->orWhereHas('patentesAdicionales', fn ($qa) => $qa->where('activo', true));
            });
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $like = '%' . str_replace('%', '\\%', $search) . '%';
            $cuilDigits = preg_replace('/\D/', '', $search);
            $query->where(function ($q) use ($like, $cuilDigits) {
                $q->where('apellidos', 'LIKE', $like)
                  ->orWhere('nombres', 'LIKE', $like)
                  ->orWhere('patente', 'LIKE', $like);
                if ($cuilDigits !== '') {
                    $q->orWhereRaw('REPLACE(REPLACE(REPLACE(cuil, "-", ""), ".", ""), " ", "") LIKE ?', ['%' . $cuilDigits . '%']);
                }
            });
        }

        $rows = $query->orderBy('apellidos')
            ->orderBy('nombres')
            ->limit(500)
            ->get()
            ->map(fn ($p) => self::serializarDistribuidor($p) + [
                'perfil' => $p->tipo,
            ]);

        return response()->json(['data' => $rows]);
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

    /**
     * BUGFIX 02 Issue 1 — Auditoría de matches `fuzzy_nombre` históricos.
     *
     * Lista asegurados que fueron migrados a "sugerencia fuzzy + sin match"
     * (originalmente vinculados por nombre con score >= 0.85, ahora sin
     * persona_id) o nuevos casos donde el matching no encontró exacto pero
     * sí un candidato fuzzy.
     */
    public function auditoriaMatchesFuzzy(Request $request): JsonResponse
    {
        $query = PolizaAsegurado::query()
            ->whereNull('persona_id')
            ->whereNotNull('sugerencia_fuzzy_persona_id')
            ->with([
                'poliza:id,nombre_descriptivo,numero_poliza,aseguradora_id',
                'poliza.aseguradora:id,nombre',
                'sugerenciaFuzzyPersona:id,apellidos,nombres,cuil,patente,estado_id,fecha_baja,es_solicitud,aprobado',
            ])
            ->orderByDesc('sugerencia_fuzzy_score')
            ->orderBy('id');

        if ($pid = $request->query('poliza_id')) {
            $query->where('poliza_id', $pid);
        }

        return response()->json(['data' => $query->get()]);
    }

    /**
     * Resuelve una sugerencia fuzzy: confirma vincular al candidato o la rechaza.
     *
     *  - `confirmar`: copia `sugerencia_fuzzy_persona_id` a `persona_id`, deja
     *    `match_metodo='manual'`, recalcula estado.
     *  - `rechazar`: deja `persona_id=null`, limpia la sugerencia, queda como
     *    "no_matcheado" sin pendiente.
     */
    public function resolverSugerenciaFuzzy(Request $request, PolizaAsegurado $asegurado): JsonResponse
    {
        $data = $request->validate([
            'accion' => ['required', 'in:confirmar,rechazar'],
        ]);

        if (!$asegurado->sugerencia_fuzzy_persona_id) {
            return response()->json(['message' => 'El asegurado no tiene sugerencia fuzzy asignada.'], 422);
        }

        if ($data['accion'] === 'confirmar') {
            $persona = Persona::find($asegurado->sugerencia_fuzzy_persona_id);
            if (!$persona) {
                return response()->json(['message' => 'Persona sugerida no existe.'], 422);
            }
            $personaEstado = \App\Services\Polizas\MatchingService::calcularEstadoPersona($persona);
            $asegurado->update([
                'persona_id'                  => $persona->id,
                'match_metodo'                => 'manual',
                'match_score'                 => $asegurado->sugerencia_fuzzy_score,
                'persona_estado_al_matchear'  => $personaEstado,
                'persona_alerta_estado'       => \App\Services\Polizas\MatchingService::calcularAlertaEstado(
                    $personaEstado,
                    $asegurado->estado === 'no_matcheado' ? 'activo' : $asegurado->estado
                ),
                'estado'                      => $asegurado->estado === 'no_matcheado' ? 'activo' : $asegurado->estado,
                'revision_manual_pendiente'   => false,
                'sugerencia_fuzzy_persona_id' => null,
                'sugerencia_fuzzy_score'      => null,
            ]);
        } else {
            $asegurado->update([
                'sugerencia_fuzzy_persona_id' => null,
                'sugerencia_fuzzy_score'      => null,
                'revision_manual_pendiente'   => false,
            ]);
        }

        return response()->json(['data' => $asegurado->fresh(['poliza:id,nombre_descriptivo'])]);
    }

    /**
     * Lista de asegurados de una póliza con datos enriquecidos del distribuidor
     * (BUGFIX 02 Issue 3) y filtro de búsqueda libre (BUGFIX 02 Issue 4).
     *
     * Filtros:
     *  - `estado=`           filtra por estado en póliza ('activo', 'no_matcheado', etc.)
     *  - `solo_dudosos=true` solo asegurados con revisión manual pendiente o sugerencia fuzzy
     *  - `search=`           buscador libre (patente, CUIL, nombre PDF, nombre distribuidor)
     */
    public function asegurados(Request $request, Poliza $poliza): JsonResponse
    {
        $query = PolizaAsegurado::query()
            ->where('poliza_id', $poliza->id)
            ->with([
                'persona:id,apellidos,nombres,cuil,patente,estado_id,fecha_baja,es_solicitud,aprobado',
                'sugerenciaFuzzyPersona:id,apellidos,nombres,cuil',
            ]);

        if ($estado = $request->query('estado')) {
            $query->where('estado', $estado);
        }
        if ($request->boolean('solo_dudosos')) {
            $query->where(fn ($q) => $q
                ->where('revision_manual_pendiente', true)
                ->orWhereNotNull('sugerencia_fuzzy_persona_id'));
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $like = '%' . str_replace('%', '\\%', $search) . '%';
            $likeUpper = mb_strtoupper($like);
            $cuilDigits = preg_replace('/\D/', '', $search);
            $query->where(function ($q) use ($like, $likeUpper, $cuilDigits) {
                $q->where('identificador', 'LIKE', $likeUpper)
                  ->orWhere('nombre_apellido_pdf', 'LIKE', $likeUpper)
                  ->orWhere('marca_modelo_pdf', 'LIKE', $likeUpper)
                  ->orWhereHas('persona', function ($qp) use ($like, $cuilDigits) {
                      $qp->where('apellidos', 'LIKE', $like)
                         ->orWhere('nombres', 'LIKE', $like)
                         ->orWhere('patente', 'LIKE', $like);
                      if ($cuilDigits !== '') {
                          $qp->orWhereRaw('REPLACE(REPLACE(REPLACE(cuil, "-", ""), ".", ""), " ", "") LIKE ?', ['%' . $cuilDigits . '%']);
                      }
                  });
            });
        }

        $rows = $query->orderBy('numero_orden_aseguradora')
            ->orderBy('id')
            ->get()
            ->map(function (PolizaAsegurado $a) {
                $arr = $a->toArray();
                $arr['persona'] = self::serializarDistribuidor($a->persona);
                $arr['sugerencia_fuzzy_persona'] = $a->sugerenciaFuzzyPersona ? [
                    'id'       => $a->sugerenciaFuzzyPersona->id,
                    'nombre'   => self::nombreCompletoPersona($a->sugerenciaFuzzyPersona),
                    'cuil'     => $a->sugerenciaFuzzyPersona->cuil,
                    'score'    => $a->sugerencia_fuzzy_score,
                ] : null;
                return $arr;
            });

        return response()->json(['data' => $rows]);
    }

    /**
     * Serializa una persona como "distribuidor" con los campos que la UI usa
     * para mostrar el badge de estado y nombre completo. Devuelve null si no
     * hay match.
     */
    public static function serializarDistribuidor(?Persona $persona): ?array
    {
        if (!$persona) {
            return null;
        }
        $estadoActual = \App\Services\Polizas\MatchingService::calcularEstadoPersona($persona);
        return [
            'id'              => $persona->id,
            'nombre_completo' => self::nombreCompletoPersona($persona),
            'cuil'            => $persona->cuil,
            'patente'         => $persona->patente,
            'estado_actual'   => $estadoActual,
            'es_solicitud'    => (bool) $persona->es_solicitud,
            'aprobado'        => (bool) $persona->aprobado,
            'fecha_baja'      => $persona->fecha_baja,
        ];
    }

    public static function nombreCompletoPersona(Persona $persona): string
    {
        return trim(($persona->apellidos ?? '') . ' ' . ($persona->nombres ?? '')) ?: '—';
    }
}

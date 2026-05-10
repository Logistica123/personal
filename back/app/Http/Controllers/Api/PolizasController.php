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

    /**
     * ADDENDUM 12 Parte G — busca asegurados activos por CUIL/DNI/patente
     * (una entrada por línea de input). Devuelve `encontrados` y
     * `no_encontrados` para que la UI arme el wizard de baja masiva.
     *
     * Acepta variantes: CUIL con/sin guiones, DNI 8 dígitos, patente vieja o
     * Mercosur. Normaliza antes de buscar.
     */
    public function buscarAseguradosBulk(Request $request, Poliza $poliza): JsonResponse
    {
        $data = $request->validate([
            'lineas'   => ['required', 'array', 'min:1', 'max:1000'],
            'lineas.*' => ['nullable', 'string', 'max:50'],
        ]);

        $entradas = collect($data['lineas'])
            ->map(fn ($l) => trim((string) $l))
            ->filter()
            ->unique()
            ->values();

        $encontrados = [];
        $noEncontrados = [];

        foreach ($entradas as $linea) {
            $asegurado = $this->buscarAseguradoPorEntrada($poliza, $linea);
            if ($asegurado) {
                $encontrados[] = [
                    'linea_input'   => $linea,
                    'asegurado_id'  => $asegurado->id,
                    'persona_id'    => $asegurado->persona_id,
                    'identificador' => $asegurado->identificador,
                    'nombre'        => $asegurado->persona
                        ? trim(($asegurado->persona->apellidos ?? '') . ' ' . ($asegurado->persona->nombres ?? '')) ?: '—'
                        : ($asegurado->nombre_apellido_pdf ?? '—'),
                    'cuil'          => $asegurado->persona?->cuil,
                    'estado'        => $asegurado->estado,
                ];
            } else {
                $noEncontrados[] = [
                    'linea_input' => $linea,
                    'razon'       => 'Sin coincidencia exacta como asegurado activo en esta póliza.',
                ];
            }
        }

        return response()->json(['data' => [
            'encontrados'    => $encontrados,
            'no_encontrados' => $noEncontrados,
        ]]);
    }

    /**
     * Helper para `buscarAseguradosBulk`. Decide si la entrada es CUIL/DNI o
     * patente y busca un asegurado activo de la póliza que matchee.
     */
    private function buscarAseguradoPorEntrada(Poliza $poliza, string $linea): ?PolizaAsegurado
    {
        $digitos = preg_replace('/\D/', '', $linea);

        // Para pólizas de personas: CUIL (11 dígitos) o DNI (8 dígitos extraído).
        if ($poliza->tipo_asegurado === 'persona') {
            $cuil = strlen($digitos) === 11 ? $digitos : null;
            $dni  = strlen($digitos) === 8 ? $digitos
                  : (strlen($digitos) === 11 ? substr($digitos, 2, 8) : null);

            // Match por persona (CUIL exacto).
            if ($cuil) {
                $a = PolizaAsegurado::query()
                    ->where('poliza_id', $poliza->id)
                    ->whereIn('estado', ['activo', 'alta_solicitada'])
                    ->whereHas('persona', fn ($q) => $q->whereRaw(
                        'REPLACE(REPLACE(REPLACE(cuil, "-", ""), ".", ""), " ", "") = ?', [$cuil]
                    ))
                    ->with('persona:id,apellidos,nombres,cuil')
                    ->first();
                if ($a) return $a;
            }
            // Match por DNI (extraído del CUIL central).
            if ($dni) {
                $a = PolizaAsegurado::query()
                    ->where('poliza_id', $poliza->id)
                    ->whereIn('estado', ['activo', 'alta_solicitada'])
                    ->whereHas('persona', fn ($q) => $q->whereRaw(
                        'SUBSTRING(REPLACE(REPLACE(REPLACE(cuil, "-", ""), ".", ""), " ", ""), 3, 8) = ?', [$dni]
                    ))
                    ->with('persona:id,apellidos,nombres,cuil')
                    ->first();
                if ($a) return $a;
            }
            // Match por identificador directo (cuando el asegurado quedó como `no_matcheado`).
            $a = PolizaAsegurado::query()
                ->where('poliza_id', $poliza->id)
                ->whereIn('estado', ['activo', 'alta_solicitada'])
                ->where(function ($q) use ($cuil, $dni) {
                    if ($cuil) $q->orWhere('identificador', $cuil);
                    if ($dni)  $q->orWhere('identificador', $dni);
                })
                ->with('persona:id,apellidos,nombres,cuil')
                ->first();
            return $a;
        }

        // Pólizas de vehículos: patente normalizada (mayúsculas, sin espacios/guiones).
        $patente = strtoupper(preg_replace('/[\s\-]/', '', $linea));
        if (!$patente) return null;
        return PolizaAsegurado::query()
            ->where('poliza_id', $poliza->id)
            ->whereIn('estado', ['activo', 'alta_solicitada'])
            ->where('identificador', $patente)
            ->with('persona:id,apellidos,nombres,cuil')
            ->first();
    }

    /**
     * ADDENDUM 12 Parte E — soft delete de un asegurado individual.
     * Requiere permiso `puede_eliminar_asegurados`. Motivo es obligatorio.
     */
    public function eliminarAsegurado(Request $request, PolizaAsegurado $asegurado): JsonResponse
    {
        $data = $request->validate([
            'motivo' => ['required', 'string', 'min:3', 'max:255'],
        ]);
        $user = $request->user();
        if (!$user) return response()->json(['message' => 'No autenticado.'], 401);

        $asegurado->update([
            'eliminado_en'           => now(),
            'eliminado_por_user_id'  => $user->id,
            'motivo_eliminacion'     => $data['motivo'],
        ]);
        return response()->json(['data' => ['eliminado' => true, 'asegurado_id' => $asegurado->id]]);
    }

    /**
     * ADDENDUM 12 Parte E — eliminación masiva. Si son <=10 ítems requiere
     * `puede_eliminar_asegurados`. Si son >10, requiere
     * `puede_eliminar_asegurados_masivo` (típicamente solo super admin).
     */
    public function eliminarAseguradosMasivo(Request $request): JsonResponse
    {
        $data = $request->validate([
            'asegurado_ids'   => ['required', 'array', 'min:1'],
            'asegurado_ids.*' => ['integer'],
            'motivo'          => ['required', 'string', 'min:3', 'max:255'],
        ]);
        $user = $request->user();
        if (!$user) return response()->json(['message' => 'No autenticado.'], 401);

        $cantidad = count($data['asegurado_ids']);
        if ($cantidad > 10) {
            // Permiso reforzado para operaciones de gran impacto.
            $perm = \App\Models\PolizaAdminPermiso::where('user_id', $user->id)->first();
            $isAdmin = ($user->role ?? null) === 'admin';
            if (!$isAdmin && !($perm?->puede_eliminar_asegurados_masivo ?? false)) {
                return response()->json([
                    'message' => "Eliminación de {$cantidad} asegurados requiere permiso `puede_eliminar_asegurados_masivo`.",
                ], 403);
            }
        }

        $ids = $data['asegurado_ids'];
        $afectados = PolizaAsegurado::query()
            ->whereIn('id', $ids)
            ->whereNull('eliminado_en')
            ->update([
                'eliminado_en'          => now(),
                'eliminado_por_user_id' => $user->id,
                'motivo_eliminacion'    => $data['motivo'],
                'updated_at'            => now(),
            ]);

        return response()->json(['data' => [
            'solicitados' => $cantidad,
            'eliminados'  => $afectados,
        ]]);
    }

    /**
     * ADDENDUM 12 Parte E — listado de asegurados eliminados (panel auditoría).
     * Solo super admin (`role='admin'`).
     */
    public function aseguradosEliminados(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || ($user->role ?? null) !== 'admin') {
            return response()->json(['message' => 'Solo super admin.'], 403);
        }

        $rows = PolizaAsegurado::query()
            ->soloEliminados()
            ->with([
                'poliza:id,nombre_descriptivo,numero_poliza,aseguradora_id',
                'poliza.aseguradora:id,nombre',
                'persona:id,apellidos,nombres,cuil',
            ])
            ->orderByDesc('eliminado_en')
            ->limit(500)
            ->get();

        // Resolver el user que hizo la eliminación con join manual (no hay relación tipada).
        $userIds = $rows->pluck('eliminado_por_user_id')->filter()->unique();
        $users = \App\Models\User::whereIn('id', $userIds)->get(['id', 'name', 'email'])->keyBy('id');

        $rows = $rows->map(function ($a) use ($users) {
            $arr = $a->toArray();
            $arr['eliminado_por'] = $a->eliminado_por_user_id
                ? ($users->get($a->eliminado_por_user_id)?->only(['id', 'name', 'email']))
                : null;
            return $arr;
        });

        return response()->json(['data' => $rows]);
    }

    /**
     * ADDENDUM 12 Parte E — restaura un asegurado eliminado. Solo super admin.
     */
    public function restaurarAsegurado(Request $request, int $aseguradoId): JsonResponse
    {
        $user = $request->user();
        if (!$user || ($user->role ?? null) !== 'admin') {
            return response()->json(['message' => 'Solo super admin.'], 403);
        }

        $asegurado = PolizaAsegurado::query()
            ->soloEliminados()
            ->where('id', $aseguradoId)
            ->first();
        if (!$asegurado) {
            return response()->json(['message' => 'No existe o no está eliminado.'], 404);
        }
        $asegurado->update([
            'eliminado_en'          => null,
            'eliminado_por_user_id' => null,
            'motivo_eliminacion'    => null,
        ]);
        return response()->json(['data' => ['restaurado' => true]]);
    }

    /**
     * Bloque D.1 — comparte el certificado individual de un asegurado por email
     * a su `personas.email`. El PDF va como adjunto. Si el asegurado no tiene
     * persona vinculada o la persona no tiene email, devuelve 422.
     *
     * Genera el certificado al vuelo (no asume que ya esté en `archivos`) para
     * que siempre sea la versión actualizada con cláusulas vigentes del momento.
     */
    public function compartirCertificadoConDistribuidor(Request $request, PolizaAsegurado $asegurado): JsonResponse
    {
        $asegurado->loadMissing(['persona:id,apellidos,nombres,email', 'poliza:id,numero_poliza,nombre_descriptivo']);
        if (!$asegurado->persona) {
            return response()->json(['message' => 'El asegurado no tiene persona vinculada.'], 422);
        }
        $email = trim((string) $asegurado->persona->email);
        if (!$email) {
            return response()->json([
                'message' => 'El distribuidor no tiene email cargado en su ficha. ' .
                             'Cargá el email en /personal/'.$asegurado->persona->id.'/editar.',
            ], 422);
        }

        try {
            $pdf = $this->certificadoService->renderPdf($asegurado);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'No se pudo generar el certificado: ' . $e->getMessage()], 422);
        }

        $nombrePoliza = $asegurado->poliza?->nombre_descriptivo ?? 'póliza';
        $numero = $asegurado->poliza?->numero_poliza ?? '?';
        $admin = $request->user();
        $body = "Hola " . trim(($asegurado->persona->apellidos ?? '') . ' ' . ($asegurado->persona->nombres ?? '')) . ",\n\n"
              . "Te adjuntamos tu certificado de cobertura de la {$nombrePoliza} (N° {$numero}).\n\n"
              . "Si tenés dudas, respondé este mensaje.\n\n"
              . "Saludos,\nLogística Argentina S.R.L.";
        $asunto = "Tu certificado de cobertura — {$nombrePoliza}";

        \Illuminate\Support\Facades\Mail::raw($body, function ($mail) use ($email, $asunto, $pdf, $admin) {
            $mail->subject($asunto);
            $mail->to($email);
            if ($admin?->email) {
                $mail->replyTo($admin->email, $admin->name ?: '');
            }
            $mail->attachData($pdf, 'certificado_cobertura.pdf', ['mime' => 'application/pdf']);
        });

        return response()->json(['data' => [
            'enviado_a' => $email,
            'asunto'    => $asunto,
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

    /** Bloque C.1 — listado simple de aseguradoras (para selector de pólizas). */
    public function aseguradoras(): JsonResponse
    {
        $rows = \App\Models\PolizaAseguradora::query()
            ->where('activa', true)
            ->orderBy('nombre')
            ->get(['id', 'nombre', 'parser_perfil', 'cuit']);
        return response()->json(['data' => $rows]);
    }

    /** Bloque C.1 — crear póliza nueva. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'aseguradora_id'         => ['required', 'integer', 'exists:polizas_aseguradoras,id'],
            'nombre_descriptivo'     => ['required', 'string', 'max:150'],
            'ramo'                   => ['required', 'in:accidentes_personales,vehiculos'],
            'subramo'                => ['nullable', 'string', 'max:100'],
            'tipo_asegurado'         => ['required', 'in:persona,vehiculo'],
            'numero_poliza'          => ['required', 'string', 'max:50'],
            'numero_cuenta_cliente'  => ['nullable', 'string', 'max:50'],
            'vigencia_desde'         => ['required', 'date'],
            'vigencia_hasta'         => ['required', 'date', 'after_or_equal:vigencia_desde'],
            'tomador_cuit'           => ['nullable', 'string', 'max:15'],
            'tomador_razon_social'   => ['nullable', 'string', 'max:150'],
            'tomador_domicilio'      => ['nullable', 'string', 'max:255'],
            'alerta_dias_antes_vencimiento' => ['nullable', 'integer', 'min:1', 'max:120'],
            'notas'                  => ['nullable', 'string'],
        ]);
        $data['activa'] = true;
        $poliza = Poliza::create($data);
        return response()->json(['data' => $poliza->fresh('aseguradora')], 201);
    }

    /** Bloque C.1 — editar póliza. */
    public function update(Request $request, Poliza $poliza): JsonResponse
    {
        $data = $request->validate([
            'nombre_descriptivo'     => ['nullable', 'string', 'max:150'],
            'subramo'                => ['nullable', 'string', 'max:100'],
            'numero_cuenta_cliente'  => ['nullable', 'string', 'max:50'],
            'vigencia_desde'         => ['nullable', 'date'],
            'vigencia_hasta'         => ['nullable', 'date'],
            'tomador_cuit'           => ['nullable', 'string', 'max:15'],
            'tomador_razon_social'   => ['nullable', 'string', 'max:150'],
            'tomador_domicilio'      => ['nullable', 'string', 'max:255'],
            'alerta_dias_antes_vencimiento'         => ['nullable', 'integer', 'min:1', 'max:120'],
            'dias_alerta_sin_respuesta'             => ['nullable', 'integer', 'min:1', 'max:90'],
            'ofrecer_auto_aprobacion_distribuidor'  => ['nullable', 'boolean'],
            'activa'                 => ['nullable', 'boolean'],
            'clausulas_especiales'   => ['nullable', 'string'],
            'notas'                  => ['nullable', 'string'],
        ]);
        $poliza->fill(array_filter($data, fn ($v) => $v !== null))->save();
        return response()->json(['data' => $poliza->fresh('aseguradora')]);
    }

    /** Bloque C.1 — soft delete (marca `activa=false` para preservar histórico). */
    public function destroy(Poliza $poliza): JsonResponse
    {
        $poliza->update(['activa' => false]);
        return response()->json(['data' => ['deactivated' => true]]);
    }

    /**
     * Bloque C.2 — resumen para dashboard: pólizas que vencen pronto +
     * solicitudes pendientes + asegurados sin persona ("fantasmas") globales.
     * Útil para una card de KPIs en la home del módulo.
     */
    public function dashboardAlertas(): JsonResponse
    {
        $hoy = \Illuminate\Support\Carbon::today();

        $polizasPorVencer = Poliza::query()
            ->where('activa', true)
            ->whereDate('vigencia_hasta', '>=', $hoy)
            ->whereDate('vigencia_hasta', '<=', $hoy->copy()->addDays(30))
            ->orderBy('vigencia_hasta')
            ->get(['id', 'nombre_descriptivo', 'numero_poliza', 'vigencia_hasta', 'aseguradora_id'])
            ->map(fn ($p) => [
                'id'                => $p->id,
                'nombre'             => $p->nombre_descriptivo,
                'numero_poliza'     => $p->numero_poliza,
                'vigencia_hasta'    => $p->vigencia_hasta?->toDateString(),
                'dias_restantes'    => max(0, (int) $p->vigencia_hasta->diffInDays($hoy, false) * -1),
            ]);

        // Solicitudes "sin respuesta prolongada": el threshold es por póliza
        // (campo `dias_alerta_sin_respuesta`, default 7). Cada solicitud usa el
        // umbral de su póliza para detectar si está "atrasada".
        $solicitudesPendientes = \App\Models\PolizaSolicitud::query()
            ->where('estado', 'enviado')
            ->whereNotNull('enviado_en')
            ->whereRaw('DATEDIFF(NOW(), enviado_en) >= COALESCE((SELECT dias_alerta_sin_respuesta FROM polizas WHERE polizas.id = polizas_solicitudes.poliza_id), 7)')
            ->count();

        $aseguradosSinPersona = PolizaAsegurado::query()
            ->whereNull('persona_id')
            ->whereIn('estado', ['activo', 'no_matcheado', 'alta_solicitada'])
            ->count();

        $estadosInconsistentes = PolizaAsegurado::query()
            ->whereNotNull('persona_alerta_estado')
            ->where('estado', 'activo')
            ->count();

        return response()->json(['data' => [
            'polizas_por_vencer'        => $polizasPorVencer,
            'solicitudes_sin_respuesta' => $solicitudesPendientes,
            'asegurados_sin_persona'    => $aseguradosSinPersona,
            'estados_inconsistentes'    => $estadosInconsistentes,
        ]]);
    }

    /**
     * ADDENDUM 13 Parte C — discrepancias consolidadas de TODAS las pólizas activas.
     * Drilldown desde los KPIs del dashboard.
     */
    public function discrepanciasGlobales(): JsonResponse
    {
        $polizasActivas = Poliza::query()->where('activa', true)->with('aseguradora:id,nombre')->get()->keyBy('id');
        $polizaIds = $polizasActivas->keys();

        // A — fantasmas (asegurados sin persona) en pólizas activas.
        $sinPersona = PolizaAsegurado::query()
            ->whereIn('poliza_id', $polizaIds)
            ->whereNull('persona_id')
            ->whereIn('estado', ['activo', 'no_matcheado', 'alta_solicitada'])
            ->select(['id', 'poliza_id', 'identificador', 'identificador_tipo', 'nombre_apellido_pdf', 'marca_modelo_pdf', 'estado', 'created_at'])
            ->get()
            ->map(fn ($a) => [
                'asegurado_id'        => $a->id,
                'identificador'       => $a->identificador,
                'identificador_tipo'  => $a->identificador_tipo,
                'nombre_apellido_pdf' => $a->nombre_apellido_pdf,
                'marca_modelo_pdf'    => $a->marca_modelo_pdf,
                'estado'              => $a->estado,
                'antiguedad_dias'     => $a->created_at ? (int) $a->created_at->diffInDays(now()) : null,
                'poliza'              => [
                    'id'                 => $a->poliza_id,
                    'nombre_descriptivo' => $polizasActivas[$a->poliza_id]?->nombre_descriptivo,
                    'aseguradora'        => $polizasActivas[$a->poliza_id]?->aseguradora?->nombre,
                ],
            ]);

        // B — personas activas sin cobertura.
        $sinPoliza = Persona::query()
            ->where('estado_id', \App\Services\Polizas\MatchingService::ESTADO_ACTIVO_ID)
            ->whereDoesntHave('polizasVigentes')
            ->select(['id', 'apellidos', 'nombres', 'cuil', 'patente', 'tipo'])
            ->limit(500)
            ->get()
            ->map(fn ($p) => [
                'persona_id' => $p->id,
                'nombre'     => trim(($p->apellidos ?? '') . ', ' . ($p->nombres ?? '')),
                'cuil'       => $p->cuil,
                'patente'    => $p->patente,
                'perfil'     => $p->tipo,
            ]);

        // C — sugerencias fuzzy pendientes.
        $sugerencias = PolizaAsegurado::query()
            ->whereIn('poliza_id', $polizaIds)
            ->whereNull('persona_id')
            ->whereNotNull('sugerencia_fuzzy_persona_id')
            ->with('sugerenciaFuzzyPersona:id,apellidos,nombres,cuil')
            ->select(['id', 'poliza_id', 'identificador', 'identificador_tipo', 'nombre_apellido_pdf', 'sugerencia_fuzzy_persona_id', 'sugerencia_fuzzy_score'])
            ->orderByDesc('sugerencia_fuzzy_score')
            ->get()
            ->map(function ($a) use ($polizasActivas) {
                $sug = $a->sugerenciaFuzzyPersona;
                return [
                    'asegurado_id'        => $a->id,
                    'identificador'       => $a->identificador,
                    'nombre_apellido_pdf' => $a->nombre_apellido_pdf,
                    'sugerencia'          => $sug ? [
                        'id'     => $sug->id,
                        'nombre' => trim(($sug->apellidos ?? '') . ', ' . ($sug->nombres ?? '')),
                        'cuil'   => $sug->cuil,
                        'score'  => $a->sugerencia_fuzzy_score,
                    ] : null,
                    'poliza'              => [
                        'id'                 => $a->poliza_id,
                        'nombre_descriptivo' => $polizasActivas[$a->poliza_id]?->nombre_descriptivo,
                        'aseguradora'        => $polizasActivas[$a->poliza_id]?->aseguradora?->nombre,
                    ],
                ];
            });

        // D — estados inconsistentes.
        $estadoIncons = PolizaAsegurado::query()
            ->whereIn('poliza_id', $polizaIds)
            ->whereNotNull('persona_alerta_estado')
            ->where('estado', 'activo')
            ->whereNotNull('persona_id')
            ->with('persona:id,apellidos,nombres,cuil,fecha_baja')
            ->select(['id', 'poliza_id', 'identificador', 'persona_id', 'persona_estado_al_matchear', 'persona_alerta_estado'])
            ->get()
            ->map(fn ($a) => [
                'asegurado_id'               => $a->id,
                'identificador'              => $a->identificador,
                'persona_id'                 => $a->persona_id,
                'persona_nombre'             => $a->persona ? trim(($a->persona->apellidos ?? '') . ', ' . ($a->persona->nombres ?? '')) : '—',
                'persona_cuil'               => $a->persona?->cuil,
                'persona_estado_al_matchear' => $a->persona_estado_al_matchear,
                'alerta_estado'              => $a->persona_alerta_estado,
                'persona_fecha_baja'         => $a->persona?->fecha_baja?->toDateString(),
                'poliza'                     => [
                    'id'                 => $a->poliza_id,
                    'nombre_descriptivo' => $polizasActivas[$a->poliza_id]?->nombre_descriptivo,
                    'aseguradora'        => $polizasActivas[$a->poliza_id]?->aseguradora?->nombre,
                ],
            ]);

        return response()->json(['data' => [
            'sin_persona'           => $sinPersona->values()->all(),
            'sin_poliza'            => $sinPoliza->values()->all(),
            'sugerencias_fuzzy'     => $sugerencias->values()->all(),
            'estado_inconsistente'  => $estadoIncons->values()->all(),
        ]]);
    }

    /** Bloque C.4 — listado de endosos cargados en una póliza (para tab Endosos). */
    public function endosos(Poliza $poliza): JsonResponse
    {
        $rows = \App\Models\PolizaEndoso::query()
            ->where('poliza_id', $poliza->id)
            ->orderByDesc('fecha_emision')
            ->orderByDesc('id')
            ->get();
        return response()->json(['data' => $rows]);
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

    /**
     * Bloque D.2 — listado de certificados de pólizas del proveedor.
     *
     * Devuelve los archivos con `categoria='poliza_individual'` asociados a la
     * persona, con metadata para que la UI los agrupe en un bloque dedicado en
     * la sección de pólizas. Cada certificado vincula a un asegurado activo
     * para poder dispararle "compartir con distribuidor".
     */
    public function certificadosPolizas(Persona $persona): JsonResponse
    {
        $archivos = \App\Models\Archivo::query()
            ->where('persona_id', $persona->id)
            ->where('categoria', \App\Services\Polizas\PolizaCertificadoIndividualService::CATEGORIA)
            ->whereNull('deleted_at')
            ->orderByDesc('created_at')
            ->get(['id', 'nombre_original', 'ruta', 'download_url', 'created_at', 'mime', 'size']);

        // Resolver el asegurado correspondiente a cada certificado para que la UI
        // pueda mostrar contexto y permitir "Compartir con distribuidor".
        $aseguradoPorPersona = PolizaAsegurado::query()
            ->where('persona_id', $persona->id)
            ->where('estado', 'activo')
            ->with('poliza:id,nombre_descriptivo,numero_poliza,aseguradora_id', 'poliza.aseguradora:id,nombre')
            ->get()
            ->keyBy('poliza_id');

        $rows = $archivos->map(function ($a) use ($aseguradoPorPersona) {
            // Heurística: linkear cada archivo a un asegurado activo cualquiera (la
            // mayoría de los proveedores tienen 1-2 pólizas activas). En caso de
            // ambigüedad, el frontend muestra todos los asegurados disponibles.
            $primero = $aseguradoPorPersona->first();
            return [
                'id'              => $a->id,
                'nombre_original' => $a->nombre_original,
                'download_url'    => $a->download_url,
                'created_at'      => $a->created_at?->toIso8601String(),
                'tamano_kb'       => $a->size ? (int) round($a->size / 1024) : null,
                'asegurado_id'    => $primero?->id,
                'poliza_nombre'   => $primero?->poliza?->nombre_descriptivo,
                'aseguradora'     => $primero?->poliza?->aseguradora?->nombre,
            ];
        });

        return response()->json(['data' => $rows->values()]);
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
            ])
            // ADDENDUM 10 Parte B — count + último comentario para el badge.
            ->withCount('comentarios as comentarios_count')
            ->addSelect([
                'ultimo_comentario' => \App\Models\PolizaAseguradoComentario::query()
                    ->select('comentario')
                    ->whereColumn('asegurado_id', 'polizas_asegurados.id')
                    ->orderByDesc('created_at')
                    ->limit(1),
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
     * ADDENDUM 10 sub-fase 2 — listado enriquecido para pólizas de vehículos.
     *
     * Devuelve cada asegurado titular + sus choferes vinculados con el estado
     * AP de cada uno. Permite renderizar el expand ▼ en el frontend para ver
     * "Pedro Pérez (titular vehículo) → Juan García (chofer, AP MAPFRE OK), Carlos López (chofer, ⚠ Sin AP)".
     *
     * Solo aplica a pólizas con `tipo_asegurado='vehiculo'`. Para AP devolvemos
     * 422 — la lista plana de `asegurados()` ya cubre ese caso.
     *
     * Filtros: hereda los mismos que `asegurados()` (`?estado=`, `?search=`,
     * `?solo_dudosos=`).
     */
    public function aseguradosConChoferes(Request $request, Poliza $poliza): JsonResponse
    {
        if ($poliza->tipo_asegurado !== 'vehiculo') {
            return response()->json([
                'message' => 'Este endpoint solo aplica a pólizas de vehículos.',
            ], 422);
        }

        $query = PolizaAsegurado::query()
            ->where('poliza_id', $poliza->id)
            ->with([
                'persona:id,apellidos,nombres,cuil,patente,estado_id,fecha_baja,es_solicitud,aprobado',
                'sugerenciaFuzzyPersona:id,apellidos,nombres,cuil',
                // Choferes activos del titular + sus pólizas AP activas (1-2 niveles).
                'persona.relacionesComoTitular' => function ($q) {
                    $q->with([
                        'chofer:id,apellidos,nombres,cuil,patente,estado_id,fecha_baja,es_solicitud,aprobado,email,telefono',
                        // Para cada chofer: solo sus polizas_asegurados con ramo AP activos.
                        'chofer.polizasVigentes' => function ($qp) {
                            $qp->whereHas('poliza', fn ($qq) => $qq->where('ramo', 'accidentes_personales'));
                        },
                    ]);
                },
            ])
            ->withCount('comentarios as comentarios_count')
            ->addSelect([
                'ultimo_comentario' => \App\Models\PolizaAseguradoComentario::query()
                    ->select('comentario')
                    ->whereColumn('asegurado_id', 'polizas_asegurados.id')
                    ->orderByDesc('created_at')
                    ->limit(1),
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
                    'id'     => $a->sugerenciaFuzzyPersona->id,
                    'nombre' => self::nombreCompletoPersona($a->sugerenciaFuzzyPersona),
                    'cuil'   => $a->sugerenciaFuzzyPersona->cuil,
                    'score'  => $a->sugerencia_fuzzy_score,
                ] : null;

                // Construir el array de choferes a partir de las relaciones del titular.
                $choferes = [];
                if ($a->persona && $a->persona->relacionesComoTitular) {
                    foreach ($a->persona->relacionesComoTitular as $rel) {
                        if (!$rel->chofer) continue;
                        $choferes[] = [
                            'relacion_id'        => $rel->id,
                            'persona_id'         => $rel->chofer->id,
                            'nombre_completo'    => trim(($rel->chofer->apellidos ?? '') . ' ' . ($rel->chofer->nombres ?? '')) ?: '—',
                            'cuil'               => $rel->chofer->cuil,
                            'rol'                => $rel->rol,
                            'fecha_vinculacion'  => $rel->fecha_vinculacion?->toDateString(),
                            'estado_persona'     => \App\Services\Polizas\MatchingService::calcularEstadoPersona($rel->chofer),
                            'polizas_ap_activas' => collect($rel->chofer->polizasVigentes ?? [])
                                ->map(fn ($pa) => [
                                    'asegurado_id' => $pa->id,
                                    'poliza_id'    => $pa->poliza_id,
                                    'nombre'       => $pa->poliza?->nombre_descriptivo,
                                    'aseguradora'  => $pa->poliza?->aseguradora?->nombre,
                                ])
                                ->values()
                                ->all(),
                        ];
                    }
                }
                $arr['choferes']           = $choferes;
                $arr['choferes_count']     = count($choferes);
                // Para el filtro "Cobertura completa": titular tiene póliza acá +
                // todos sus choferes tienen ≥1 póliza AP activa.
                $arr['cobertura_completa'] = empty($choferes)
                    ? null   // n/a — no tiene choferes vinculados
                    : !collect($choferes)->contains(fn ($c) => empty($c['polizas_ap_activas']));

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

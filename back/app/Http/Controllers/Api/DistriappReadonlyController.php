<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivoAsesorComercial;
use App\Models\Archivo;
use App\Models\CierreDiario;
use App\Models\Estado;
use App\Models\FileType;
use App\Models\Persona;
use App\Models\PersonaHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DistriappReadonlyController extends Controller
{
    // ── Dashboard: conteos por estado ────────────────────────────────────

    public function dashboard(): JsonResponse
    {
        $baseQuery = fn () => Persona::query()->where(function ($q) {
            $q->whereNull('es_solicitud')->orWhere('es_solicitud', false);
        });

        $estados = Estado::query()->pluck('nombre', 'id');

        $countsByEstado = Persona::query()
            ->select('estado_id', DB::raw('COUNT(*) as total'))
            ->where(function ($q) {
                $q->whereNull('es_solicitud')->orWhere('es_solicitud', false);
            })
            ->groupBy('estado_id')
            ->pluck('total', 'estado_id');

        $activos = 0;
        $preActivos = 0;
        $pausados = 0;
        $noCitados = 0;
        $bajas = 0;
        $sinEstado = (int) ($countsByEstado[null] ?? $countsByEstado[0] ?? 0);
        $otrosEstados = 0;

        foreach ($countsByEstado as $estadoId => $count) {
            if ($estadoId === null || $estadoId === 0) {
                $sinEstado = (int) $count;
                continue;
            }

            $nombre = $this->normalizeEstadoNombre($estados[$estadoId] ?? '');

            if ($nombre === 'activo') {
                $activos = (int) $count;
            } elseif ($nombre === 'pre activo') {
                $preActivos = (int) $count;
            } elseif ($nombre === 'pausado') {
                $pausados = (int) $count;
            } elseif ($nombre === 'no citado') {
                $noCitados = (int) $count;
            } elseif (str_contains($nombre, 'baja')) {
                $bajas += (int) $count;
            } else {
                $otrosEstados += (int) $count;
            }
        }

        // Sin estado incluye estado_id = null
        $sinEstadoFromNull = (int) $baseQuery()
            ->whereNull('estado_id')
            ->count();
        $sinEstado = max($sinEstado, $sinEstadoFromNull);

        return response()->json([
            'data' => [
                'activos' => $activos,
                'preActivos' => $preActivos,
                'pausados' => $pausados,
                'noCitados' => $noCitados,
                'sinEstado' => $sinEstado,
                'bajas' => $bajas,
                'otros' => $otrosEstados,
                'total' => $activos + $preActivos + $pausados + $noCitados + $sinEstado + $bajas + $otrosEstados,
                'updatedAt' => now()->toIso8601String(),
            ],
        ]);
    }

    // ── Listados por estado ─────────────────────────────────────────────

    public function activos(Request $request): JsonResponse
    {
        return $this->listByEstado($request, 'activo');
    }

    public function preActivos(Request $request): JsonResponse
    {
        return $this->listByEstado($request, 'pre activo');
    }

    public function pausados(Request $request): JsonResponse
    {
        return $this->listByEstado($request, 'pausado');
    }

    public function noCitados(Request $request): JsonResponse
    {
        return $this->listByEstado($request, 'no citado');
    }

    public function sinEstado(Request $request): JsonResponse
    {
        $perPage = $this->resolvePerPage($request);

        $paginator = Persona::query()
            ->with(['cliente:id,nombre', 'sucursal:id,nombre', 'estado:id,nombre'])
            ->where(function ($q) {
                $q->whereNull('es_solicitud')->orWhere('es_solicitud', false);
            })
            ->whereNull('estado_id')
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Persona $p) => $this->formatPersona($p)),
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    public function bajas(Request $request): JsonResponse
    {
        $perPage = $this->resolvePerPage($request);

        $bajaEstadoIds = Estado::query()
            ->get()
            ->filter(fn (Estado $e) => str_contains($this->normalizeEstadoNombre($e->nombre), 'baja'))
            ->pluck('id');

        $paginator = Persona::query()
            ->with(['cliente:id,nombre', 'sucursal:id,nombre', 'estado:id,nombre'])
            ->where(function ($q) {
                $q->whereNull('es_solicitud')->orWhere('es_solicitud', false);
            })
            ->whereIn('estado_id', $bajaEstadoIds)
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Persona $p) => $this->formatPersona($p)),
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    // ── Semanas (tendencias) ────────────────────────────────────────────

    public function semanas(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fecha' => ['nullable', 'date'],
            'asesor_comercial' => ['nullable', 'string', 'max:255'],
        ]);

        $query = CierreDiario::query()
            ->select(
                'semana',
                'asesor_comercial',
                DB::raw('COUNT(*) as total_leads'),
                DB::raw("SUM(CASE WHEN LOWER(estatus_lead) = 'no citado' THEN 1 ELSE 0 END) as no_citados"),
                DB::raw("SUM(CASE WHEN LOWER(estatus_lead) != 'no citado' THEN 1 ELSE 0 END) as citados"),
            )
            ->groupBy('semana', 'asesor_comercial')
            ->orderBy('semana')
            ->orderBy('asesor_comercial');

        if (! empty($validated['fecha'])) {
            $query->whereDate('fecha_importacion', $validated['fecha']);
        }

        if (! empty($validated['asesor_comercial'])) {
            $query->where('asesor_comercial', 'like', '%' . $validated['asesor_comercial'] . '%');
        }

        $rows = $query->get();

        // Agrupar por semana
        $porSemana = $rows->groupBy('semana')->map(function ($group, $semana) {
            return [
                'semana' => (int) $semana,
                'totalLeads' => $group->sum('total_leads'),
                'noCitados' => $group->sum('no_citados'),
                'citados' => $group->sum('citados'),
                'porAsesor' => $group->map(fn ($row) => [
                    'asesorComercial' => $row->asesor_comercial ?: '(sin asesor)',
                    'totalLeads' => (int) $row->total_leads,
                    'noCitados' => (int) $row->no_citados,
                    'citados' => (int) $row->citados,
                ])->values(),
            ];
        })->values();

        return response()->json([
            'data' => $porSemana,
            'meta' => [
                'fecha' => $validated['fecha'] ?? null,
                'asesorComercial' => $validated['asesor_comercial'] ?? null,
                'updatedAt' => now()->toIso8601String(),
            ],
        ]);
    }

    // ── Cierres diarios ─────────────────────────────────────────────────

    public function cierresDiarios(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fecha' => ['nullable', 'date'],
            'asesor_comercial' => ['nullable', 'string', 'max:255'],
            'sucursal' => ['nullable', 'string', 'max:255'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = CierreDiario::query()->orderByDesc('fecha_importacion')->orderBy('id');

        if (! empty($validated['fecha'])) {
            $query->whereDate('fecha_importacion', $validated['fecha']);
        }

        if (! empty($validated['asesor_comercial'])) {
            $query->where('asesor_comercial', 'like', '%' . $validated['asesor_comercial'] . '%');
        }

        if (! empty($validated['sucursal'])) {
            $query->where('sucursal', $validated['sucursal']);
        }

        $perPage = (int) ($validated['per_page'] ?? 200);
        $paginator = $query->paginate($perPage, ['*'], 'page', $validated['page'] ?? 1);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (CierreDiario $c) => $this->formatCierre($c)),
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    public function cierresFechas(): JsonResponse
    {
        $fechas = CierreDiario::query()
            ->select('fecha_importacion')
            ->distinct()
            ->orderByDesc('fecha_importacion')
            ->pluck('fecha_importacion')
            ->map(fn ($date) => $date instanceof \Illuminate\Support\Carbon ? $date->toDateString() : (string) $date)
            ->values();

        return response()->json(['data' => $fechas]);
    }

    // ── Documentación de una persona ───────────────────────────────────

    public function personaDocumentos(Request $request, int $personaId): JsonResponse
    {
        $persona = Persona::find($personaId);

        if (! $persona) {
            return response()->json(['error' => 'Persona no encontrada'], 404);
        }

        $query = Archivo::query()
            ->where('persona_id', $personaId)
            ->with('tipo')
            ->whereNull('deleted_at')
            ->where(function ($q) {
                $q->whereNull('es_pendiente')->orWhere('es_pendiente', false);
            })
            ->orderByDesc('created_at');

        $perPage = $this->resolvePerPage($request);
        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Archivo $a) => $this->formatArchivo($a)),
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    // ── Documentos vencidos ─────────────────────────────────────────────

    public function documentosVencidos(Request $request): JsonResponse
    {
        $perPage = $this->resolvePerPage($request);

        $paginator = Archivo::query()
            ->with(['persona:id,apellidos,nombres,cuil', 'tipo'])
            ->whereNull('deleted_at')
            ->whereNotNull('fecha_vencimiento')
            ->whereDate('fecha_vencimiento', '<', now())
            ->orderBy('fecha_vencimiento')
            ->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(function (Archivo $a) {
                $base = $this->formatArchivo($a);
                $base['personaId'] = $a->persona_id;
                $base['personaNombre'] = $a->persona
                    ? trim($a->persona->apellidos . ' ' . $a->persona->nombres)
                    : null;
                $base['personaCuil'] = $a->persona?->cuil;

                return $base;
            }),
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    // ── Vencimientos (próximos + ya vencidos) ─────────────────────────

    public function vencimientos(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'dias' => ['nullable', 'integer', 'min:0', 'max:365'],
            'estado' => ['nullable', 'string'],  // vencido, por_vencer, todos
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        $dias = (int) ($validated['dias'] ?? 30);
        $estado = $validated['estado'] ?? 'todos';
        $perPage = $this->resolvePerPage($request);

        $query = Archivo::query()
            ->with(['persona:id,apellidos,nombres,cuil,estado_id', 'persona.estado:id,nombre', 'tipo'])
            ->whereNull('deleted_at')
            ->whereNotNull('fecha_vencimiento');

        if ($estado === 'vencido') {
            $query->whereDate('fecha_vencimiento', '<', now());
        } elseif ($estado === 'por_vencer') {
            $query->whereDate('fecha_vencimiento', '>=', now())
                ->whereDate('fecha_vencimiento', '<=', now()->addDays($dias));
        } else {
            // todos: vencidos + por vencer en los próximos N días
            $query->whereDate('fecha_vencimiento', '<=', now()->addDays($dias));
        }

        $paginator = $query->orderBy('fecha_vencimiento')->paginate($perPage);

        $items = collect($paginator->items())->map(function (Archivo $a) {
            $base = $this->formatArchivo($a);
            $base['personaId'] = $a->persona_id;
            $base['personaNombre'] = $a->persona
                ? trim($a->persona->apellidos . ' ' . $a->persona->nombres)
                : null;
            $base['personaCuil'] = $a->persona?->cuil;
            $base['personaEstado'] = $a->persona?->estado?->nombre;
            $base['diasParaVencer'] = $a->fecha_vencimiento
                ? (int) now()->startOfDay()->diffInDays($a->fecha_vencimiento, false)
                : null;

            return $base;
        });

        // Resumen
        $vencidos = $items->filter(fn ($i) => ($i['diasParaVencer'] ?? 0) < 0)->count();
        $porVencer = $items->filter(fn ($i) => ($i['diasParaVencer'] ?? 0) >= 0)->count();

        return response()->json([
            'data' => $items->values(),
            'resumen' => [
                'vencidos' => $vencidos,
                'porVencer' => $porVencer,
                'total' => $paginator->total(),
                'diasConsultados' => $dias,
            ],
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    // ── Tipos de documentos ─────────────────────────────────────────────

    public function tiposDocumento(): JsonResponse
    {
        $tipos = FileType::query()
            ->whereNull('deleted_at')
            ->orderBy('nombre')
            ->get()
            ->map(fn (FileType $t) => [
                'id' => $t->id,
                'nombre' => $t->nombre,
                'vence' => (bool) $t->vence,
            ]);

        return response()->json(['data' => $tipos]);
    }

    // ── Historial de cambios de una persona ─────────────────────────────

    public function personaHistorial(int $personaId): JsonResponse
    {
        $persona = Persona::find($personaId);

        if (! $persona) {
            return response()->json(['error' => 'Persona no encontrada'], 404);
        }

        $historial = PersonaHistory::query()
            ->where('persona_id', $personaId)
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn (PersonaHistory $h) => [
                'id' => $h->id,
                'autor' => $h->user?->name,
                'descripcion' => $h->description,
                'cambios' => $h->changes,
                'fecha' => $h->created_at?->toIso8601String(),
                'fechaLabel' => $h->created_at?->format('d/m/Y H:i'),
            ]);

        return response()->json([
            'data' => $historial,
            'meta' => [
                'personaId' => $personaId,
                'personaNombre' => trim($persona->apellidos . ' ' . $persona->nombres),
                'total' => $historial->count(),
            ],
        ]);
    }

    // ── Buscar persona por CUIL o nombre ────────────────────────────────

    public function buscarPersona(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:3', 'max:255'],
        ]);

        $q = $validated['q'];

        $results = Persona::query()
            ->with(['estado:id,nombre', 'cliente:id,nombre', 'sucursal:id,nombre'])
            ->where(function ($query) {
                $query->whereNull('es_solicitud')->orWhere('es_solicitud', false);
            })
            ->where(function ($query) use ($q) {
                $query->where('cuil', 'like', "%{$q}%")
                    ->orWhere('apellidos', 'like', "%{$q}%")
                    ->orWhere('nombres', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%")
                    ->orWhere('patente', 'like', "%{$q}%");
            })
            ->orderByDesc('id')
            ->limit(20)
            ->get()
            ->map(fn (Persona $p) => $this->formatPersona($p));

        return response()->json(['data' => $results]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private function listByEstado(Request $request, string $estadoNormalized): JsonResponse
    {
        $perPage = $this->resolvePerPage($request);

        $estadoIds = Estado::query()
            ->get()
            ->filter(fn (Estado $e) => $this->normalizeEstadoNombre($e->nombre) === $estadoNormalized)
            ->pluck('id');

        $paginator = Persona::query()
            ->with(['cliente:id,nombre', 'sucursal:id,nombre', 'estado:id,nombre'])
            ->where(function ($q) {
                $q->whereNull('es_solicitud')->orWhere('es_solicitud', false);
            })
            ->whereIn('estado_id', $estadoIds)
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Persona $p) => $this->formatPersona($p)),
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    private function formatPersona(Persona $persona): array
    {
        return [
            'id' => $persona->id,
            'apellidos' => $persona->apellidos,
            'nombres' => $persona->nombres,
            'cuil' => $persona->cuil,
            'telefono' => $persona->telefono,
            'email' => $persona->email,
            'patente' => $persona->patente,
            'estado' => $persona->estado?->nombre,
            'cliente' => $persona->cliente?->nombre,
            'sucursal' => $persona->sucursal?->nombre,
            'fechaAlta' => $persona->fecha_alta ? (string) $persona->fecha_alta : null,
            'fechaBaja' => $persona->fecha_baja ? (string) $persona->fecha_baja : null,
            'aprobado' => (bool) $persona->aprobado,
            'createdAt' => $persona->created_at?->toIso8601String(),
        ];
    }

    private function formatCierre(CierreDiario $cierre): array
    {
        return [
            'id' => $cierre->id,
            'fechaImportacion' => $cierre->fecha_importacion?->toDateString(),
            'fechaLead' => $cierre->fecha_lead?->toDateString(),
            'leadId' => $cierre->lead_id,
            'contacto' => $cierre->contacto,
            'estatusLead' => $cierre->estatus_lead,
            'etiquetasLead' => $cierre->etiquetas_lead,
            'sucursal' => $cierre->sucursal,
            'vehiculo' => $cierre->vehiculo,
            'empresa' => $cierre->empresa,
            'embudo' => $cierre->embudo,
            'nombreDistribuidor' => $cierre->nombre_distribuidor,
            'asesorComercial' => $cierre->asesor_comercial,
            'mes' => $cierre->mes,
            'semana' => $cierre->semana,
            'dia' => $cierre->dia,
        ];
    }

    private function formatArchivo(Archivo $archivo): array
    {
        return [
            'id' => $archivo->id,
            'nombreOriginal' => $archivo->nombre_original,
            'tipoDocumento' => $archivo->tipo?->nombre,
            'mime' => $archivo->mime,
            'size' => $archivo->size,
            'fechaVencimiento' => $archivo->fecha_vencimiento?->toDateString(),
            'vencido' => $archivo->fecha_vencimiento && $archivo->fecha_vencimiento->isPast(),
            'enviada' => (bool) $archivo->enviada,
            'recibido' => (bool) $archivo->recibido,
            'pagado' => (bool) $archivo->pagado,
            'createdAt' => $archivo->created_at?->toIso8601String(),
        ];
    }

    private function normalizeEstadoNombre(?string $nombre): string
    {
        if ($nombre === null || trim($nombre) === '') {
            return '';
        }

        return mb_strtolower(
            trim(
                str_replace(['-', '_'], ' ', $nombre)
            )
        );
    }

    private function resolvePerPage(Request $request): int
    {
        $perPage = (int) $request->query('per_page', 100);

        return max(1, min(500, $perPage));
    }

    private function paginationMeta($paginator): array
    {
        return [
            'total' => $paginator->total(),
            'perPage' => $paginator->perPage(),
            'currentPage' => $paginator->currentPage(),
            'lastPage' => $paginator->lastPage(),
        ];
    }
}

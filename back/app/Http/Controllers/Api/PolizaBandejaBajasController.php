<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Persona;
use App\Models\PolizaAsegurado;
use App\Models\PolizaSolicitudBajaPendiente;
use App\Services\Polizas\BandejaBajasService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ADDENDUM 15 Bloque 1 — endpoints de la bandeja de bajas pendientes.
 *
 *   GET    /api/polizas/bandeja-bajas-pendientes                    listar (filtros)
 *   POST   /api/polizas/bandeja-bajas-pendientes                    crear desde Proveedor
 *   GET    /api/polizas/bandeja-bajas-pendientes/{pendiente}        detalle
 *   POST   /api/polizas/bandeja-bajas-pendientes/{pendiente}/procesar
 *   POST   /api/polizas/bandeja-bajas-pendientes/{pendiente}/rechazar
 *   POST   /api/polizas/bandeja-bajas-pendientes/{pendiente}/cancelar
 */
class PolizaBandejaBajasController extends Controller
{
    public function __construct(private readonly BandejaBajasService $service)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $q = PolizaSolicitudBajaPendiente::query()
            ->with([
                'persona:id,apellidos,nombres,cuil,patente,cliente_id,sucursal_id,estado_id',
                'persona.cliente:id,nombre',
                'persona.sucursal:id,nombre',
                'solicitadaPor:id,name,email',
                'procesadaPor:id,name,email',
            ])
            ->orderByDesc('fecha_solicitud');

        $estado = $request->query('estado', 'pendiente');
        if ($estado !== 'todos') {
            $q->where('estado', $estado);
        }
        if ($clienteId = $request->query('cliente_id')) {
            $q->whereHas('persona', fn ($qp) => $qp->where('cliente_id', $clienteId));
        }
        if ($sucId = $request->query('sucursal_id')) {
            $q->whereHas('persona', fn ($qp) => $qp->where('sucursal_id', $sucId));
        }
        if ($search = trim((string) $request->query('search', ''))) {
            $like = '%' . str_replace('%', '\\%', $search) . '%';
            $q->whereHas('persona', fn ($qp) => $qp
                ->where('apellidos', 'LIKE', $like)
                ->orWhere('nombres', 'LIKE', $like)
                ->orWhere('cuil', 'LIKE', $like)
                ->orWhere('patente', 'LIKE', $like));
        }

        $rows = $q->limit((int) min($request->query('limit', 500), 2000))
            ->get()
            ->map(fn ($p) => $this->serializar($p));

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'persona_id'              => ['required', 'integer', 'exists:personas,id'],
            'motivo_baja'             => ['required', 'string', 'min:3'],
            'polizas_sugeridas'       => ['nullable', 'array'],
            'polizas_sugeridas.*'     => ['integer', 'exists:polizas,id'],
            'comentarios_adicionales' => ['nullable', 'string'],
        ]);

        $persona = Persona::findOrFail($data['persona_id']);
        $pendiente = $this->service->crearDesdeProveedor(
            persona:           $persona,
            solicitante:       $request->user(),
            motivo:            $data['motivo_baja'],
            polizasSugeridas:  $data['polizas_sugeridas'] ?? [],
            comentarios:       $data['comentarios_adicionales'] ?? null,
        );

        return response()->json(['data' => $this->serializar($pendiente->fresh()->load([
            'persona:id,apellidos,nombres,cuil',
            'solicitadaPor:id,name,email',
        ]))], 201);
    }

    public function show(PolizaSolicitudBajaPendiente $pendiente): JsonResponse
    {
        $pendiente->load([
            'persona:id,apellidos,nombres,cuil,patente,fecha_alta,fecha_baja,estado_id,cliente_id,sucursal_id',
            'persona.cliente:id,nombre',
            'persona.sucursal:id,nombre',
            'solicitadaPor:id,name,email',
            'procesadaPor:id,name,email',
        ]);

        // Cargar pólizas activas vigentes de la persona para que el admin elija cuáles dar de baja.
        $aseguradosActivos = PolizaAsegurado::query()
            ->where('persona_id', $pendiente->persona_id)
            ->whereIn('estado', ['activo', 'alta_solicitada'])
            ->with('poliza:id,nombre_descriptivo,numero_poliza,aseguradora_id,ramo,tipo_asegurado',
                   'poliza.aseguradora:id,nombre')
            ->get();

        $polizasActivas = $aseguradosActivos->groupBy('poliza_id')->map(function ($items) {
            $primero = $items->first();
            return [
                'poliza_id'         => $primero->poliza_id,
                'poliza_nombre'     => $primero->poliza?->nombre_descriptivo,
                'numero_poliza'     => $primero->poliza?->numero_poliza,
                'aseguradora'       => $primero->poliza?->aseguradora?->nombre,
                'ramo'              => $primero->poliza?->ramo,
                'tipo_asegurado'    => $primero->poliza?->tipo_asegurado,
                'asegurados_count'  => $items->count(),
                'sugerida'          => in_array($primero->poliza_id, $items->first()->poliza ? (array) ($items->first()->poliza_id) : [], true),
            ];
        })->values()->all();

        // Marcar las sugeridas que vienen del JSON del payload original.
        $sugeridas = $pendiente->polizas_sugeridas ?? [];
        $polizasActivas = array_map(function ($p) use ($sugeridas) {
            $p['sugerida'] = in_array($p['poliza_id'], $sugeridas, true);
            return $p;
        }, $polizasActivas);

        $payload = $this->serializar($pendiente);
        $payload['polizas_activas'] = $polizasActivas;
        return response()->json(['data' => $payload]);
    }

    public function procesar(Request $request, PolizaSolicitudBajaPendiente $pendiente): JsonResponse
    {
        $data = $request->validate([
            'polizas_ids'   => ['required', 'array', 'min:1'],
            'polizas_ids.*' => ['integer', 'exists:polizas,id'],
            'comentarios'   => ['nullable', 'string'],
        ]);
        @set_time_limit(120);

        $resultado = $this->service->procesar(
            pendiente:   $pendiente,
            admin:       $request->user(),
            polizasIds:  $data['polizas_ids'],
            comentarios: $data['comentarios'] ?? null,
        );

        return response()->json(['data' => $resultado]);
    }

    public function rechazar(Request $request, PolizaSolicitudBajaPendiente $pendiente): JsonResponse
    {
        $data = $request->validate([
            'motivo_rechazo' => ['required', 'string', 'min:3'],
        ]);
        $this->service->rechazar($pendiente, $request->user(), $data['motivo_rechazo']);
        return response()->json(['data' => $this->serializar($pendiente->fresh())]);
    }

    public function cancelar(Request $request, PolizaSolicitudBajaPendiente $pendiente): JsonResponse
    {
        $this->service->cancelar($pendiente, $request->user());
        return response()->json(['data' => $this->serializar($pendiente->fresh())]);
    }

    private function serializar(PolizaSolicitudBajaPendiente $p): array
    {
        return [
            'id'                    => $p->id,
            'fecha_solicitud'       => $p->fecha_solicitud?->toIso8601String(),
            'motivo_baja'           => $p->motivo_baja,
            'comentarios_adicionales' => $p->comentarios_adicionales,
            'polizas_sugeridas'     => $p->polizas_sugeridas ?? [],
            'estado'                => $p->estado,
            'procesada_en'          => $p->procesada_en?->toIso8601String(),
            'polizas_dadas_de_baja' => $p->polizas_dadas_de_baja ?? [],
            'motivo_rechazo'        => $p->motivo_rechazo,
            'persona'               => $p->persona ? [
                'id'        => $p->persona->id,
                'nombre'    => trim(($p->persona->apellidos ?? '') . ', ' . ($p->persona->nombres ?? '')),
                'cuil'      => $p->persona->cuil,
                'patente'   => $p->persona->patente,
                'fecha_alta'=> $p->persona->fecha_alta?->toDateString(),
                'cliente'   => $p->persona->cliente?->nombre,
                'sucursal'  => $p->persona->sucursal?->nombre,
                'estado_id' => $p->persona->estado_id,
            ] : null,
            'solicitada_por' => $p->solicitadaPor?->only(['id', 'name', 'email']),
            'procesada_por'  => $p->procesadaPor?->only(['id', 'name', 'email']),
        ];
    }
}

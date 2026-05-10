<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PersonaRelacionChofer;
use App\Models\PolizaAsegurado;
use App\Models\PolizaClausulaAplicada;
use App\Models\PolizaSolicitud;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ADDENDUM 13 Parte B — log unificado de movimientos del módulo Pólizas.
 *
 * 4 sub-endpoints según la pestaña que abra el frontend:
 *   - GET /api/polizas/auditoria/solicitudes      altas/bajas con filtros
 *   - GET /api/polizas/auditoria/eliminaciones    asegurados eliminados
 *   - GET /api/polizas/auditoria/choferes         vinculaciones titular↔chofer
 *   - GET /api/polizas/auditoria/clausulas        cláusulas aplicadas
 *
 * Permiso: `puede_ver_auditoria` (default true).
 */
class PolizaAuditoriaController extends Controller
{
    public function solicitudes(Request $request): JsonResponse
    {
        $q = PolizaSolicitud::query()
            ->with([
                'poliza:id,nombre_descriptivo,numero_poliza,aseguradora_id,dias_alerta_sin_respuesta',
                'poliza.aseguradora:id,nombre',
                'administrativo:id,name,email',
                'asegurados.asegurado:id,identificador,identificador_tipo,nombre_apellido_pdf,persona_id',
                'asegurados.asegurado.persona:id,apellidos,nombres,cuil',
            ])
            ->orderByDesc('fecha_solicitud');

        $this->aplicarFiltrosSolicitudes($q, $request);

        $rows = $q->limit($this->limite($request))->get()->map(function ($s) {
            $asegurados = collect($s->asegurados ?? [])
                ->map(fn ($sa) => $sa->asegurado ? [
                    'identificador' => $sa->asegurado->identificador,
                    'nombre' => $sa->asegurado->persona
                        ? trim(($sa->asegurado->persona->apellidos ?? '') . ' ' . ($sa->asegurado->persona->nombres ?? ''))
                        : ($sa->asegurado->nombre_apellido_pdf ?? '—'),
                    'cuil' => $sa->asegurado->persona?->cuil,
                ] : null)
                ->filter()
                ->values()
                ->all();

            $diasEnviado = $s->enviado_en
                ? (int) $s->enviado_en->diffInDays(now())
                : null;
            $umbral = $s->poliza?->dias_alerta_sin_respuesta ?? 7;

            return [
                'id'                => $s->id,
                'fecha_solicitud'   => $s->fecha_solicitud?->toIso8601String(),
                'tipo'              => $s->tipo,
                'estado'            => $s->estado,
                'admin'             => $s->administrativo ? [
                    'id'    => $s->administrativo->id,
                    'name'  => $s->administrativo->name,
                    'email' => $s->administrativo->email,
                ] : null,
                'poliza'            => $s->poliza ? [
                    'id'                 => $s->poliza->id,
                    'nombre_descriptivo' => $s->poliza->nombre_descriptivo,
                    'numero_poliza'      => $s->poliza->numero_poliza,
                    'aseguradora'        => $s->poliza->aseguradora?->nombre,
                ] : null,
                'enviado_en'              => $s->enviado_en?->toIso8601String(),
                'respuesta_recibida_en'   => $s->respuesta_recibida_en?->toIso8601String(),
                'dias_enviado'            => $diasEnviado,
                'sin_respuesta_alerta'    => $s->estado === 'enviado' && $diasEnviado !== null && $diasEnviado >= $umbral,
                'asegurados_count'        => count($asegurados),
                'asegurados'              => $asegurados,
                'tipo_clausula_global'    => $s->tipo_clausula_global ?? null,
                'grupo_baja_completa_id'  => $s->grupo_baja_completa_id ?? null,
            ];
        });

        return response()->json(['data' => $rows]);
    }

    public function eliminaciones(Request $request): JsonResponse
    {
        $q = PolizaAsegurado::query()
            ->soloEliminados()
            ->with([
                'poliza:id,nombre_descriptivo,numero_poliza,aseguradora_id',
                'poliza.aseguradora:id,nombre',
                'persona:id,apellidos,nombres,cuil',
            ])
            ->orderByDesc('eliminado_en');

        if ($desde = $request->query('fecha_desde')) {
            $q->where('eliminado_en', '>=', $desde);
        }
        if ($hasta = $request->query('fecha_hasta')) {
            $q->where('eliminado_en', '<=', $hasta . ' 23:59:59');
        }
        if ($adminId = $request->query('admin_user_id')) {
            $q->where('eliminado_por_user_id', $adminId);
        }
        if ($search = trim((string) $request->query('search', ''))) {
            $like = '%' . str_replace('%', '\\%', $search) . '%';
            $q->where(function ($qq) use ($like) {
                $qq->where('identificador', 'LIKE', $like)
                   ->orWhere('nombre_apellido_pdf', 'LIKE', $like)
                   ->orWhere('motivo_eliminacion', 'LIKE', $like)
                   ->orWhereHas('persona', fn ($qp) => $qp
                       ->where('apellidos', 'LIKE', $like)
                       ->orWhere('nombres', 'LIKE', $like));
            });
        }

        $userIds = $q->pluck('eliminado_por_user_id')->filter()->unique();
        $users = \App\Models\User::whereIn('id', $userIds)->get(['id', 'name', 'email'])->keyBy('id');

        $rows = $q->limit($this->limite($request))->get()->map(fn ($a) => [
            'id'                  => $a->id,
            'eliminado_en'        => $a->eliminado_en?->toIso8601String(),
            'motivo'              => $a->motivo_eliminacion,
            'admin'               => $a->eliminado_por_user_id
                ? $users->get($a->eliminado_por_user_id)?->only(['id', 'name', 'email'])
                : null,
            'identificador'       => $a->identificador,
            'identificador_tipo'  => $a->identificador_tipo,
            'nombre'              => $a->persona
                ? trim(($a->persona->apellidos ?? '') . ' ' . ($a->persona->nombres ?? ''))
                : ($a->nombre_apellido_pdf ?? '—'),
            'cuil'                => $a->persona?->cuil,
            'poliza'              => $a->poliza ? [
                'id'                 => $a->poliza->id,
                'nombre_descriptivo' => $a->poliza->nombre_descriptivo,
                'numero_poliza'      => $a->poliza->numero_poliza,
                'aseguradora'        => $a->poliza->aseguradora?->nombre,
            ] : null,
        ]);

        return response()->json(['data' => $rows]);
    }

    public function choferes(Request $request): JsonResponse
    {
        $q = PersonaRelacionChofer::query()
            ->with([
                'titular:id,apellidos,nombres,cuil',
                'chofer:id,apellidos,nombres,cuil',
                'creadoPor:id,name,email',
            ])
            ->orderByDesc('created_at');

        if ($desde = $request->query('fecha_desde')) {
            $q->where('created_at', '>=', $desde);
        }
        if ($hasta = $request->query('fecha_hasta')) {
            $q->where('created_at', '<=', $hasta . ' 23:59:59');
        }
        if ($estadoFiltro = $request->query('estado')) {
            // 'activo' / 'inactivo'.
            $q->where('activo', $estadoFiltro === 'activo');
        }
        if ($search = trim((string) $request->query('search', ''))) {
            $like = '%' . str_replace('%', '\\%', $search) . '%';
            $q->where(function ($qq) use ($like) {
                $qq->whereHas('titular', fn ($qt) => $qt->where('apellidos', 'LIKE', $like)->orWhere('nombres', 'LIKE', $like))
                   ->orWhereHas('chofer', fn ($qc) => $qc->where('apellidos', 'LIKE', $like)->orWhere('nombres', 'LIKE', $like));
            });
        }

        $rows = $q->limit($this->limite($request))->get()->map(fn ($r) => [
            'id'                   => $r->id,
            'created_at'           => $r->created_at?->toIso8601String(),
            'fecha_vinculacion'    => $r->fecha_vinculacion?->toDateString(),
            'fecha_desvinculacion' => $r->fecha_desvinculacion?->toDateString(),
            'activo'               => (bool) $r->activo,
            'rol'                  => $r->rol,
            'creado_por'           => $r->creadoPor?->only(['id', 'name', 'email']),
            'titular'              => $r->titular ? [
                'id'   => $r->titular->id,
                'nombre' => trim(($r->titular->apellidos ?? '') . ' ' . ($r->titular->nombres ?? '')),
                'cuil' => $r->titular->cuil,
            ] : null,
            'chofer'               => $r->chofer ? [
                'id'   => $r->chofer->id,
                'nombre' => trim(($r->chofer->apellidos ?? '') . ' ' . ($r->chofer->nombres ?? '')),
                'cuil' => $r->chofer->cuil,
            ] : null,
        ]);

        return response()->json(['data' => $rows]);
    }

    public function clausulas(Request $request): JsonResponse
    {
        $q = PolizaClausulaAplicada::query()
            ->with([
                'poliza:id,nombre_descriptivo,numero_poliza,aseguradora_id',
                'poliza.aseguradora:id,nombre',
                'clausula:id,nombre_corto,alias,cuit_titular,razon_social_titular',
            ])
            ->orderByDesc('aplicada_desde');

        if ($desde = $request->query('fecha_desde')) {
            $q->where('aplicada_desde', '>=', $desde);
        }
        if ($hasta = $request->query('fecha_hasta')) {
            $q->where('aplicada_desde', '<=', $hasta);
        }
        if ($search = trim((string) $request->query('search', ''))) {
            $like = '%' . str_replace('%', '\\%', $search) . '%';
            $q->where(function ($qq) use ($like) {
                $qq->whereHas('clausula', fn ($qc) => $qc
                    ->where('nombre_corto', 'LIKE', $like)
                    ->orWhere('razon_social_titular', 'LIKE', $like));
            });
        }

        $rows = $q->limit($this->limite($request))->get()->map(fn ($a) => [
            'id'              => $a->id,
            'aplicada_desde'  => $a->aplicada_desde?->toDateString(),
            'aplicada_hasta'  => $a->aplicada_hasta?->toDateString(),
            'tipo_aplicacion' => $a->tipo_aplicacion,
            'poliza'          => $a->poliza ? [
                'id'                 => $a->poliza->id,
                'nombre_descriptivo' => $a->poliza->nombre_descriptivo,
                'numero_poliza'      => $a->poliza->numero_poliza,
                'aseguradora'        => $a->poliza->aseguradora?->nombre,
            ] : null,
            'clausula'        => $a->clausula ? [
                'id'                   => $a->clausula->id,
                'nombre_corto'         => $a->clausula->nombre_corto,
                'alias'                => $a->clausula->alias,
                'cuit_titular'         => $a->clausula->cuit_titular,
                'razon_social_titular' => $a->clausula->razon_social_titular,
            ] : null,
        ]);

        return response()->json(['data' => $rows]);
    }

    private function aplicarFiltrosSolicitudes(\Illuminate\Database\Eloquent\Builder $q, Request $request): void
    {
        if ($tipo = $request->query('tipo'))           $q->where('tipo', $tipo);
        if ($estado = $request->query('estado'))       $q->where('estado', $estado);
        if ($pid = $request->query('poliza_id'))       $q->where('poliza_id', $pid);
        if ($asegId = $request->query('aseguradora_id')) {
            $q->whereHas('poliza', fn ($qp) => $qp->where('aseguradora_id', $asegId));
        }
        if ($adminId = $request->query('admin_user_id')) {
            $q->where('administrativo_user_id', $adminId);
        }
        if ($desde = $request->query('fecha_desde')) {
            $q->where('fecha_solicitud', '>=', $desde);
        }
        if ($hasta = $request->query('fecha_hasta')) {
            $q->where('fecha_solicitud', '<=', $hasta . ' 23:59:59');
        }
        if ($search = trim((string) $request->query('search', ''))) {
            $like = '%' . str_replace('%', '\\%', $search) . '%';
            $q->where(function ($qq) use ($like) {
                $qq->where('asunto', 'LIKE', $like)
                   ->orWhereHas('asegurados.asegurado', fn ($qa) => $qa
                       ->where('identificador', 'LIKE', $like)
                       ->orWhere('nombre_apellido_pdf', 'LIKE', $like))
                   ->orWhereHas('asegurados.asegurado.persona', fn ($qp) => $qp
                       ->where('apellidos', 'LIKE', $like)
                       ->orWhere('nombres', 'LIKE', $like));
            });
        }
    }

    private function limite(Request $request): int
    {
        $limit = (int) $request->query('limit', 500);
        return max(1, min($limit, 2000));
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Persona;
use App\Models\PersonaRelacionChofer;
use App\Models\PolizaAsegurado;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ADDENDUM 10 Parte C — vínculos titular ↔ chofer.
 *
 *  - GET    /api/personal/{persona}/choferes      → choferes de un titular
 *                                                    (con sus pólizas AP activas).
 *  - GET    /api/personal/{persona}/titulares     → titulares para los que la
 *                                                    persona maneja como chofer.
 *  - POST   /api/personal/{persona}/choferes      → vincular chofer existente.
 *  - PUT    /api/personal/relacion-chofer/{rel}   → editar (rol, notas, fechas).
 *  - DELETE /api/personal/relacion-chofer/{rel}   → soft-disable (activo=false).
 */
class ChoferesController extends Controller
{
    /** Choferes vinculados a un titular, con sus pólizas AP activas. */
    public function indexChoferes(Persona $persona): JsonResponse
    {
        $relaciones = PersonaRelacionChofer::query()
            ->where('titular_persona_id', $persona->id)
            ->where('activo', true)
            ->with(['chofer:id,apellidos,nombres,cuil,patente,estado_id,fecha_baja,es_solicitud,aprobado,email,telefono'])
            ->orderBy('fecha_vinculacion', 'desc')
            ->get();

        $rows = $relaciones->map(fn ($rel) => $this->serializarRelacion($rel, 'chofer'));

        return response()->json(['data' => $rows]);
    }

    /** Titulares para los que esta persona maneja como chofer. */
    public function indexTitulares(Persona $persona): JsonResponse
    {
        $relaciones = PersonaRelacionChofer::query()
            ->where('chofer_persona_id', $persona->id)
            ->where('activo', true)
            ->with(['titular:id,apellidos,nombres,cuil,patente,estado_id,fecha_baja,es_solicitud,aprobado'])
            ->orderBy('fecha_vinculacion', 'desc')
            ->get();

        $rows = $relaciones->map(fn ($rel) => $this->serializarRelacion($rel, 'titular'));

        return response()->json(['data' => $rows]);
    }

    /** Vincular un chofer existente al titular. */
    public function store(Request $request, Persona $persona): JsonResponse
    {
        $data = $request->validate([
            'chofer_persona_id'  => ['required', 'integer', 'exists:personas,id'],
            'fecha_vinculacion'  => ['nullable', 'date'],
            'rol'                => ['nullable', 'string', 'in:chofer,reemplazo,familiar'],
            'notas'              => ['nullable', 'string', 'max:2000'],
        ]);

        $choferId = (int) $data['chofer_persona_id'];

        if ($choferId === $persona->id) {
            return response()->json(['message' => 'No se puede vincular una persona consigo misma.'], 422);
        }

        // No permitir duplicados activos (UNIQUE en BD ya lo bloquea, pero damos
        // un error más claro acá antes de pegar contra el constraint).
        $existeActivo = PersonaRelacionChofer::query()
            ->where('titular_persona_id', $persona->id)
            ->where('chofer_persona_id', $choferId)
            ->where('activo', true)
            ->exists();
        if ($existeActivo) {
            return response()->json(['message' => 'Ese chofer ya está vinculado a este titular.'], 422);
        }

        // Si existe la relación pero está inactiva, la reactivamos en lugar de
        // crear una nueva (el UNIQUE bloquearía un INSERT igual).
        $rel = PersonaRelacionChofer::query()
            ->where('titular_persona_id', $persona->id)
            ->where('chofer_persona_id', $choferId)
            ->first();

        $attrs = [
            'titular_persona_id'  => $persona->id,
            'chofer_persona_id'   => $choferId,
            'fecha_vinculacion'   => $data['fecha_vinculacion'] ?? now()->toDateString(),
            'fecha_desvinculacion' => null,
            'rol'                 => $data['rol']   ?? 'chofer',
            'notas'               => $data['notas'] ?? null,
            'activo'              => true,
            'creado_por_user_id'  => $request->user()?->id,
        ];

        if ($rel) {
            $rel->fill($attrs)->save();
        } else {
            $rel = PersonaRelacionChofer::create($attrs);
        }

        $rel->load('chofer:id,apellidos,nombres,cuil,patente,estado_id,fecha_baja,es_solicitud,aprobado,email,telefono');
        return response()->json(['data' => $this->serializarRelacion($rel, 'chofer')], 201);
    }

    /** Edita rol / notas / fechas de un vínculo. */
    public function update(Request $request, PersonaRelacionChofer $relacion): JsonResponse
    {
        $data = $request->validate([
            'rol'                  => ['nullable', 'string', 'in:chofer,reemplazo,familiar'],
            'notas'                => ['nullable', 'string', 'max:2000'],
            'fecha_vinculacion'    => ['nullable', 'date'],
            'fecha_desvinculacion' => ['nullable', 'date'],
        ]);

        $relacion->fill(array_filter($data, fn ($v) => $v !== null))->save();
        $relacion->load('chofer:id,apellidos,nombres,cuil,patente,estado_id,fecha_baja,es_solicitud,aprobado,email,telefono');

        return response()->json(['data' => $this->serializarRelacion($relacion, 'chofer')]);
    }

    /**
     * Desvincula (soft): marca activo=false y completa fecha_desvinculacion.
     * El registro se preserva para auditoría histórica.
     */
    public function destroy(PersonaRelacionChofer $relacion): JsonResponse
    {
        $relacion->update([
            'activo'               => false,
            'fecha_desvinculacion' => $relacion->fecha_desvinculacion ?? now()->toDateString(),
        ]);
        return response()->json(['data' => ['unlinked' => true]]);
    }

    /**
     * Arma el shape uniforme `{relacion_id, persona, polizas_ap_activas, ...}`
     * que el frontend usa tanto para la lista de choferes como para la lista
     * de titulares (cambia solo qué persona se muestra).
     */
    private function serializarRelacion(PersonaRelacionChofer $rel, string $tipo): array
    {
        $persona = $tipo === 'chofer' ? $rel->chofer : $rel->titular;
        $polizasAp = $persona ? $this->cargarPolizasAp($persona->id) : [];

        return [
            'relacion_id'          => $rel->id,
            'fecha_vinculacion'    => $rel->fecha_vinculacion?->toDateString(),
            'fecha_desvinculacion' => $rel->fecha_desvinculacion?->toDateString(),
            'rol'                  => $rel->rol,
            'notas'                => $rel->notas,
            'activo'               => (bool) $rel->activo,
            'persona' => $persona ? PolizasController::serializarDistribuidor($persona) + [
                'email'    => $persona->email,
                'telefono' => $persona->telefono,
            ] : null,
            'polizas_ap_activas' => $polizasAp,
        ];
    }

    /**
     * Lista pólizas AP (ramo='accidentes_personales') donde la persona figura
     * como asegurado activo. Útil para mostrar en la UI si el chofer tiene
     * cobertura de Accidentes Personales y dónde.
     */
    private function cargarPolizasAp(int $personaId): array
    {
        return PolizaAsegurado::query()
            ->where('persona_id', $personaId)
            ->where('estado', 'activo')
            ->whereHas('poliza', fn ($q) => $q->where('ramo', 'accidentes_personales'))
            ->with('poliza:id,nombre_descriptivo,numero_poliza,ramo,aseguradora_id', 'poliza.aseguradora:id,nombre')
            ->get()
            ->map(fn ($a) => [
                'asegurado_id' => $a->id,
                'poliza_id'    => $a->poliza_id,
                'nombre'       => $a->poliza?->nombre_descriptivo,
                'numero'       => $a->poliza?->numero_poliza,
                'aseguradora'  => $a->poliza?->aseguradora?->nombre,
                'estado'       => $a->estado,
            ])
            ->all();
    }
}

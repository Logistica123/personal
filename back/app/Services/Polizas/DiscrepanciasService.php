<?php

namespace App\Services\Polizas;

use App\Models\Persona;
use App\Models\Poliza;
use App\Models\PolizaAsegurado;
use Illuminate\Support\Collection;

/**
 * Genera los 3 reportes de discrepancia para una póliza:
 *  - asegurados_sin_persona: en la póliza pero no matchean nadie en `personas`.
 *  - personas_sin_poliza: activas en `personas` pero sin alta en esta póliza.
 *  - match_dudoso: matchearon con score < 0.95 o con ambigüedad (revisión manual).
 */
class DiscrepanciasService
{
    public function paraPoliza(int $polizaId): array
    {
        $poliza = Poliza::query()->findOrFail($polizaId);

        return [
            'poliza_id'              => $poliza->id,
            'tipo_asegurado'         => $poliza->tipo_asegurado,
            'asegurados_sin_persona' => $this->asegurados_sin_persona($poliza),
            'personas_sin_poliza'    => $this->personas_sin_poliza($poliza),
            'match_dudoso'           => $this->match_dudoso($poliza),
            'estado_inconsistente'   => $this->estado_inconsistente($poliza),  // ADD 14
        ];
    }

    /**
     * ADD 14 — asegurados activos en póliza pero la persona vinculada está en
     * estado distinto a "activo" (baja, suspendido, solicitud, sin aprobar).
     */
    private function estado_inconsistente(Poliza $poliza): array
    {
        $rows = PolizaAsegurado::query()
            ->where('poliza_id', $poliza->id)
            ->whereNotNull('persona_alerta_estado')
            ->whereNotNull('persona_id')
            ->where('estado', 'activo')
            ->with('persona:id,apellidos,nombres,cuil,patente,fecha_baja,estado_id')
            ->orderBy('persona_alerta_estado')
            ->get();

        $grupos = [
            'persona_baja_en_poliza_activa'                 => [],
            'persona_suspendida_en_poliza_activa'           => [],
            'persona_solicitud_pendiente_en_poliza_activa'  => [],
            'persona_sin_aprobar_en_poliza_activa'          => [],
        ];

        foreach ($rows as $a) {
            $alerta = (string) $a->persona_alerta_estado;
            if (!array_key_exists($alerta, $grupos)) {
                continue;
            }
            $grupos[$alerta][] = [
                'asegurado_id'                => $a->id,
                'identificador'               => $a->identificador,
                'identificador_tipo'          => $a->identificador_tipo,
                'nombre_apellido_pdf'         => $a->nombre_apellido_pdf,
                'marca_modelo_pdf'            => $a->marca_modelo_pdf,
                'persona_id'                  => $a->persona_id,
                'persona_nombre'              => trim(($a->persona->apellidos ?? '') . ', ' . ($a->persona->nombres ?? '')),
                'persona_cuil'                => $a->persona?->cuil,
                'persona_estado_al_matchear'  => $a->persona_estado_al_matchear,
                'persona_fecha_baja'          => $a->persona?->fecha_baja,
            ];
        }

        return $grupos;
    }

    private function asegurados_sin_persona(Poliza $poliza): array
    {
        return PolizaAsegurado::query()
            ->where('poliza_id', $poliza->id)
            ->whereNull('persona_id')
            ->whereIn('estado', ['activo', 'no_matcheado', 'alta_solicitada'])
            ->select([
                'id',
                'identificador',
                'identificador_tipo',
                'nombre_apellido_pdf',
                'marca_modelo_pdf',
                'tipo_vehiculo_pdf',
                'estado',
                'numero_orden_aseguradora',
            ])
            ->orderBy('id')
            ->get()
            ->map(fn ($a) => array_merge($a->toArray(), ['riesgo' => 'fantasma']))
            ->all();
    }

    private function personas_sin_poliza(Poliza $poliza): array
    {
        $personasIds = PolizaAsegurado::query()
            ->where('poliza_id', $poliza->id)
            ->whereIn('estado', ['activo', 'alta_solicitada'])
            ->whereNotNull('persona_id')
            ->pluck('persona_id')
            ->all();

        $query = Persona::query()
            ->where('estado_id', MatchingService::ESTADO_ACTIVO_ID)
            ->whereNotIn('id', $personasIds)
            ->select(['id', 'apellidos', 'nombres', 'cuil', 'patente', 'tipo']);

        // Si la póliza es de vehículos, sólo personas que tengan patente registrada
        // (en personas.patente o en persona_patentes).
        if ($poliza->tipo_asegurado === 'vehiculo') {
            $query->where(function ($q) {
                $q->whereNotNull('patente')
                  ->orWhereHas('patentesAdicionales', fn ($qa) => $qa->where('activo', true));
            });
        }

        return $query
            ->orderBy('apellidos')
            ->get()
            ->map(fn ($p) => [
                'persona_id' => $p->id,
                'nombre'     => trim(($p->apellidos ?? '') . ', ' . ($p->nombres ?? '')),
                'cuil'       => $p->cuil,
                'patente'    => $p->patente,
                'perfil'     => $p->tipo,
                'riesgo'     => 'sin_cobertura',
            ])
            ->all();
    }

    private function match_dudoso(Poliza $poliza): array
    {
        return PolizaAsegurado::query()
            ->where('poliza_id', $poliza->id)
            ->where('revision_manual_pendiente', true)
            ->whereNotNull('persona_id')
            ->with('persona:id,apellidos,nombres,cuil')
            ->select([
                'id',
                'persona_id',
                'identificador',
                'identificador_tipo',
                'nombre_apellido_pdf',
                'match_score',
                'match_metodo',
            ])
            ->orderBy('match_score')
            ->get()
            ->map(function ($a) {
                $arr = $a->toArray();
                $arr['persona_sugerida'] = $a->persona ? [
                    'id'        => $a->persona->id,
                    'nombre'    => trim(($a->persona->apellidos ?? '') . ', ' . ($a->persona->nombres ?? '')),
                    'cuil'      => $a->persona->cuil,
                ] : null;
                $arr['motivo'] = $a->match_score !== null && (float) $a->match_score < MatchingService::FUZZY_AUTO_SCORE
                    ? 'score_bajo'
                    : 'ambiguedad';
                return $arr;
            })
            ->all();
    }
}

<?php

namespace App\Services\Polizas;

use App\Models\Persona;
use App\Models\PersonaPatente;

/**
 * Matchea asegurados (personas o vehículos) extraídos de un PDF contra el maestro `personas`.
 *
 * **BUGFIX 02 Issue 1**: el matching SOLO vincula por identificador exacto
 * (`cuil_exacto`, `dni_exacto`, `patente_exacto`). El fuzzy por nombre se
 * calcula como sugerencia visual aparte (`sugerirFuzzyPersona`) — nunca
 * autovincula. Esta es la regla central del spec §4.
 *
 * **ADD 14**: el matching busca en TODA la tabla `personas` (sin filtrar por
 * estado/aprobado) y devuelve el snapshot del estado para que el caller
 * decida si reportarla como inconsistente.
 */
class MatchingService
{
    public const ESTADO_ACTIVO_ID = 1;
    public const FUZZY_MIN_SCORE  = 0.85;

    public function matchPersona(
        ?string $identificador,
        ?string $identificadorTipo = null,
        ?string $nombreApellido = null
    ): ?array {
        $idNorm = self::normalizarNumero($identificador);

        if ($idNorm) {
            // 1. CUIL exacto (11 dígitos).
            if (strlen($idNorm) === 11) {
                $persona = $this->buscarPorCuil($idNorm);
                if ($persona) {
                    return $this->resultExacto($persona, 'cuil_exacto');
                }
            }

            // 2. DNI exacto: si vino como DNI directo (8 dígitos), o extraído del CUIL.
            $dni = strlen($idNorm) === 8 ? $idNorm : self::extraerDniDeCuil($idNorm);
            if ($dni) {
                $persona = $this->buscarPorDni($dni);
                if ($persona) {
                    return $this->resultExacto($persona, 'dni_exacto');
                }
            }
        }

        // Sin match exacto → null. NO autovinculamos por fuzzy.
        return null;
    }

    /**
     * Devuelve el mejor candidato fuzzy por nombre como **sugerencia visual** para el
     * preview del wizard. NO se vincula automáticamente — el admin decide.
     *
     * @return array{persona_id:int, score:float}|null
     */
    public function sugerirFuzzyPersona(?string $nombreApellido): ?array
    {
        if (!$nombreApellido) {
            return null;
        }
        return $this->fuzzyNombre($nombreApellido);
    }

    public function matchVehiculo(?string $patente): ?array
    {
        $patNorm = self::normalizarPatente($patente);
        if (!$patNorm) {
            return null;
        }

        // 1. patente principal en personas (sin filtro de estado).
        $persona = Persona::query()
            ->whereRaw('UPPER(REPLACE(REPLACE(patente, " ", ""), "-", "")) = ?', [$patNorm])
            ->first();
        if ($persona) {
            return $this->resultExacto($persona, 'patente_exacto');
        }

        // 2. patentes adicionales activas (sin filtro de estado de la persona).
        $extra = PersonaPatente::query()
            ->where('patente_norm', $patNorm)
            ->where('activo', true)
            ->with('persona')
            ->first();
        if ($extra && $extra->persona) {
            return $this->resultExacto($extra->persona, 'patente_exacto');
        }

        return null;
    }

    private function buscarPorCuil(string $cuilNorm): ?Persona
    {
        return Persona::query()
            ->whereRaw('REPLACE(REPLACE(REPLACE(cuil, "-", ""), ".", ""), " ", "") = ?', [$cuilNorm])
            ->first();
    }

    private function buscarPorDni(string $dni): ?Persona
    {
        // En este repo `personas` no tiene columna DNI separada — se extrae del CUIL.
        // El CUIL almacena 11 dígitos: PP + DNI(8) + V; tomamos los 8 centrales.
        return Persona::query()
            ->whereRaw('SUBSTRING(REPLACE(REPLACE(REPLACE(cuil, "-", ""), ".", ""), " ", ""), 3, 8) = ?', [$dni])
            ->first();
    }

    /**
     * Calcula el mejor candidato fuzzy por nombre (≥ FUZZY_MIN_SCORE). Sólo se usa
     * desde `sugerirFuzzyPersona`; nunca para auto-vincular.
     *
     * @return array{persona_id:int, score:float}|null
     */
    private function fuzzyNombre(string $nombreApellidoPdf): ?array
    {
        $needle = self::normalizarNombre($nombreApellidoPdf);
        if (!$needle) {
            return null;
        }

        // Sin filtros — fuzzy en TODA la tabla personas (ADD 14).
        $personas = Persona::query()
            ->select(['id', 'apellidos', 'nombres'])
            ->get();

        $best = null;
        $bestScore = 0.0;
        foreach ($personas as $p) {
            $cand1 = self::normalizarNombre(trim(($p->apellidos ?? '') . ' ' . ($p->nombres ?? '')));
            $cand2 = self::normalizarNombre(trim(($p->nombres ?? '') . ' ' . ($p->apellidos ?? '')));
            similar_text($needle, $cand1, $pct1);
            similar_text($needle, $cand2, $pct2);
            $score = max($pct1, $pct2) / 100.0;
            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $p;
            }
        }

        if (!$best || $bestScore < self::FUZZY_MIN_SCORE) {
            return null;
        }

        return [
            'persona_id' => $best->id,
            'score'      => round($bestScore, 3),
        ];
    }

    /** Construye el array de retorno para matches exactos (cuil/dni/patente). */
    private function resultExacto(Persona $persona, string $metodo): array
    {
        return [
            'persona_id'                  => $persona->id,
            'score'                       => 1.000,
            'metodo'                      => $metodo,
            'revision_manual_pendiente'   => false,
            'persona_estado_al_matchear'  => self::calcularEstadoPersona($persona),
        ];
    }

    /**
     * Resuelve el estado snapshot de la persona en un string corto y estable.
     * Orden de precedencia: baja > suspendido > solicitud_pendiente > sin_aprobar > activo.
     */
    public static function calcularEstadoPersona(Persona $p): string
    {
        if ($p->fecha_baja) {
            return 'baja';
        }
        // estado_id 3 = Suspendido en el catálogo de este repo (verificado).
        if ((int) $p->estado_id === 3) {
            return 'suspendido';
        }
        if ($p->es_solicitud) {
            return 'solicitud_pendiente';
        }
        if (!$p->aprobado) {
            return 'sin_aprobar';
        }
        return 'activo';
    }

    /**
     * Devuelve el flag de alerta cuando la persona está en estado distinto a "activo"
     * pero el asegurado en póliza sí está activo.
     */
    public static function calcularAlertaEstado(string $personaEstado, string $aseguradoEstado): ?string
    {
        if ($aseguradoEstado !== 'activo') {
            return null; // alerta sólo cuando la póliza considera al asegurado vigente
        }
        return match ($personaEstado) {
            'baja'                 => 'persona_baja_en_poliza_activa',
            'suspendido'           => 'persona_suspendida_en_poliza_activa',
            'solicitud_pendiente'  => 'persona_solicitud_pendiente_en_poliza_activa',
            'sin_aprobar'          => 'persona_sin_aprobar_en_poliza_activa',
            default                => null,
        };
    }

    /** Strip a sólo dígitos. */
    public static function normalizarNumero(?string $raw): string
    {
        if ($raw === null) {
            return '';
        }
        return preg_replace('/\D/', '', $raw) ?? '';
    }

    /** Patente → mayúsculas, sin espacios ni guiones. */
    public static function normalizarPatente(?string $raw): ?string
    {
        if (!$raw) {
            return null;
        }
        $clean = strtoupper(preg_replace('/[\s\-]/', '', $raw));
        return $clean !== '' ? $clean : null;
    }

    /** CUIL `'20316758267'` → DNI `'31675826'`. */
    public static function extraerDniDeCuil(?string $cuil): ?string
    {
        $digits = self::normalizarNumero($cuil);
        if (strlen($digits) === 11) {
            return substr($digits, 2, 8);
        }
        return null;
    }

    /** Nombre → minúsculas, sin tildes, sin puntuación, espacios colapsados. */
    public static function normalizarNombre(?string $raw): string
    {
        if (!$raw) {
            return '';
        }
        $s = strtolower($raw);
        $s = strtr($s, [
            'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n', 'ü' => 'u',
        ]);
        $s = preg_replace('/[^a-z0-9\s]/', ' ', $s);
        $s = preg_replace('/\s+/', ' ', $s);
        return trim($s);
    }
}

<?php

namespace App\Services\Polizas;

use App\Models\Persona;
use App\Models\PersonaPatente;

/**
 * Matchea asegurados (personas o vehículos) extraídos de un PDF contra el maestro `personas`.
 *
 * Devuelve `['persona_id', 'score', 'metodo', 'revision_manual_pendiente']` o null.
 * Métodos posibles: `cuil_exacto`, `dni_exacto`, `patente_exacto`, `fuzzy_nombre`.
 *
 * El matching considera sólo personas aprobadas y con estado Activo (estado_id = 1).
 */
class MatchingService
{
    public const ESTADO_ACTIVO_ID = 1;
    public const FUZZY_MIN_SCORE  = 0.85;
    public const FUZZY_AUTO_SCORE = 0.95;

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
                    return [
                        'persona_id' => $persona->id,
                        'score'      => 1.000,
                        'metodo'     => 'cuil_exacto',
                        'revision_manual_pendiente' => false,
                    ];
                }
            }

            // 2. DNI exacto: si vino como DNI directo (8 dígitos), o extraído del CUIL.
            $dni = strlen($idNorm) === 8 ? $idNorm : self::extraerDniDeCuil($idNorm);
            if ($dni) {
                $persona = $this->buscarPorDni($dni);
                if ($persona) {
                    return [
                        'persona_id' => $persona->id,
                        'score'      => 1.000,
                        'metodo'     => 'dni_exacto',
                        'revision_manual_pendiente' => false,
                    ];
                }
            }
        }

        // 3. Fuzzy por nombre + apellido.
        if ($nombreApellido) {
            $match = $this->fuzzyNombre($nombreApellido);
            if ($match) {
                return $match;
            }
        }

        return null;
    }

    public function matchVehiculo(?string $patente): ?array
    {
        $patNorm = self::normalizarPatente($patente);
        if (!$patNorm) {
            return null;
        }

        // 1. patente principal en personas.
        $persona = Persona::query()
            ->whereRaw('UPPER(REPLACE(REPLACE(patente, " ", ""), "-", "")) = ?', [$patNorm])
            ->where('estado_id', self::ESTADO_ACTIVO_ID)
            ->first();
        if ($persona) {
            return [
                'persona_id' => $persona->id,
                'score'      => 1.000,
                'metodo'     => 'patente_exacto',
                'revision_manual_pendiente' => false,
            ];
        }

        // 2. patentes adicionales activas.
        $extra = PersonaPatente::query()
            ->where('patente_norm', $patNorm)
            ->where('activo', true)
            ->whereHas('persona', fn ($q) => $q->where('estado_id', self::ESTADO_ACTIVO_ID))
            ->first();
        if ($extra) {
            return [
                'persona_id' => $extra->persona_id,
                'score'      => 1.000,
                'metodo'     => 'patente_exacto',
                'revision_manual_pendiente' => false,
            ];
        }

        return null;
    }

    private function buscarPorCuil(string $cuilNorm): ?Persona
    {
        return Persona::query()
            ->whereRaw('REPLACE(REPLACE(REPLACE(cuil, "-", ""), ".", ""), " ", "") = ?', [$cuilNorm])
            ->where('estado_id', self::ESTADO_ACTIVO_ID)
            ->first();
    }

    private function buscarPorDni(string $dni): ?Persona
    {
        // En este repo `personas` no tiene columna DNI separada — se extrae del CUIL.
        // El CUIL almacena 11 dígitos: PP + DNI(8) + V; tomamos los 8 centrales.
        return Persona::query()
            ->whereRaw('SUBSTRING(REPLACE(REPLACE(REPLACE(cuil, "-", ""), ".", ""), " ", ""), 3, 8) = ?', [$dni])
            ->where('estado_id', self::ESTADO_ACTIVO_ID)
            ->first();
    }

    private function fuzzyNombre(string $nombreApellidoPdf): ?array
    {
        $needle = self::normalizarNombre($nombreApellidoPdf);
        if (!$needle) {
            return null;
        }

        $personas = Persona::query()
            ->where('estado_id', self::ESTADO_ACTIVO_ID)
            ->select(['id', 'apellidos', 'nombres'])
            ->get();

        $candidatos = [];
        foreach ($personas as $p) {
            // Probar las dos posibles ordenaciones (Apellido Nombre / Nombre Apellido).
            $cand1 = self::normalizarNombre(trim(($p->apellidos ?? '') . ' ' . ($p->nombres ?? '')));
            $cand2 = self::normalizarNombre(trim(($p->nombres ?? '') . ' ' . ($p->apellidos ?? '')));
            similar_text($needle, $cand1, $pct1);
            similar_text($needle, $cand2, $pct2);
            $score = max($pct1, $pct2) / 100.0;
            if ($score >= self::FUZZY_MIN_SCORE) {
                $candidatos[] = ['persona_id' => $p->id, 'score' => $score];
            }
        }

        if (count($candidatos) === 0) {
            return null;
        }

        usort($candidatos, fn ($a, $b) => $b['score'] <=> $a['score']);
        $top = $candidatos[0];

        return [
            'persona_id' => $top['persona_id'],
            'score'      => round($top['score'], 3),
            'metodo'     => 'fuzzy_nombre',
            'revision_manual_pendiente' => $top['score'] < self::FUZZY_AUTO_SCORE
                                            || count($candidatos) > 1,
        ];
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

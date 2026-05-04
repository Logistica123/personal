<?php

namespace App\Services\Polizas;

use App\Models\Archivo;
use App\Models\PolizaAsegurado;
use Illuminate\Support\Collection;

/**
 * Verifica que cada asegurado tenga los documentos requeridos por la póliza
 * (`polizas_email_config.adjuntos_requeridos` con slugs como `foto_frente`,
 * `cedula_frente`, etc.).
 *
 * Este repo NO tiene una columna `categoria` en `archivos` todavía (Fase 6
 * del plan original lo difería). Mientras tanto, mapeamos los slugs contra
 * los `nombre` del catálogo `fyle_types` por aproximación heurística.
 *
 * Si el catálogo no tiene un tipo que coincida con el slug requerido, el
 * check siempre va a fallar (no hay forma de "marcar" una foto como frente
 * vs lateral). Eso queda como TODO operativo para Mati.
 */
class AdjuntosCheckService
{
    /** Mapeo heurístico slug → patrones esperados en `fyle_types.nombre`. */
    private const SLUG_PATTERNS = [
        'foto_frente'      => ['frente'],
        'foto_lateral_der' => ['lateral der'],
        'foto_lateral_izq' => ['lateral izq'],
        'foto_trasera'     => ['trasera', 'parte trasera', 'atras'],
        'cedula_frente'    => ['cedula verde', 'cedula azul', 'cedula'],
        'cedula_dorso'     => ['cedula dorso'],
        'dni_frente'       => ['dni'],
        'dni_dorso'        => ['dni dorso'],
    ];

    /**
     * @param Collection<int,PolizaAsegurado> $asegurados
     * @param string[] $slugsRequeridos
     * @return array{ok:bool, faltantes:array<int,array{asegurado_id:int,identificador:string,faltan:string[]}>}
     */
    public function verificar(Collection $asegurados, array $slugsRequeridos): array
    {
        if (empty($slugsRequeridos)) {
            return ['ok' => true, 'faltantes' => []];
        }

        $faltantes = [];
        foreach ($asegurados as $a) {
            if (!$a->persona_id) {
                $faltantes[] = [
                    'asegurado_id'  => $a->id,
                    'identificador' => $a->identificador,
                    'faltan'        => $slugsRequeridos,
                    'motivo'        => 'sin_persona_asociada',
                ];
                continue;
            }

            $faltan = $this->slugsFaltantes($a->persona_id, $slugsRequeridos);
            if (!empty($faltan)) {
                $faltantes[] = [
                    'asegurado_id'  => $a->id,
                    'identificador' => $a->identificador,
                    'faltan'        => $faltan,
                ];
            }
        }

        return [
            'ok'        => empty($faltantes),
            'faltantes' => $faltantes,
        ];
    }

    /** Devuelve los slugs que NO tienen documento asociado a esta persona. */
    private function slugsFaltantes(int $personaId, array $slugs): array
    {
        $tipos = Archivo::query()
            ->where('persona_id', $personaId)
            ->whereNull('deleted_at')
            ->join('fyle_types', 'fyle_types.id', '=', 'archivos.tipo_archivo_id')
            ->pluck('fyle_types.nombre')
            ->map(fn ($n) => mb_strtolower($n))
            ->all();

        $faltan = [];
        foreach ($slugs as $slug) {
            $patrones = self::SLUG_PATTERNS[$slug] ?? [$slug];
            $tieneAlguno = false;
            foreach ($tipos as $nombre) {
                foreach ($patrones as $p) {
                    if (str_contains($nombre, $p)) {
                        $tieneAlguno = true;
                        break 2;
                    }
                }
            }
            if (!$tieneAlguno) {
                $faltan[] = $slug;
            }
        }
        return $faltan;
    }
}

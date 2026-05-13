<?php

namespace App\Services\Polizas;

use App\Models\Persona;
use App\Models\Poliza;
use App\Models\PolizaAsegurado;
use App\Models\PolizaEndoso;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Orquesta la carga de un PDF en una póliza:
 *  - `armarPreview()`: parsea + matchea cada asegurado contra `personas`. NO persiste.
 *  - `confirmar()`: recibe el preview con decisiones del admin y persiste endoso + asegurados.
 */
class CargaPolizaService
{
    public function __construct(
        private readonly MatchingService $matcher,
        private readonly ImportesCalculatorService $importes,
    ) {
    }

    /**
     * Carga la persona vinculada y devuelve el shape `{id, nombre_completo, cuil,
     * patente, estado_actual, ...}` que la UI usa para mostrar el nombre del
     * distribuidor + badge de estado. Devuelve null si no existe.
     */
    private static function cargarDistribuidor(?int $personaId): ?array
    {
        if (!$personaId) return null;
        $p = Persona::query()
            ->select(['id', 'apellidos', 'nombres', 'cuil', 'patente', 'estado_id', 'fecha_baja', 'es_solicitud', 'aprobado'])
            ->find($personaId);
        if (!$p) return null;
        return [
            'id'              => $p->id,
            'nombre_completo' => trim(($p->apellidos ?? '') . ' ' . ($p->nombres ?? '')) ?: '—',
            'cuil'            => $p->cuil,
            'patente'         => $p->patente,
            'estado_actual'   => MatchingService::calcularEstadoPersona($p),
            'es_solicitud'    => (bool) $p->es_solicitud,
            'aprobado'        => (bool) $p->aprobado,
            'fecha_baja'      => $p->fecha_baja,
        ];
    }

    /**
     * Toma el resultado del parser Python y le agrega `match_propuesto` por asegurado.
     *
     * @param array $parsed Salida de PolizaPdfService::parse()
     * @return array Preview enriquecido (no persiste nada).
     */
    public function armarPreview(Poliza $poliza, array $parsed): array
    {
        $aseguradora = $poliza->aseguradora?->parser_perfil;
        $detectada   = $parsed['aseguradora_detectada'] ?? null;

        $warnings = $parsed['warnings'] ?? [];
        if ($detectada && $aseguradora && $detectada !== $aseguradora) {
            $warnings[] = "El PDF parece ser de '{$detectada}' pero la póliza es de '{$aseguradora}'.";
        }

        $asegurados = [];
        foreach ($parsed['asegurados'] ?? [] as $a) {
            $tipo = $a['tipo'] ?? null;
            $match = null;
            $sugerencia = null;

            if ($tipo === 'persona') {
                $match = $this->matcher->matchPersona(
                    $a['identificador']      ?? null,
                    $a['identificador_tipo'] ?? null,
                    $a['nombre_apellido']    ?? null,
                );
                // BUGFIX 02 Issue 1: sin match exacto, ofrecer sugerencia fuzzy
                // por nombre como AYUDA visual (no auto-vincula).
                if (!$match) {
                    $sugerencia = $this->matcher->sugerirFuzzyPersona($a['nombre_apellido'] ?? null);
                    if ($sugerencia) {
                        $sugerencia['persona'] = self::cargarDistribuidor($sugerencia['persona_id']);
                    }
                }
            } elseif ($tipo === 'vehiculo') {
                $match = $this->matcher->matchVehiculo($a['identificador'] ?? null);
            }

            // Enriquecer el match con datos del distribuidor (nombre + estado actual)
            // para que la UI del preview pueda mostrar quién es realmente.
            if ($match) {
                $match['persona'] = self::cargarDistribuidor($match['persona_id']);
            }

            $asegurados[] = array_merge($a, [
                'match_propuesto'       => $match,
                'sugerencia_fuzzy'      => $sugerencia,
                'decision_default'      => $match ? 'vincular' : ($sugerencia ? 'revisar' : 'crear'),
            ]);
        }

        return [
            'aseguradora_detectada' => $detectada,
            'tipo_documento'        => $parsed['tipo_documento'] ?? null,
            'poliza_pdf'            => $parsed['poliza'] ?? [],
            'endoso'                => $parsed['endoso'],
            'asegurados'            => $asegurados,
            'warnings'              => $warnings,
        ];
    }

    /**
     * Persiste endoso + asegurados a partir del preview confirmado por el admin.
     *
     * @param array $payload  Estructura esperada:
     *   {
     *     endoso: { numero_endoso, tipo, fecha_emision, descripcion?, premio_endoso? } | null,
     *     asegurados: [
     *       {
     *         tipo, identificador, identificador_tipo,
     *         numero_orden_aseguradora?, nombre_apellido?, marca_modelo?, tipo_vehiculo?, localidad?,
     *         suma_asegurada?, premio_individual?,
     *         decision: 'vincular' | 'crear' | 'ignorar',
     *         persona_id?: int  // override manual si decision='vincular'
     *         match_score?, match_metodo?, revision_manual_pendiente?
     *       }
     *     ]
     *   }
     *
     * @return array{endoso_id:?int, asegurados_creados:int, asegurados_actualizados:int, ignorados:int}
     */
    public function confirmar(Poliza $poliza, array $payload): array
    {
        return DB::transaction(function () use ($poliza, $payload) {
            $endosoId = null;
            if (!empty($payload['endoso'])) {
                // ADDENDUM 15 Bloque 2 — autocalcular cantidad de asegurados si no llegó.
                // Cuenta solo los marcados para crear/vincular (no los `ignorar`).
                $endosoData = $payload['endoso'];
                if (empty($endosoData['cantidad_asegurados_incorporados'])) {
                    $endosoData['cantidad_asegurados_incorporados'] = collect($payload['asegurados'] ?? [])
                        ->filter(fn ($a) => in_array($a['decision'] ?? '', ['vincular', 'crear'], true))
                        ->count();
                }
                $endosoId = $this->crearEndoso($poliza, $endosoData);
            }

            $tipoEndoso = $payload['endoso']['tipo'] ?? null;
            $creados        = 0;
            $actualizados   = 0;
            $ignorados      = 0;

            foreach ($payload['asegurados'] ?? [] as $a) {
                $decision = $a['decision'] ?? 'crear';
                if ($decision === 'ignorar') {
                    $ignorados++;
                    continue;
                }

                $personaId = null;
                $matchScore = null;
                $matchMetodo = null;
                $revision = false;
                $personaEstado = null;

                if ($decision === 'vincular') {
                    $personaId   = $a['persona_id']                ?? null;
                    $matchScore  = $a['match_score']               ?? null;
                    $matchMetodo = $a['match_metodo']              ?? 'manual';
                    $revision    = (bool)($a['revision_manual_pendiente'] ?? false);
                    $personaEstado = $a['persona_estado_al_matchear'] ?? null;
                    if (!$personaId) {
                        throw new RuntimeException("Decision 'vincular' sin persona_id en {$a['identificador']}");
                    }
                    // BUGFIX 02 Issue 1: el match `fuzzy_nombre` ya no es válido.
                    // Si llega del frontend, se ignora el método y se trata como
                    // vinculación manual (decisión explícita del admin).
                    if (!in_array($matchMetodo, ['cuil_exacto', 'dni_exacto', 'patente_exacto', 'manual'], true)) {
                        $matchMetodo = 'manual';
                    }
                }

                // Sugerencia fuzzy: se preserva siempre que venga en el payload
                // (incluso si la decisión es 'crear' o si el admin la rechazó).
                $sugFuzzyId    = $a['sugerencia_fuzzy_persona_id'] ?? null;
                $sugFuzzyScore = $a['sugerencia_fuzzy_score']      ?? null;

                $estado = $personaId ? 'activo' : 'no_matcheado';
                $alertaEstado = $personaEstado
                    ? MatchingService::calcularAlertaEstado($personaEstado, $estado)
                    : null;

                $existente = PolizaAsegurado::query()
                    ->where('poliza_id', $poliza->id)
                    ->where('identificador', $a['identificador'])
                    ->first();

                $attrs = [
                    'persona_id'                => $personaId,
                    'tipo_asegurado'            => $a['tipo'],
                    'identificador'             => $a['identificador'],
                    'identificador_tipo'        => $a['identificador_tipo'],
                    'numero_orden_aseguradora'  => $a['numero_orden_aseguradora'] ?? null,
                    'nombre_apellido_pdf'       => $a['nombre_apellido']         ?? null,
                    'marca_modelo_pdf'          => $a['marca_modelo']            ?? null,
                    'tipo_vehiculo_pdf'         => $a['tipo_vehiculo']           ?? null,
                    'localidad_pdf'             => $a['localidad']               ?? null,
                    'fecha_nacimiento_pdf'      => $a['fecha_nacimiento']        ?? null,
                    'suma_asegurada'            => $a['suma_asegurada']          ?? null,
                    'premio_individual'         => $a['premio_individual']       ?? null,
                    'estado'                    => $estado,
                    'match_score'               => $matchScore,
                    'match_metodo'              => $matchMetodo,
                    'persona_estado_al_matchear' => $personaEstado,
                    'persona_alerta_estado'     => $alertaEstado,
                    'sugerencia_fuzzy_persona_id' => $sugFuzzyId,
                    'sugerencia_fuzzy_score'    => $sugFuzzyScore,
                    'revision_manual_pendiente' => $revision,
                ];

                if ($endosoId && $tipoEndoso === 'incorporacion') {
                    $attrs['alta_endoso_id']     = $endosoId;
                    $attrs['fecha_alta_efectiva'] = $payload['endoso']['fecha_emision'] ?? null;
                } elseif ($endosoId && $tipoEndoso === 'baja') {
                    $attrs['baja_endoso_id']     = $endosoId;
                    $attrs['fecha_baja_efectiva'] = $payload['endoso']['fecha_emision'] ?? null;
                    $attrs['estado']             = 'dado_de_baja';
                }

                if ($existente) {
                    $existente->fill($attrs)->save();
                    $actualizados++;
                } else {
                    $attrs['poliza_id'] = $poliza->id;
                    PolizaAsegurado::create($attrs);
                    $creados++;
                }
            }

            // Actualizar contador en póliza.
            $poliza->update([
                'cantidad_vidas_unidades' => PolizaAsegurado::where('poliza_id', $poliza->id)
                    ->where('estado', 'activo')
                    ->count(),
            ]);

            // ADDENDUM 15 Bloque 2 — recalcular importes mensuales tras la carga.
            // El parser ya pobló `premio_endoso`/`cantidad_asegurados_incorporados`
            // (SC), `premio_anual`/`cantidad_vidas_unidades` (MAPFRE) o
            // `premio_individual` por asegurado (LS). Acá se distribuye según
            // perfil de aseguradora. No sobrescribe asegurados con override manual.
            $endosoModelo = $endosoId ? PolizaEndoso::find($endosoId) : null;
            $importesStats = $this->importes->recalcularPostCarga($poliza, $endosoModelo);

            return [
                'endoso_id'              => $endosoId,
                'asegurados_creados'     => $creados,
                'asegurados_actualizados' => $actualizados,
                'ignorados'              => $ignorados,
                'importes_recalculados'  => $importesStats,
            ];
        });
    }

    private function crearEndoso(Poliza $poliza, array $data): int
    {
        $numero = $data['numero_endoso']
            ?? $data['numero']
            ?? ('AUTO-' . now()->format('YmdHis'));

        $tipo = $data['tipo'] ?? 'modificacion';
        if ($tipo === 'endoso_incorporacion') $tipo = 'incorporacion';
        if ($tipo === 'endoso_baja')          $tipo = 'baja';
        if ($tipo === 'endoso_modificacion')  $tipo = 'modificacion';
        // 'asegurados_adherentes' (ADD 13A) — válido como tipo del ENUM tras la migración.

        // ADDENDUM 15 Bloque 2 — para SC (premio del endoso completo), el parser
        // o el frontend pueden mandar `cantidad_asegurados_incorporados`. Si no
        // llega, se autocalcula con el count de items del payload.
        $cantidadIncorporados = $data['cantidad_asegurados_incorporados']
            ?? $data['cantidad_asegurados']
            ?? null;

        $endoso = PolizaEndoso::create([
            'poliza_id'                       => $poliza->id,
            'numero_endoso'                   => (string) $numero,
            'tipo'                            => $tipo,
            'fecha_emision'                   => $data['fecha_emision'] ?? now()->toDateString(),
            'descripcion'                     => $data['descripcion']   ?? null,
            'premio_endoso'                   => $data['premio_endoso'] ?? null,
            'cantidad_asegurados_incorporados'=> $cantidadIncorporados,
        ]);

        return $endoso->id;
    }
}

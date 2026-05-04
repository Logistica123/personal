<?php

namespace App\Services\Polizas;

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
    ) {
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
            if ($tipo === 'persona') {
                $match = $this->matcher->matchPersona(
                    $a['identificador']      ?? null,
                    $a['identificador_tipo'] ?? null,
                    $a['nombre_apellido']    ?? null,
                );
            } elseif ($tipo === 'vehiculo') {
                $match = $this->matcher->matchVehiculo($a['identificador'] ?? null);
            } else {
                $match = null;
            }

            $asegurados[] = array_merge($a, [
                'match_propuesto' => $match,
                'decision_default' => $match
                    ? ($match['revision_manual_pendiente'] ? 'revisar' : 'vincular')
                    : 'crear',
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
                $endosoId = $this->crearEndoso($poliza, $payload['endoso']);
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

                if ($decision === 'vincular') {
                    $personaId   = $a['persona_id']                ?? null;
                    $matchScore  = $a['match_score']               ?? null;
                    $matchMetodo = $a['match_metodo']              ?? 'manual';
                    $revision    = (bool)($a['revision_manual_pendiente'] ?? false);
                    if (!$personaId) {
                        throw new RuntimeException("Decision 'vincular' sin persona_id en {$a['identificador']}");
                    }
                }

                $estado = $personaId ? 'activo' : 'no_matcheado';

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

            return [
                'endoso_id'              => $endosoId,
                'asegurados_creados'     => $creados,
                'asegurados_actualizados' => $actualizados,
                'ignorados'              => $ignorados,
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

        $endoso = PolizaEndoso::create([
            'poliza_id'      => $poliza->id,
            'numero_endoso'  => (string) $numero,
            'tipo'           => $tipo,
            'fecha_emision'  => $data['fecha_emision'] ?? now()->toDateString(),
            'descripcion'    => $data['descripcion']   ?? null,
            'premio_endoso'  => $data['premio_endoso'] ?? null,
        ]);

        return $endoso->id;
    }
}

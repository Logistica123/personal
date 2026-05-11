<?php

namespace App\Services\Polizas;

use App\Models\Poliza;
use App\Models\PolizaAsegurado;
use App\Models\PolizaBulkBajaGlobal;
use App\Models\PolizaSolicitud;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * ADDENDUM 14 Parte C — Bulk de bajas a nivel GLOBAL.
 *
 * El admin pega una lista mixta de CUILs/DNIs/patentes; el sistema busca cada
 * uno en TODAS las pólizas activas, agrupa por aseguradora/póliza y permite
 * generar las N solicitudes de baja correspondientes en una sola operación.
 */
class BulkBajaGlobalService
{
    public function __construct(
        private readonly SolicitudService $solicitudService,
    ) {
    }

    /**
     * Paso 1 — búsqueda. Devuelve qué asegurados activos matchean cada línea
     * de input, agrupados por persona y por aseguradora.
     */
    public function buscar(array $lineas): array
    {
        $entradas = collect($lineas)
            ->map(fn ($l) => trim((string) $l))
            ->filter()
            ->unique()
            ->values();

        $polizasActivas = Poliza::query()
            ->where('activa', true)
            ->with('aseguradora:id,nombre')
            ->get()
            ->keyBy('id');

        $encontradosPorLinea = [];
        $noEncontrados = [];

        foreach ($entradas as $linea) {
            $matches = $this->buscarEnTodasLasPolizas($linea, $polizasActivas);
            if ($matches->isEmpty()) {
                $noEncontrados[] = ['linea_input' => $linea, 'razon' => 'Sin coincidencia exacta en ninguna póliza activa.'];
                continue;
            }
            $encontradosPorLinea[] = [
                'linea_input' => $linea,
                'matches'     => $matches->map(fn ($a) => $this->serializarAsegurado($a, $polizasActivas))->all(),
            ];
        }

        // Agrupación por aseguradora/póliza (para preview de los N correos).
        $todosLosAsegurados = collect($encontradosPorLinea)
            ->flatMap(fn ($e) => $e['matches'])
            ->unique('asegurado_id');

        $agrupacion = $todosLosAsegurados
            ->groupBy('poliza_id')
            ->map(function (Collection $items, $polizaId) use ($polizasActivas) {
                $p = $polizasActivas[$polizaId] ?? null;
                return [
                    'poliza_id'           => (int) $polizaId,
                    'poliza_nombre'       => $p?->nombre_descriptivo,
                    'numero_poliza'       => $p?->numero_poliza,
                    'aseguradora_id'      => $p?->aseguradora_id,
                    'aseguradora_nombre'  => $p?->aseguradora?->nombre,
                    'ramo'                => $p?->ramo,
                    'tipo_asegurado'      => $p?->tipo_asegurado,
                    'cantidad'            => $items->count(),
                    'asegurados'          => $items->values()->all(),
                ];
            })
            ->values()
            ->all();

        return [
            'identificadores_input' => $entradas->all(),
            'encontrados_por_linea' => $encontradosPorLinea,
            'no_encontrados'        => $noEncontrados,
            'agrupacion_por_poliza' => $agrupacion,
            'totales' => [
                'identificadores'  => $entradas->count(),
                'encontrados'      => $todosLosAsegurados->count(),
                'no_encontrados'   => count($noEncontrados),
                'polizas_afectadas'=> count($agrupacion),
                'aseguradoras'     => collect($agrupacion)->pluck('aseguradora_id')->unique()->count(),
            ],
        ];
    }

    /**
     * Paso 2 — crea las N solicitudes de baja (en `borrador`) agrupadas bajo un
     * único `PolizaBulkBajaGlobal`. NO envía todavía — eso queda para `ejecutar()`.
     *
     * @param array $seleccion  mapa { poliza_id: [asegurado_id, ...] }
     */
    public function crearSolicitudes(User $admin, string $inputRaw, array $seleccion, array $totalesBusqueda): PolizaBulkBajaGlobal
    {
        if (empty($seleccion)) {
            throw new RuntimeException('La selección está vacía — nada para crear.');
        }

        return DB::transaction(function () use ($admin, $inputRaw, $seleccion, $totalesBusqueda) {
            $bulk = PolizaBulkBajaGlobal::create([
                'administrativo_user_id'      => $admin->id,
                'input_raw'                   => $inputRaw,
                'cantidad_identificadores'    => $totalesBusqueda['identificadores'] ?? 0,
                'cantidad_encontrados'        => $totalesBusqueda['encontrados']    ?? 0,
                'cantidad_no_encontrados'     => $totalesBusqueda['no_encontrados'] ?? 0,
                'cantidad_solicitudes_creadas'=> 0,
                'cantidad_correos_enviados'   => 0,
                'cantidad_correos_fallidos'   => 0,
                'estado'                      => 'en_progreso',
                'metadata'                    => ['seleccion' => $seleccion],
            ]);

            $solicitudesCreadas = 0;
            foreach ($seleccion as $polizaId => $aseguradoIds) {
                $aseguradoIds = collect($aseguradoIds)->map(fn ($x) => (int) $x)->filter()->unique()->values()->all();
                if (empty($aseguradoIds)) continue;

                $poliza = Poliza::query()->where('id', (int) $polizaId)->where('activa', true)->first();
                if (!$poliza) {
                    Log::warning("BulkBajaGlobal: poliza #{$polizaId} no activa, saltada.");
                    continue;
                }

                $solicitud = $this->solicitudService->crearBorrador(
                    poliza:        $poliza,
                    tipo:          'baja',
                    aseguradoIds:  $aseguradoIds,
                    admin:         $admin,
                );
                $solicitud->update(['bulk_baja_global_id' => $bulk->id]);
                $solicitudesCreadas++;
            }

            $bulk->update(['cantidad_solicitudes_creadas' => $solicitudesCreadas]);
            return $bulk;
        });
    }

    /**
     * Paso 3 — preview de los N correos. Itera las solicitudes del bulk y
     * devuelve cada `previewRender` para que el frontend muestre tabs.
     */
    public function preview(PolizaBulkBajaGlobal $bulk): array
    {
        $previews = [];
        foreach ($bulk->solicitudes()->with('poliza.aseguradora')->get() as $solicitud) {
            try {
                $rendered = $this->solicitudService->previewRender($solicitud);
                $previews[] = [
                    'solicitud_id'      => $solicitud->id,
                    'poliza_id'         => $solicitud->poliza_id,
                    'poliza_nombre'     => $solicitud->poliza?->nombre_descriptivo,
                    'aseguradora_nombre'=> $solicitud->poliza?->aseguradora?->nombre,
                    'preview'           => $rendered,
                ];
            } catch (\Throwable $e) {
                $previews[] = [
                    'solicitud_id'      => $solicitud->id,
                    'poliza_id'         => $solicitud->poliza_id,
                    'poliza_nombre'     => $solicitud->poliza?->nombre_descriptivo,
                    'aseguradora_nombre'=> $solicitud->poliza?->aseguradora?->nombre,
                    'preview_error'     => mb_substr($e->getMessage(), 0, 500),
                ];
            }
        }
        return $previews;
    }

    /**
     * Paso 4 — envío secuencial rápido. Itera las solicitudes en estado
     * `borrador` y las manda. Si alguna falla, queda registrada y el bulk
     * pasa a estado `con_errores` pero el resto se envían igual.
     */
    public function ejecutar(PolizaBulkBajaGlobal $bulk): array
    {
        $resultados = [];
        $enviados = 0;
        $fallidos = 0;

        foreach ($bulk->solicitudes()->where('estado', 'borrador')->get() as $solicitud) {
            try {
                $this->solicitudService->enviar($solicitud);
                $solicitud->refresh();
                $enviados++;
                $resultados[] = [
                    'solicitud_id'      => $solicitud->id,
                    'poliza_id'         => $solicitud->poliza_id,
                    'ok'                => true,
                    'message_id'        => $solicitud->email_message_id,
                    'enviado_en'        => $solicitud->enviado_en?->toIso8601String(),
                ];
            } catch (\Throwable $e) {
                $fallidos++;
                $resultados[] = [
                    'solicitud_id' => $solicitud->id,
                    'poliza_id'    => $solicitud->poliza_id,
                    'ok'           => false,
                    'error'        => mb_substr($e->getMessage(), 0, 500),
                ];
                Log::warning("BulkBajaGlobal[{$bulk->id}] solicitud {$solicitud->id} falló: {$e->getMessage()}");
            }
        }

        $bulk->update([
            'cantidad_correos_enviados' => $enviados,
            'cantidad_correos_fallidos' => $fallidos,
            'estado'                    => $fallidos > 0 ? 'con_errores' : 'completado',
            'completado_en'             => now(),
        ]);

        return [
            'bulk_id'    => $bulk->id,
            'enviados'   => $enviados,
            'fallidos'   => $fallidos,
            'resultados' => $resultados,
        ];
    }

    /** Busca un identificador en TODAS las pólizas activas (puede aparecer en varias). */
    private function buscarEnTodasLasPolizas(string $linea, Collection $polizasActivas): Collection
    {
        $digitos = preg_replace('/\D/', '', $linea);
        $cuil = strlen($digitos) === 11 ? $digitos : null;
        $dni  = strlen($digitos) === 8 ? $digitos
              : (strlen($digitos) === 11 ? substr($digitos, 2, 8) : null);
        $patente = strtoupper(preg_replace('/[\s\-]/', '', $linea));

        $polizaIds = $polizasActivas->pluck('id');
        $base = PolizaAsegurado::query()
            ->whereIn('poliza_id', $polizaIds)
            ->whereIn('estado', ['activo', 'alta_solicitada'])
            ->with('persona:id,apellidos,nombres,cuil,patente');

        // Match por persona (CUIL/DNI normalizado).
        $matches = collect();
        if ($cuil || $dni) {
            $cond = clone $base;
            $cond->where(function ($q) use ($cuil, $dni) {
                $q->whereHas('persona', function ($qp) use ($cuil, $dni) {
                    $expr = 'REPLACE(REPLACE(REPLACE(cuil, "-", ""), ".", ""), " ", "")';
                    if ($cuil) $qp->orWhereRaw("{$expr} = ?", [$cuil]);
                    if ($dni)  $qp->orWhereRaw("SUBSTRING({$expr}, 3, 8) = ?", [$dni]);
                })
                ->orWhere(function ($q2) use ($cuil, $dni) {
                    // Edge case: asegurado no_matcheado con identificador literal.
                    if ($cuil) $q2->orWhere('identificador', $cuil);
                    if ($dni)  $q2->orWhere('identificador', $dni);
                });
            });
            $matches = $cond->get();
        }

        // Match por patente (independiente del path de personas).
        if ($patente && preg_match('/^[A-Z]{2,3}\d{3}[A-Z]{0,2}$/', $patente)) {
            $porPatente = (clone $base)
                ->where(function ($q) use ($patente) {
                    $q->where('identificador', $patente)
                      ->orWhereHas('persona', fn ($qp) => $qp->where('patente', $patente));
                })
                ->get();
            $matches = $matches->merge($porPatente);
        }

        return $matches->unique('id')->values();
    }

    private function serializarAsegurado(PolizaAsegurado $a, Collection $polizasActivas): array
    {
        $p = $polizasActivas[$a->poliza_id] ?? null;
        return [
            'asegurado_id'        => $a->id,
            'poliza_id'           => $a->poliza_id,
            'poliza_nombre'       => $p?->nombre_descriptivo,
            'aseguradora_nombre'  => $p?->aseguradora?->nombre,
            'identificador'       => $a->identificador,
            'identificador_tipo'  => $a->identificador_tipo,
            'estado'              => $a->estado,
            'persona_id'          => $a->persona_id,
            'nombre'              => $a->persona
                ? trim(($a->persona->apellidos ?? '') . ' ' . ($a->persona->nombres ?? '')) ?: '—'
                : ($a->nombre_apellido_pdf ?? '—'),
            'cuil'                => $a->persona?->cuil,
            'sin_match_persona'   => is_null($a->persona_id),
        ];
    }
}

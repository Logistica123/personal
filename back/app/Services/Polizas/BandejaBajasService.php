<?php

namespace App\Services\Polizas;

use App\Models\Persona;
use App\Models\Poliza;
use App\Models\PolizaAsegurado;
use App\Models\PolizaSolicitudBajaPendiente;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * ADDENDUM 15 Bloque 1 — Bandeja de bajas pendientes de procesar.
 *
 * Flujo:
 *   1) `crearDesdeProveedor()` — cuando alguien click "Solicitar baja" en
 *      `/personal/:id/editar`. Crea entrada en estado `pendiente` SIN enviar
 *      correos todavía. Notifica al admin con `puede_procesar_bajas`.
 *
 *   2) `procesar()` — el admin revisa, elige qué pólizas dar de baja y dispara
 *      las solicitudes via SolicitudService::crearBorrador + enviar. Marca
 *      `procesada`. Si la persona queda sin coberturas, ofrece auto-pasarla
 *      a estado "Baja".
 *
 *   3) `rechazar()` — el admin descarta la solicitud con motivo. Marca
 *      `rechazada` y notifica al solicitante.
 */
class BandejaBajasService
{
    public function __construct(
        private readonly SolicitudService $solicitudService,
    ) {
    }

    /**
     * Crea una solicitud pendiente desde el flow de Proveedores.
     *
     * @param int[] $polizasSugeridas IDs de pólizas que el solicitante propone dar de baja
     */
    public function crearDesdeProveedor(
        Persona $persona,
        User $solicitante,
        string $motivo,
        array $polizasSugeridas = [],
        ?string $comentarios = null,
    ): PolizaSolicitudBajaPendiente {
        if (mb_strlen(trim($motivo)) < 3) {
            throw new RuntimeException('El motivo de baja es obligatorio (mínimo 3 caracteres).');
        }

        $pendiente = PolizaSolicitudBajaPendiente::create([
            'persona_id'              => $persona->id,
            'solicitada_por_user_id'  => $solicitante->id,
            'motivo_baja'             => trim($motivo),
            'comentarios_adicionales' => $comentarios ? trim($comentarios) : null,
            'polizas_sugeridas'       => array_values(array_unique(array_map('intval', $polizasSugeridas))),
            'estado'                  => 'pendiente',
        ]);

        $this->notificarAdminsParaProcesar($pendiente, $persona);

        return $pendiente;
    }

    /**
     * Procesa la solicitud: para cada póliza seleccionada por el admin, genera
     * una `PolizaSolicitud` (tipo=baja) con los asegurados activos de la persona
     * en esa póliza y la envía a la aseguradora vía OAuth.
     *
     * @param int[] $polizasIds IDs de pólizas que el admin decidió dar de baja
     */
    public function procesar(
        PolizaSolicitudBajaPendiente $pendiente,
        User $admin,
        array $polizasIds,
        ?string $comentarios = null,
    ): array {
        if ($pendiente->estado !== 'pendiente') {
            throw new RuntimeException("La solicitud ya fue {$pendiente->estado} y no puede reprocesarse.");
        }
        if (empty($polizasIds)) {
            throw new RuntimeException('Seleccioná al menos una póliza para dar de baja.');
        }

        return DB::transaction(function () use ($pendiente, $admin, $polizasIds, $comentarios) {
            $resultados = [];
            $polizasOk = [];

            foreach (array_unique(array_map('intval', $polizasIds)) as $polizaId) {
                $poliza = Poliza::query()->where('id', $polizaId)->first();
                if (!$poliza) continue;

                // Buscar todos los asegurados activos de esta persona en esta póliza.
                // Puede haber más de uno si hay caso de patente principal + secundaria.
                $aseguradoIds = PolizaAsegurado::query()
                    ->where('poliza_id', $polizaId)
                    ->where('persona_id', $pendiente->persona_id)
                    ->whereIn('estado', ['activo', 'alta_solicitada'])
                    ->pluck('id')->all();

                if (empty($aseguradoIds)) {
                    $resultados[] = [
                        'poliza_id' => $polizaId, 'ok' => false,
                        'error' => 'Persona sin asegurados activos en esta póliza.',
                    ];
                    continue;
                }

                try {
                    $solicitud = $this->solicitudService->crearBorrador(
                        poliza:       $poliza,
                        tipo:         'baja',
                        aseguradoIds: $aseguradoIds,
                        admin:        $admin,
                    );
                    $this->solicitudService->enviar($solicitud);
                    $polizasOk[] = $polizaId;
                    $resultados[] = [
                        'poliza_id' => $polizaId, 'ok' => true,
                        'solicitud_id' => $solicitud->id,
                    ];
                } catch (\Throwable $e) {
                    Log::warning("BandejaBajas.procesar falló para poliza {$polizaId}: " . $e->getMessage());
                    $resultados[] = [
                        'poliza_id' => $polizaId, 'ok' => false,
                        'error' => mb_substr($e->getMessage(), 0, 500),
                    ];
                }
            }

            $pendiente->update([
                'estado'                  => 'procesada',
                'procesada_por_user_id'   => $admin->id,
                'procesada_en'            => now(),
                'polizas_dadas_de_baja'   => $polizasOk,
                'comentarios_adicionales' => $comentarios
                    ? trim(($pendiente->comentarios_adicionales ? $pendiente->comentarios_adicionales . "\n" : '') . $comentarios)
                    : $pendiente->comentarios_adicionales,
            ]);

            $this->notificarSolicitante($pendiente, "Tu solicitud de baja de {$pendiente->persona?->apellidos} fue procesada.");

            return [
                'pendiente_id'  => $pendiente->id,
                'polizas_ok'    => count($polizasOk),
                'polizas_fail'  => count($resultados) - count($polizasOk),
                'resultados'    => $resultados,
            ];
        });
    }

    public function rechazar(PolizaSolicitudBajaPendiente $pendiente, User $admin, string $motivoRechazo): PolizaSolicitudBajaPendiente
    {
        if ($pendiente->estado !== 'pendiente') {
            throw new RuntimeException("La solicitud ya fue {$pendiente->estado}.");
        }
        if (mb_strlen(trim($motivoRechazo)) < 3) {
            throw new RuntimeException('Motivo de rechazo obligatorio.');
        }

        $pendiente->update([
            'estado'                => 'rechazada',
            'procesada_por_user_id' => $admin->id,
            'procesada_en'          => now(),
            'motivo_rechazo'        => trim($motivoRechazo),
        ]);

        $this->notificarSolicitante(
            $pendiente,
            "Tu solicitud de baja de {$pendiente->persona?->apellidos} fue rechazada. Motivo: " . trim($motivoRechazo)
        );

        return $pendiente;
    }

    public function cancelar(PolizaSolicitudBajaPendiente $pendiente, User $user): PolizaSolicitudBajaPendiente
    {
        if ($pendiente->estado !== 'pendiente') {
            throw new RuntimeException("Solo se pueden cancelar solicitudes pendientes (estado actual: {$pendiente->estado}).");
        }
        if ($pendiente->solicitada_por_user_id !== $user->id && ($user->role ?? null) !== 'admin') {
            throw new RuntimeException('Solo el solicitante o un admin pueden cancelar.');
        }
        $pendiente->update(['estado' => 'cancelada', 'procesada_en' => now()]);
        return $pendiente;
    }

    private function notificarAdminsParaProcesar(PolizaSolicitudBajaPendiente $pendiente, Persona $persona): void
    {
        // Best-effort: si no existe el sistema de notificaciones, no rompe.
        try {
            $adminsIds = \App\Models\PolizaAdminPermiso::query()
                ->where('puede_procesar_bajas', true)
                ->pluck('user_id');
            $nombre = trim(($persona->apellidos ?? '') . ' ' . ($persona->nombres ?? '')) ?: "persona #{$persona->id}";
            foreach ($adminsIds as $userId) {
                \App\Models\Notification::create([
                    'user_id'     => $userId,
                    'type'        => 'polizas_baja_pendiente',
                    'entity_type' => PolizaSolicitudBajaPendiente::class,
                    'entity_id'   => $pendiente->id,
                    'message'     => "Nueva solicitud de baja: {$nombre}",
                    'description' => mb_substr($pendiente->motivo_baja, 0, 200),
                    'metadata'    => [
                        'pendiente_id' => $pendiente->id,
                        'persona_id'   => $persona->id,
                        'ruta'         => "/polizas/bandeja-bajas-pendientes?id={$pendiente->id}",
                    ],
                ]);
            }
        } catch (\Throwable $e) {
            Log::info("BandejaBajas: notificación a admins no enviada ({$e->getMessage()})");
        }
    }

    private function notificarSolicitante(PolizaSolicitudBajaPendiente $pendiente, string $mensaje): void
    {
        try {
            \App\Models\Notification::create([
                'user_id'     => $pendiente->solicitada_por_user_id,
                'type'        => 'polizas_baja_actualizada',
                'entity_type' => PolizaSolicitudBajaPendiente::class,
                'entity_id'   => $pendiente->id,
                'message'     => 'Tu solicitud de baja fue actualizada',
                'description' => mb_substr($mensaje, 0, 500),
                'metadata'    => [
                    'pendiente_id' => $pendiente->id,
                    'ruta'         => "/polizas/bandeja-bajas-pendientes?id={$pendiente->id}",
                ],
            ]);
        } catch (\Throwable $e) {
            Log::info("BandejaBajas: notificación a solicitante no enviada ({$e->getMessage()})");
        }
    }
}

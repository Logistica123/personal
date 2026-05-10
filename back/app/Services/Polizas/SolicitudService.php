<?php

namespace App\Services\Polizas;

use App\Models\Poliza;
use App\Models\PolizaAsegurado;
use App\Models\PolizaClausula;
use App\Models\PolizaEmailConfig;
use App\Models\PolizaSolicitud;
use App\Models\PolizaSolicitudAsegurado;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Symfony\Component\Mailer\Header\MetadataHeader;

/**
 * Orquesta el ciclo de vida de una solicitud de alta/baja:
 *  - `crearBorrador()` arma la solicitud + asegurados linkeados.
 *  - `previewRender()` devuelve el email renderizado SIN enviar.
 *  - `enviar()` envía vía SMTP, marca asegurados como `alta_solicitada`/`baja_solicitada`
 *    y deja la solicitud en estado `enviado`.
 */
class SolicitudService
{
    public function __construct(
        private readonly EmailRenderService $renderer,
        private readonly AdjuntosCheckService $adjuntosCheck,
        private readonly PolizaCertificadoIndividualService $certificadoService,
        private readonly OAuthMicrosoftService $oauth,
    ) {
    }

    /**
     * @param array $aseguradoIds  IDs de `polizas_asegurados` (camino tradicional —
     *                              los del cargado de PDF que están sin match o ya activos).
     * @param array $opciones {
     *     tipo_clausula_global?: 'ninguna'|'aplicar'|'previa_existente',
     *     clausula_global_id?: ?int,
     *     clausulas_individuales?: array<int,int>,  // [asegurado_id => clausula_id]
     *     persona_ids?: int[]   // BUGFIX 02 Issue 2: personas (proveedores/solicitudes
     *                           // pendientes) que NO son asegurados todavía. Cuando el
     *                           // tipo es 'alta' se crea un PolizaAsegurado on-the-fly
     *                           // por cada persona y se incluye en la solicitud.
     * }
     */
    public function crearBorrador(
        Poliza $poliza,
        string $tipo,             // 'alta' | 'baja'
        array $aseguradoIds,
        User $admin,
        array $opciones = [],
    ): PolizaSolicitud {
        if (!in_array($tipo, ['alta', 'baja'], true)) {
            throw new RuntimeException('tipo debe ser alta o baja');
        }
        $personaIds = $opciones['persona_ids'] ?? [];
        if (empty($aseguradoIds) && empty($personaIds)) {
            throw new RuntimeException('Sin asegurados ni personas seleccionados');
        }
        if (!empty($personaIds) && $tipo !== 'alta') {
            throw new RuntimeException('persona_ids sólo admitido para tipo=alta');
        }

        return DB::transaction(function () use ($poliza, $tipo, $aseguradoIds, $personaIds, $admin, $opciones) {
            $solicitud = PolizaSolicitud::create([
                'poliza_id'                  => $poliza->id,
                'tipo'                       => $tipo,
                'administrativo_user_id'     => $admin->id,
                'destinatarios_to_resueltos' => [],
                'destinatarios_cc_resueltos' => [],
                'asunto'                     => '',
                'body'                       => '',
                'estado'                     => 'borrador',
                'tipo_clausula_global'       => $opciones['tipo_clausula_global']  ?? 'ninguna',
                'clausula_global_id'         => $opciones['clausula_global_id']    ?? null,
                'clausulas_individuales'     => $opciones['clausulas_individuales'] ?? null,
            ]);

            // Asegurados ya existentes (path original).
            $idsFinal = $aseguradoIds;

            // BUGFIX 02 Issue 2 — crear PolizaAsegurado on-the-fly por persona.
            if (!empty($personaIds)) {
                $idsCreados = $this->crearAseguradosDesdePersonas($poliza, $personaIds);
                $idsFinal = array_values(array_unique([...$idsFinal, ...$idsCreados]));
            }

            foreach ($idsFinal as $aid) {
                PolizaSolicitudAsegurado::firstOrCreate([
                    'solicitud_id' => $solicitud->id,
                    'asegurado_id' => $aid,
                ]);
            }

            return $solicitud;
        });
    }

    /**
     * Crea (o reusa) `polizas_asegurados` para cada persona dada. Devuelve los IDs
     * de los registros (creados o existentes) listos para vincular a la solicitud.
     *
     * - Pólizas de personas (`tipo_asegurado='persona'`): identificador = CUIL.
     * - Pólizas de vehículos: identificador = `personas.patente` (la principal). Si
     *   la persona no tiene patente principal cargada se descarta con warning en
     *   los logs (la tabla `polizas_asegurados` tiene UNIQUE por póliza+identificador).
     */
    private function crearAseguradosDesdePersonas(Poliza $poliza, array $personaIds): array
    {
        $personas = \App\Models\Persona::query()
            ->whereIn('id', $personaIds)
            ->select(['id', 'apellidos', 'nombres', 'cuil', 'patente'])
            ->get();

        $ids = [];
        foreach ($personas as $p) {
            if ($poliza->tipo_asegurado === 'vehiculo') {
                $identificador = MatchingService::normalizarPatente($p->patente);
                $idTipo = 'patente';
                if (!$identificador) {
                    \Log::warning("Persona {$p->id} sin patente cargada — no se crea PolizaAsegurado", [
                        'poliza_id' => $poliza->id,
                    ]);
                    continue;
                }
            } else {
                $identificador = $p->cuil;
                $idTipo = 'cuil';
                if (!$identificador) {
                    \Log::warning("Persona {$p->id} sin CUIL cargado — no se crea PolizaAsegurado", [
                        'poliza_id' => $poliza->id,
                    ]);
                    continue;
                }
            }

            $existente = PolizaAsegurado::query()
                ->where('poliza_id', $poliza->id)
                ->where('identificador', $identificador)
                ->first();

            if ($existente) {
                // Reutilizar: vincular persona si faltaba, marcar como manual.
                if (!$existente->persona_id) {
                    $existente->update([
                        'persona_id'                 => $p->id,
                        'match_metodo'               => 'manual',
                        'match_score'                => 1.0,
                        'persona_estado_al_matchear' => MatchingService::calcularEstadoPersona($p),
                    ]);
                }
                $ids[] = $existente->id;
                continue;
            }

            $estadoSnap = MatchingService::calcularEstadoPersona($p);
            $nuevo = PolizaAsegurado::create([
                'poliza_id'                  => $poliza->id,
                'persona_id'                 => $p->id,
                'tipo_asegurado'             => $poliza->tipo_asegurado,
                'identificador'              => $identificador,
                'identificador_tipo'         => $idTipo,
                'nombre_apellido_pdf'        => trim(($p->apellidos ?? '') . ' ' . ($p->nombres ?? '')) ?: null,
                'estado'                     => 'activo',  // `enviar()` lo pasa a 'alta_solicitada'
                'match_metodo'               => 'manual',
                'match_score'                => 1.0,
                'persona_estado_al_matchear' => $estadoSnap,
            ]);
            $ids[] = $nuevo->id;
        }
        return $ids;
    }

    /**
     * Renderiza el email de una solicitud + check de adjuntos. NO envía ni guarda nada.
     * Útil para preview en UI.
     */
    public function previewRender(PolizaSolicitud $solicitud): array
    {
        $config = $this->cargarEmailConfig($solicitud);
        $asegurados = $this->cargarAsegurados($solicitud);
        $admin = $solicitud->administrativo;
        $opciones = $this->opcionesClausulas($solicitud);

        $rendered = $this->renderer->render(
            $solicitud->poliza()->with('aseguradora')->first(),
            $config, $asegurados, $admin, $opciones
        );

        $check = ['ok' => true, 'faltantes' => []];
        if ($solicitud->tipo === 'alta' && !empty($config->adjuntos_requeridos)) {
            $check = $this->adjuntosCheck->verificar($asegurados, $config->adjuntos_requeridos);
        }

        // Bloque A.3 — informar al admin desde qué casilla saldrá el email.
        // Si tiene OAuth Outlook activa: sale desde su cuenta (Microsoft Graph).
        // Si no: SMTP institucional con Reply-To al admin.
        $oauthAccount = $admin ? $this->oauth->findByUser($admin) : null;
        $remitente = $oauthAccount && $oauthAccount->activo
            ? [
                'modo'  => 'oauth',
                'email' => $oauthAccount->ms_account_email,
                'desc'  => 'Se enviará desde tu Outlook personal — quedará en tu carpeta "Enviados".',
            ]
            : [
                'modo'  => 'smtp',
                'email' => config('mail.from.address'),
                'desc'  => 'Se enviará desde la casilla institucional con Reply-To a tu cuenta. '
                         . 'Vinculá tu Outlook en /polizas/configuracion/mi-outlook si querés que salga desde tu casilla.',
            ];

        return [
            'solicitud_id'        => $solicitud->id,
            'tipo'                => $solicitud->tipo,
            'asegurados_count'    => $asegurados->count(),
            'asunto'              => $rendered['asunto'],
            'body'                => $rendered['body'],
            'destinatarios_to'    => $rendered['destinatarios_to'],
            'destinatarios_cc'    => $rendered['destinatarios_cc'],
            'destinatarios_bcc'   => $rendered['destinatarios_bcc'],
            'adjuntos_requeridos' => $config->adjuntos_requeridos ?? [],
            'adjuntos_check'      => $check,
            'remitente'           => $remitente,
        ];
    }

    /**
     * Envía el email y marca la solicitud como `enviado`.
     *
     * Si el driver de Mail configurado es `log` (default en dev), no manda email
     * real pero el flujo queda persistido igual — sirve para test E2E.
     */
    public function enviar(PolizaSolicitud $solicitud): PolizaSolicitud
    {
        if ($solicitud->estado !== 'borrador') {
            throw new RuntimeException("Solicitud {$solicitud->id} ya enviada o cerrada (estado={$solicitud->estado})");
        }

        $config = $this->cargarEmailConfig($solicitud);
        $asegurados = $this->cargarAsegurados($solicitud);
        $admin = $solicitud->administrativo;
        $opciones = $this->opcionesClausulas($solicitud);

        $rendered = $this->renderer->render(
            $solicitud->poliza()->with('aseguradora')->first(),
            $config, $asegurados, $admin, $opciones
        );

        // Validar adjuntos requeridos antes de mandar.
        if ($solicitud->tipo === 'alta' && !empty($config->adjuntos_requeridos)) {
            $check = $this->adjuntosCheck->verificar($asegurados, $config->adjuntos_requeridos);
            if (!$check['ok']) {
                throw new RuntimeException(
                    'Faltan adjuntos requeridos: ' . json_encode($check['faltantes'], JSON_UNESCAPED_UNICODE)
                );
            }
        }

        $messageId = $this->mandarMail($rendered, $admin);

        // ADDENDUM 13 Parte D — capturar el `conversationId` de Graph para que el
        // cron de Inbox pueda correlacionar las respuestas de la aseguradora.
        // Hace polling porque Graph no devuelve esto sincrónico desde sendMail.
        // Best-effort: si falla, lo intenta capturar el cron de inbox después.
        $conversationId = null;
        $oauthAccount = $this->oauth->findByUser($admin);
        if ($oauthAccount && $oauthAccount->activo) {
            try {
                $conversationId = $this->oauth->buscarConversationIdPorMessageId($oauthAccount, $messageId);
            } catch (\Throwable $e) {
                \Log::warning("No se pudo capturar conversationId post-envío: " . $e->getMessage());
            }
        }

        return DB::transaction(function () use ($solicitud, $rendered, $messageId, $conversationId, $asegurados) {
            $solicitud->update([
                'destinatarios_to_resueltos' => $rendered['destinatarios_to'],
                'destinatarios_cc_resueltos' => $rendered['destinatarios_cc'],
                'asunto'                     => $rendered['asunto'],
                'body'                       => $rendered['body'],
                'estado'                     => 'enviado',
                'enviado_en'                 => now(),
                'email_message_id'           => $messageId,
                'microsoft_conversation_id'  => $conversationId,
            ]);

            // ADDENDUM 13 Parte D — registrar el email enviado en el cache.
            \App\Models\PolizaSolicitudEmail::create([
                'solicitud_id'         => $solicitud->id,
                'direccion'            => 'enviado',
                'microsoft_message_id' => trim($messageId, '<>'),
                'conversation_id'      => $conversationId,
                'fecha_email'          => now(),
                'de_email'             => $solicitud->administrativo?->email ?? '',
                'de_nombre'            => $solicitud->administrativo?->name,
                'para_emails'          => $rendered['destinatarios_to'] ?? [],
                'cc_emails'            => $rendered['destinatarios_cc'] ?? [],
                'asunto'               => $rendered['asunto'] ?? '',
                'body_preview'         => mb_substr($rendered['body'] ?? '', 0, 500),
                'body_completo'        => $rendered['body'] ?? '',
                'tiene_adjuntos'       => false,
                'procesado'            => true,
            ]);

            $nuevoEstado = $solicitud->tipo === 'alta' ? 'alta_solicitada' : 'baja_solicitada';
            PolizaAsegurado::query()
                ->whereIn('id', $asegurados->pluck('id'))
                ->update(['estado' => $nuevoEstado]);

            return $solicitud->fresh();
        });
    }

    /**
     * Cierra una solicitud enviada con la respuesta de la aseguradora.
     *
     *  - tipo_respuesta='ok'         → solicitud=respondida_ok; asegurados pasan a `activo`
     *                                  (alta) o `dado_de_baja` (baja) con fecha efectiva.
     *  - tipo_respuesta='rechazada'  → solicitud=respondida_rechazada; rollback al estado
     *                                  previo razonable (alta→no_matcheado, baja→activo).
     */
    /**
     * @return array{solicitud: PolizaSolicitud, personas_pendientes_aprobacion: array}
     */
    public function confirmar(
        PolizaSolicitud $solicitud,
        string $tipoRespuesta,
        ?string $resumen = null
    ): array {
        if (!in_array($tipoRespuesta, ['ok', 'rechazada'], true)) {
            throw new RuntimeException("tipo_respuesta debe ser 'ok' o 'rechazada'");
        }
        if ($solicitud->estado !== 'enviado') {
            throw new RuntimeException("Solo se confirman solicitudes 'enviado' (estado actual: {$solicitud->estado})");
        }

        return DB::transaction(function () use ($solicitud, $tipoRespuesta, $resumen) {
            $aseguradoIds = PolizaSolicitudAsegurado::where('solicitud_id', $solicitud->id)
                ->pluck('asegurado_id')
                ->all();

            if ($tipoRespuesta === 'ok') {
                $solicitud->update([
                    'estado'                => 'respondida_ok',
                    'respuesta_recibida_en' => now(),
                    'respuesta_resumen'     => $resumen,
                ]);

                if ($solicitud->tipo === 'alta') {
                    PolizaAsegurado::whereIn('id', $aseguradoIds)->update([
                        'estado'              => 'activo',
                        'fecha_alta_efectiva' => now()->toDateString(),
                    ]);

                    // ADDENDUM 9 Parte B — generar certificado individual por
                    // asegurado activado. Falla silenciosa: si el PDF da error,
                    // se loguea pero no rompe el flujo de confirmación.
                    $aseguradosActivados = PolizaAsegurado::query()
                        ->whereIn('id', $aseguradoIds)
                        ->whereNotNull('persona_id')
                        ->get();
                    foreach ($aseguradosActivados as $a) {
                        try {
                            $this->certificadoService->generarYGuardar($a);
                        } catch (\Throwable $e) {
                            \Log::warning("No se pudo generar certificado individual para asegurado #{$a->id}: " . $e->getMessage());
                        }
                    }
                } else { // baja
                    PolizaAsegurado::whereIn('id', $aseguradoIds)->update([
                        'estado'              => 'dado_de_baja',
                        'fecha_baja_efectiva' => now()->toDateString(),
                    ]);
                }
            } else { // rechazada
                $solicitud->update([
                    'estado'                => 'respondida_rechazada',
                    'respuesta_recibida_en' => now(),
                    'respuesta_resumen'     => $resumen,
                ]);

                // Rollback al estado anterior razonable según el tipo de solicitud.
                $estadoVuelta = $solicitud->tipo === 'alta' ? 'no_matcheado' : 'activo';
                PolizaAsegurado::whereIn('id', $aseguradoIds)->update([
                    'estado' => $estadoVuelta,
                ]);
            }

            // Recalcular contador de vidas activas en la póliza.
            $solicitud->poliza->update([
                'cantidad_vidas_unidades' => PolizaAsegurado::where('poliza_id', $solicitud->poliza_id)
                    ->where('estado', 'activo')
                    ->count(),
            ]);

            // ADD 15 — detectar personas en es_solicitud pendiente de aprobar.
            $pendientes = [];
            if ($tipoRespuesta === 'ok' && $solicitud->tipo === 'alta'
                && $solicitud->poliza->ofrecer_auto_aprobacion_distribuidor) {

                $pendientes = \App\Models\Persona::query()
                    ->whereIn('id', PolizaAsegurado::query()
                        ->whereIn('id', $aseguradoIds)
                        ->whereNotNull('persona_id')
                        ->pluck('persona_id'))
                    ->where(function ($q) {
                        $q->where('es_solicitud', true)->orWhere('aprobado', false);
                    })
                    ->select(['id', 'apellidos', 'nombres', 'es_solicitud', 'aprobado'])
                    ->get()
                    ->map(fn ($p) => [
                        'persona_id'    => $p->id,
                        'nombre'        => trim(($p->apellidos ?? '') . ', ' . ($p->nombres ?? '')),
                        'es_solicitud'  => (bool) $p->es_solicitud,
                        'aprobado'      => (bool) $p->aprobado,
                    ])
                    ->all();
            }

            return [
                'solicitud'                       => $solicitud->fresh(),
                'personas_pendientes_aprobacion'  => $pendientes,
            ];
        });
    }

    /** ADD 15 — aprobar varias personas en una sola operación (post-confirmación de alta). */
    public function aprobarPersonasMasivo(array $personaIds, User $admin): array
    {
        $personas = \App\Models\Persona::whereIn('id', $personaIds)->get();
        $aprobados = [];
        $estadoActivoId = MatchingService::ESTADO_ACTIVO_ID;

        foreach ($personas as $p) {
            $p->update([
                'aprobado'      => true,
                'aprobado_at'   => now(),
                'aprobado_por'  => $admin->id,
                'es_solicitud'  => false,
                'estado_id'     => $estadoActivoId,
            ]);
            $aprobados[] = $p->id;
        }

        return ['aprobados' => $aprobados, 'count' => count($aprobados)];
    }

    /**
     * Envía el email vía OAuth Microsoft Graph desde el Outlook personal del
     * admin. ADDENDUM 11: el módulo opera SOLO con OAuth. Si el admin no tiene
     * cuenta vinculada o el OAuth falla, lanza `OAuthRequiredException` y
     * deja la solicitud en `borrador` para que reintente tras re-vincular.
     *
     * Devuelve el `Message-ID` para correlación de respuestas.
     */
    private function mandarMail(array $rendered, User $admin): string
    {
        $messageId = '<polizas-' . uniqid() . '@logisticaargentina.com.ar>';

        $account = $this->oauth->findByUser($admin);
        if (!$account) {
            throw new \App\Exceptions\Polizas\OAuthRequiredException(
                'Para enviar emails desde Pólizas tenés que vincular tu Outlook empresarial.',
                'sin_vincular'
            );
        }
        if (!$account->activo) {
            throw new \App\Exceptions\Polizas\OAuthRequiredException(
                'Tu vinculación de Outlook está inactiva (último error: ' . ($account->last_error ?: 'sin detalle') . '). Re-vinculá para reintentar.',
                'inactivo'
            );
        }

        try {
            return $this->oauth->sendEmail($account, $rendered, $messageId);
        } catch (\Throwable $e) {
            // Log + persistir el error para que el admin lo vea en la pantalla
            // "Mi Outlook" y entienda por qué tiene que re-vincular.
            \Log::warning("OAuth sendMail falló para admin {$admin->id}: " . $e->getMessage());
            $account->update(['last_error' => $e->getMessage()]);
            throw new \App\Exceptions\Polizas\OAuthRequiredException(
                'Microsoft rechazó el envío. Probablemente tu vinculación de Outlook expiró o fue revocada. Re-vinculá para reintentar. (' . $e->getMessage() . ')',
                'envio_fallido',
                previous: $e
            );
        }
    }

    /** Resuelve las cláusulas (global + individuales) guardadas en la solicitud para pasar al renderer. */
    private function opcionesClausulas(PolizaSolicitud $solicitud): array
    {
        $clausulaGlobal = $solicitud->clausula_global_id
            ? PolizaClausula::find($solicitud->clausula_global_id)
            : null;

        $individuales = [];
        foreach ((array) ($solicitud->clausulas_individuales ?? []) as $par) {
            $aid = (int) ($par['asegurado_id'] ?? 0);
            $cid = (int) ($par['clausula_id']  ?? 0);
            if ($aid && $cid) {
                $individuales[$aid] = PolizaClausula::find($cid);
            }
        }

        return [
            'tipo_clausula_global'   => $solicitud->tipo_clausula_global ?? 'ninguna',
            'clausula_global'        => $clausulaGlobal,
            'clausulas_individuales' => array_filter($individuales),
        ];
    }

    private function cargarEmailConfig(PolizaSolicitud $solicitud): PolizaEmailConfig
    {
        $config = PolizaEmailConfig::query()
            ->where('poliza_id', $solicitud->poliza_id)
            ->where('tipo', $solicitud->tipo)
            ->where('activo', true)
            ->first();

        if (!$config) {
            throw new RuntimeException(
                "No hay email_config activa para póliza {$solicitud->poliza_id} tipo {$solicitud->tipo}"
            );
        }
        return $config;
    }

    /** @return Collection<int,PolizaAsegurado> */
    private function cargarAsegurados(PolizaSolicitud $solicitud): Collection
    {
        return PolizaAsegurado::query()
            ->whereIn('id', PolizaSolicitudAsegurado::where('solicitud_id', $solicitud->id)->pluck('asegurado_id'))
            ->with('persona:id,apellidos,nombres,cuil,patente')
            ->get();
    }
}

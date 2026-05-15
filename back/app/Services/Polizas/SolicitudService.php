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
     * ADDENDUM 16 Parte B — crea una solicitud combinada (altas + bajas en un
     * único correo). Requiere que la póliza tenga config tipo='combinado'
     * activa (la existencia de esa row es la señal de "soporta combinado").
     *
     * Cada asegurado queda registrado en el pivot con `operacion='alta'|'baja'`
     * para que el render arme las dos secciones y `enviar()` mueva cada uno a
     * su estado correspondiente (alta_solicitada / baja_solicitada).
     *
     * @param int[] $altaAseguradoIds  IDs de PolizaAsegurado ya existentes (path tradicional).
     * @param int[] $altaPersonaIds    Personas que aún no son PolizaAsegurado (BUGFIX 02 — se crean al vuelo).
     * @param int[] $bajaAseguradoIds  IDs de PolizaAsegurado para dar de baja.
     */
    public function crearBorradorCombinado(
        Poliza $poliza,
        array $altaAseguradoIds,
        array $altaPersonaIds,
        array $bajaAseguradoIds,
        User $admin,
    ): PolizaSolicitud {
        if (empty($altaAseguradoIds) && empty($altaPersonaIds)) {
            throw new RuntimeException('Combinado requiere al menos 1 alta seleccionada.');
        }
        if (empty($bajaAseguradoIds)) {
            throw new RuntimeException('Combinado requiere al menos 1 baja seleccionada.');
        }

        $cfgCombinado = PolizaEmailConfig::query()
            ->where('poliza_id', $poliza->id)
            ->where('tipo', 'combinado')
            ->where('activo', true)
            ->first();
        if (!$cfgCombinado) {
            throw new RuntimeException("La póliza {$poliza->id} no soporta correo combinado (sin config tipo='combinado' activa).");
        }

        return DB::transaction(function () use ($poliza, $altaAseguradoIds, $altaPersonaIds, $bajaAseguradoIds, $admin) {
            $solicitud = PolizaSolicitud::create([
                'poliza_id'                  => $poliza->id,
                'tipo'                       => 'combinado',
                'administrativo_user_id'     => $admin->id,
                'destinatarios_to_resueltos' => [],
                'destinatarios_cc_resueltos' => [],
                'asunto'                     => '',
                'body'                       => '',
                'estado'                     => 'borrador',
                'tipo_clausula_global'       => 'ninguna',
            ]);

            // Altas: existentes + creados desde personas.
            $altasIds = $altaAseguradoIds;
            if (!empty($altaPersonaIds)) {
                $creados = $this->crearAseguradosDesdePersonas($poliza, $altaPersonaIds);
                $altasIds = array_values(array_unique([...$altasIds, ...$creados]));
            }
            foreach ($altasIds as $aid) {
                PolizaSolicitudAsegurado::firstOrCreate(
                    ['solicitud_id' => $solicitud->id, 'asegurado_id' => $aid],
                    ['operacion' => 'alta']
                );
            }
            foreach ($bajaAseguradoIds as $aid) {
                PolizaSolicitudAsegurado::firstOrCreate(
                    ['solicitud_id' => $solicitud->id, 'asegurado_id' => $aid],
                    ['operacion' => 'baja']
                );
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
        $admin = $solicitud->administrativo;
        $poliza = $solicitud->poliza()->with('aseguradora')->first();

        if ($solicitud->tipo === 'combinado') {
            [$cfgCombinado, $cfgAlta, $cfgBaja] = $this->cargarConfigsCombinado($solicitud);
            ['altas' => $altas, 'bajas' => $bajas] = $this->cargarAseguradosPorOperacion($solicitud);
            $rendered = $this->renderer->renderCombinado(
                $poliza, $cfgCombinado, $cfgAlta, $cfgBaja, $altas, $bajas, $admin
            );
            $asegurados = $altas->merge($bajas);
            $config = $cfgCombinado;
        } else {
            $config = $this->cargarEmailConfig($solicitud);
            $asegurados = $this->cargarAsegurados($solicitud);
            $opciones = $this->opcionesClausulas($solicitud);
            $rendered = $this->renderer->render($poliza, $config, $asegurados, $admin, $opciones);
        }

        $check = ['ok' => true, 'faltantes' => []];
        // Adjuntos solo se chequean para altas (también dentro de combinado).
        if ($solicitud->tipo === 'alta' && !empty($config->adjuntos_requeridos)) {
            $check = $this->adjuntosCheck->verificar($asegurados, $config->adjuntos_requeridos);
        } elseif ($solicitud->tipo === 'combinado') {
            $cfgAltaCheck = $this->cargarConfigAlta($solicitud->poliza_id);
            if ($cfgAltaCheck && !empty($cfgAltaCheck->adjuntos_requeridos)) {
                $altasOnly = $this->cargarAseguradosPorOperacion($solicitud)['altas'];
                if ($altasOnly->count() > 0) {
                    $check = $this->adjuntosCheck->verificar($altasOnly, $cfgAltaCheck->adjuntos_requeridos);
                }
            }
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
     * Carga las 3 configs necesarias para renderizar/enviar un combinado.
     * @return array{0:PolizaEmailConfig,1:PolizaEmailConfig,2:PolizaEmailConfig}
     */
    private function cargarConfigsCombinado(PolizaSolicitud $solicitud): array
    {
        $cfgCombinado = PolizaEmailConfig::query()
            ->where('poliza_id', $solicitud->poliza_id)
            ->where('tipo', 'combinado')
            ->where('activo', true)
            ->first();
        if (!$cfgCombinado) {
            throw new RuntimeException("No hay email_config tipo='combinado' activa para póliza {$solicitud->poliza_id}");
        }

        $cfgAlta = PolizaEmailConfig::query()
            ->where('poliza_id', $solicitud->poliza_id)
            ->where('tipo', 'alta')
            ->where('activo', true)
            ->first();
        $cfgBaja = PolizaEmailConfig::query()
            ->where('poliza_id', $solicitud->poliza_id)
            ->where('tipo', 'baja')
            ->where('activo', true)
            ->first();
        if (!$cfgAlta || !$cfgBaja) {
            throw new RuntimeException(
                "Combinado requiere configs de alta y baja activas (póliza {$solicitud->poliza_id})."
            );
        }

        return [$cfgCombinado, $cfgAlta, $cfgBaja];
    }

    private function cargarConfigAlta(int $polizaId): ?PolizaEmailConfig
    {
        return PolizaEmailConfig::query()
            ->where('poliza_id', $polizaId)
            ->where('tipo', 'alta')
            ->where('activo', true)
            ->first();
    }

    /**
     * Separa los asegurados del pivot por `operacion` (solo aplica a combinado).
     * @return array{altas:Collection<int,PolizaAsegurado>, bajas:Collection<int,PolizaAsegurado>}
     */
    private function cargarAseguradosPorOperacion(PolizaSolicitud $solicitud): array
    {
        $pivots = PolizaSolicitudAsegurado::where('solicitud_id', $solicitud->id)->get();

        $altaIds = $pivots->where('operacion', 'alta')->pluck('asegurado_id')->all();
        $bajaIds = $pivots->where('operacion', 'baja')->pluck('asegurado_id')->all();

        $altas = $altaIds ? PolizaAsegurado::query()
            ->whereIn('id', $altaIds)
            ->with('persona:id,apellidos,nombres,cuil,patente')
            ->get() : collect();

        $bajas = $bajaIds ? PolizaAsegurado::query()
            ->whereIn('id', $bajaIds)
            ->with('persona:id,apellidos,nombres,cuil,patente')
            ->get() : collect();

        return ['altas' => $altas, 'bajas' => $bajas];
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

        $admin = $solicitud->administrativo;
        $poliza = $solicitud->poliza()->with('aseguradora')->first();

        if ($solicitud->tipo === 'combinado') {
            [$cfgCombinado, $cfgAlta, $cfgBaja] = $this->cargarConfigsCombinado($solicitud);
            ['altas' => $altas, 'bajas' => $bajas] = $this->cargarAseguradosPorOperacion($solicitud);
            if ($altas->isEmpty() || $bajas->isEmpty()) {
                throw new RuntimeException("Combinado requiere al menos 1 alta y 1 baja en el momento del envío.");
            }
            $rendered = $this->renderer->renderCombinado(
                $poliza, $cfgCombinado, $cfgAlta, $cfgBaja, $altas, $bajas, $admin
            );

            // Validar adjuntos solo sobre el grupo de altas (las bajas no
            // requieren adjuntos en ninguna póliza).
            if (!empty($cfgAlta->adjuntos_requeridos)) {
                $check = $this->adjuntosCheck->verificar($altas, $cfgAlta->adjuntos_requeridos);
                if (!$check['ok']) {
                    throw new RuntimeException(
                        'Faltan adjuntos requeridos en altas: ' . json_encode($check['faltantes'], JSON_UNESCAPED_UNICODE)
                    );
                }
            }

            $asegurados = $altas->merge($bajas);
            $config = $cfgCombinado;
        } else {
            $config = $this->cargarEmailConfig($solicitud);
            $asegurados = $this->cargarAsegurados($solicitud);
            $opciones = $this->opcionesClausulas($solicitud);

            $rendered = $this->renderer->render($poliza, $config, $asegurados, $admin, $opciones);

            // Validar adjuntos requeridos antes de mandar.
            if ($solicitud->tipo === 'alta' && !empty($config->adjuntos_requeridos)) {
                $check = $this->adjuntosCheck->verificar($asegurados, $config->adjuntos_requeridos);
                if (!$check['ok']) {
                    throw new RuntimeException(
                        'Faltan adjuntos requeridos: ' . json_encode($check['faltantes'], JSON_UNESCAPED_UNICODE)
                    );
                }
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

            if ($solicitud->tipo === 'combinado') {
                // Altas y bajas a sus estados respectivos, no all-at-once.
                $altaIds = PolizaSolicitudAsegurado::where('solicitud_id', $solicitud->id)
                    ->where('operacion', 'alta')->pluck('asegurado_id');
                $bajaIds = PolizaSolicitudAsegurado::where('solicitud_id', $solicitud->id)
                    ->where('operacion', 'baja')->pluck('asegurado_id');
                if ($altaIds->isNotEmpty()) {
                    PolizaAsegurado::whereIn('id', $altaIds)->update(['estado' => 'alta_solicitada']);
                }
                if ($bajaIds->isNotEmpty()) {
                    PolizaAsegurado::whereIn('id', $bajaIds)->update(['estado' => 'baja_solicitada']);
                }
            } else {
                $nuevoEstado = $solicitud->tipo === 'alta' ? 'alta_solicitada' : 'baja_solicitada';
                PolizaAsegurado::query()
                    ->whereIn('id', $asegurados->pluck('id'))
                    ->update(['estado' => $nuevoEstado]);
            }

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
            $pivots = PolizaSolicitudAsegurado::where('solicitud_id', $solicitud->id)->get();
            $aseguradoIds = $pivots->pluck('asegurado_id')->all();

            // Para combinado, separar por operación; para alta/baja clásicas
            // todos van con la operación implícita del solicitud->tipo.
            if ($solicitud->tipo === 'combinado') {
                $altaIds = $pivots->where('operacion', 'alta')->pluck('asegurado_id')->all();
                $bajaIds = $pivots->where('operacion', 'baja')->pluck('asegurado_id')->all();
            } else {
                $altaIds = $solicitud->tipo === 'alta' ? $aseguradoIds : [];
                $bajaIds = $solicitud->tipo === 'baja' ? $aseguradoIds : [];
            }

            if ($tipoRespuesta === 'ok') {
                $solicitud->update([
                    'estado'                => 'respondida_ok',
                    'respuesta_recibida_en' => now(),
                    'respuesta_resumen'     => $resumen,
                ]);

                if (!empty($altaIds)) {
                    PolizaAsegurado::whereIn('id', $altaIds)->update([
                        'estado'              => 'activo',
                        'fecha_alta_efectiva' => now()->toDateString(),
                    ]);

                    // ADDENDUM 9 Parte B — generar certificado individual por
                    // asegurado activado. Falla silenciosa.
                    $aseguradosActivados = PolizaAsegurado::query()
                        ->whereIn('id', $altaIds)
                        ->whereNotNull('persona_id')
                        ->get();
                    foreach ($aseguradosActivados as $a) {
                        try {
                            $this->certificadoService->generarYGuardar($a);
                        } catch (\Throwable $e) {
                            \Log::warning("No se pudo generar certificado individual para asegurado #{$a->id}: " . $e->getMessage());
                        }
                    }
                }
                if (!empty($bajaIds)) {
                    PolizaAsegurado::whereIn('id', $bajaIds)->update([
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

                // Rollback al estado anterior razonable: alta → no_matcheado,
                // baja → activo (mantienen su vida útil en la póliza).
                if (!empty($altaIds)) {
                    PolizaAsegurado::whereIn('id', $altaIds)->update(['estado' => 'no_matcheado']);
                }
                if (!empty($bajaIds)) {
                    PolizaAsegurado::whereIn('id', $bajaIds)->update(['estado' => 'activo']);
                }
            }

            // Recalcular contador de vidas activas en la póliza.
            $solicitud->poliza->update([
                'cantidad_vidas_unidades' => PolizaAsegurado::where('poliza_id', $solicitud->poliza_id)
                    ->where('estado', 'activo')
                    ->count(),
            ]);

            // ADD 15 — detectar personas en es_solicitud pendiente de aprobar.
            // Solo aplica a asegurados que pasaron a `activo` (altas), tanto en
            // solicitudes tipo='alta' como combinadas con sección de altas.
            $pendientes = [];
            if ($tipoRespuesta === 'ok' && !empty($altaIds)
                && $solicitud->poliza->ofrecer_auto_aprobacion_distribuidor) {

                $pendientes = \App\Models\Persona::query()
                    ->whereIn('id', PolizaAsegurado::query()
                        ->whereIn('id', $altaIds)
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

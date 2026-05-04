<?php

namespace App\Services\Polizas;

use App\Models\Poliza;
use App\Models\PolizaAsegurado;
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
    ) {
    }

    public function crearBorrador(
        Poliza $poliza,
        string $tipo,             // 'alta' | 'baja'
        array $aseguradoIds,
        User $admin,
    ): PolizaSolicitud {
        if (!in_array($tipo, ['alta', 'baja'], true)) {
            throw new RuntimeException('tipo debe ser alta o baja');
        }
        if (empty($aseguradoIds)) {
            throw new RuntimeException('Sin asegurados seleccionados');
        }

        return DB::transaction(function () use ($poliza, $tipo, $aseguradoIds, $admin) {
            $solicitud = PolizaSolicitud::create([
                'poliza_id'                  => $poliza->id,
                'tipo'                       => $tipo,
                'administrativo_user_id'     => $admin->id,
                'destinatarios_to_resueltos' => [],
                'destinatarios_cc_resueltos' => [],
                'asunto'                     => '',
                'body'                       => '',
                'estado'                     => 'borrador',
            ]);

            foreach ($aseguradoIds as $aid) {
                PolizaSolicitudAsegurado::create([
                    'solicitud_id' => $solicitud->id,
                    'asegurado_id' => $aid,
                ]);
            }

            return $solicitud;
        });
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

        $rendered = $this->renderer->render($solicitud->poliza, $config, $asegurados, $admin);

        $check = ['ok' => true, 'faltantes' => []];
        if ($solicitud->tipo === 'alta' && !empty($config->adjuntos_requeridos)) {
            $check = $this->adjuntosCheck->verificar($asegurados, $config->adjuntos_requeridos);
        }

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

        $rendered = $this->renderer->render($solicitud->poliza, $config, $asegurados, $admin);

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

        return DB::transaction(function () use ($solicitud, $rendered, $messageId, $asegurados) {
            $solicitud->update([
                'destinatarios_to_resueltos' => $rendered['destinatarios_to'],
                'destinatarios_cc_resueltos' => $rendered['destinatarios_cc'],
                'asunto'                     => $rendered['asunto'],
                'body'                       => $rendered['body'],
                'estado'                     => 'enviado',
                'enviado_en'                 => now(),
                'email_message_id'           => $messageId,
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
    public function confirmar(
        PolizaSolicitud $solicitud,
        string $tipoRespuesta,
        ?string $resumen = null
    ): PolizaSolicitud {
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

            return $solicitud->fresh();
        });
    }

    /**
     * Envía vía Laravel Mail. Devuelve el `Message-ID` del SMTP si está disponible.
     * En driver `log` devuelve un id sintético para que la trazabilidad funcione igual.
     */
    private function mandarMail(array $rendered, User $admin): string
    {
        $messageId = '<polizas-' . uniqid() . '@logisticaargentina.com.ar>';

        Mail::raw($rendered['body'], function ($mail) use ($rendered, $admin, $messageId) {
            $mail->subject($rendered['asunto']);
            if (!empty($rendered['destinatarios_to'])) {
                $mail->to($rendered['destinatarios_to']);
            }
            if (!empty($rendered['destinatarios_cc'])) {
                $mail->cc($rendered['destinatarios_cc']);
            }
            if (!empty($rendered['destinatarios_bcc'])) {
                $mail->bcc($rendered['destinatarios_bcc']);
            }
            if ($admin->email) {
                $mail->replyTo($admin->email, $admin->name ?: '');
            }
            // Forzar Message-ID conocido para correlacionar con respuestas.
            $symfony = $mail->getSymfonyMessage();
            $symfony->getHeaders()->addIdHeader('Message-ID', trim($messageId, '<>'));
        });

        return $messageId;
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

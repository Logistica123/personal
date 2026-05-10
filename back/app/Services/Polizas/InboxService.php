<?php

namespace App\Services\Polizas;

use App\Models\Archivo;
use App\Models\PolizaAdminEmailAccount;
use App\Models\PolizaEndoso;
use App\Models\PolizaSolicitud;
use App\Models\PolizaSolicitudEmail;
use App\Models\PolizaSolicitudEmailAdjunto;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * ADDENDUM 13 Parte D — sincroniza el Inbox del Outlook del admin con la BD
 * local. Para cada solicitud `enviado` con `microsoft_conversation_id`, busca
 * los mensajes del thread vía Graph y cachea los recibidos.
 *
 * Auto-detecta endosos PDF por nombre y, si la póliza tiene
 * `auto_guardar_endosos_recibidos=true`, los vincula a `polizas_endosos`
 * automáticamente.
 */
class InboxService
{
    private const PATRONES_ENDOSO = [
        '/endoso/i',
        '/anexo/i',
        '/certificado/i',
        '/constancia/i',
        '/poliza/i',
        '/cobertura/i',
    ];

    /** Tamaño máximo (KB) para cachear el blob base64 inline. Encima → on-demand. */
    private const CACHE_INLINE_MAX_KB = 1024;

    public function __construct(private readonly OAuthMicrosoftService $oauth)
    {
    }

    /**
     * Sincroniza una cuenta del admin: busca el thread de cada solicitud activa
     * suya y persiste los mensajes nuevos recibidos.
     *
     * @return array{procesadas:int, mensajes_nuevos:int, adjuntos_nuevos:int, errores:array<int,string>}
     */
    public function sincronizarCuenta(PolizaAdminEmailAccount $cuenta): array
    {
        $stats = ['procesadas' => 0, 'mensajes_nuevos' => 0, 'adjuntos_nuevos' => 0, 'errores' => []];

        if (!$cuenta->activo) {
            $stats['errores'][] = "Cuenta {$cuenta->id} inactiva — saltada";
            return $stats;
        }

        $solicitudes = PolizaSolicitud::query()
            ->where('administrativo_user_id', $cuenta->user_id)
            ->where('estado', 'enviado')
            ->whereNotNull('microsoft_conversation_id')
            ->with('poliza')
            ->get();

        foreach ($solicitudes as $solicitud) {
            try {
                $resultado = $this->sincronizarSolicitud($cuenta, $solicitud);
                $stats['mensajes_nuevos'] += $resultado['mensajes_nuevos'];
                $stats['adjuntos_nuevos'] += $resultado['adjuntos_nuevos'];
                $stats['procesadas']++;
            } catch (\Throwable $e) {
                $stats['errores'][] = "solicitud #{$solicitud->id}: " . $e->getMessage();
                Log::warning("InboxService falló para solicitud {$solicitud->id}: " . $e->getMessage());
            }
        }

        return $stats;
    }

    /**
     * Sincroniza UN thread (solicitud) específico. Útil tanto para el cron
     * masivo como para "Sincronizar ahora" desde la UI.
     */
    public function sincronizarSolicitud(PolizaAdminEmailAccount $cuenta, PolizaSolicitud $solicitud): array
    {
        $stats = ['mensajes_nuevos' => 0, 'adjuntos_nuevos' => 0];

        if (!$solicitud->microsoft_conversation_id) {
            // Si por alguna razón no tenemos conversationId, intentar capturarlo ahora.
            if ($solicitud->email_message_id) {
                $cid = $this->oauth->buscarConversationIdPorMessageId($cuenta, $solicitud->email_message_id, 2);
                if ($cid) {
                    $solicitud->update(['microsoft_conversation_id' => $cid]);
                }
            }
            if (!$solicitud->microsoft_conversation_id) {
                throw new \RuntimeException("Solicitud sin conversation_id resoluble");
            }
        }

        $mensajes = $this->oauth->listarMensajesDeConversacion($cuenta, $solicitud->microsoft_conversation_id);
        $emailAdminLower = strtolower((string) $cuenta->ms_account_email);

        foreach ($mensajes as $msg) {
            // Evitar duplicar — Graph reusa el `id` cross-instalaciones; usamos
            // `internetMessageId` que es único globalmente.
            $msgId = $msg['internetMessageId'] ?? $msg['id'] ?? null;
            if (!$msgId) continue;

            $existente = PolizaSolicitudEmail::query()
                ->where('microsoft_message_id', trim($msgId, '<>'))
                ->first();
            if ($existente) {
                continue;  // ya cacheado
            }

            $fromEmail = strtolower((string) ($msg['from']['emailAddress']['address'] ?? ''));
            $direccion = $fromEmail === $emailAdminLower ? 'enviado' : 'recibido';

            $email = PolizaSolicitudEmail::create([
                'solicitud_id'         => $solicitud->id,
                'direccion'            => $direccion,
                'microsoft_message_id' => trim($msgId, '<>'),
                'conversation_id'      => $msg['conversationId'] ?? $solicitud->microsoft_conversation_id,
                'fecha_email'          => $msg['receivedDateTime'] ?? $msg['sentDateTime'] ?? now(),
                'de_email'             => $msg['from']['emailAddress']['address'] ?? '',
                'de_nombre'            => $msg['from']['emailAddress']['name'] ?? null,
                'para_emails'          => collect($msg['toRecipients'] ?? [])
                    ->pluck('emailAddress.address')->filter()->values()->all(),
                'cc_emails'            => collect($msg['ccRecipients'] ?? [])
                    ->pluck('emailAddress.address')->filter()->values()->all(),
                'asunto'               => $msg['subject'] ?? '(sin asunto)',
                'body_preview'         => mb_substr($msg['bodyPreview'] ?? '', 0, 500),
                'body_completo'        => $msg['body']['content'] ?? null,
                'tiene_adjuntos'       => (bool) ($msg['hasAttachments'] ?? false),
                'procesado'            => false,
            ]);
            $stats['mensajes_nuevos']++;

            // Sincronizar adjuntos del mensaje (sin contenido, solo metadata).
            if ($email->tiene_adjuntos) {
                try {
                    $adjuntos = $this->oauth->listarAdjuntosDeMensaje($cuenta, $msg['id']);
                    foreach ($adjuntos as $adj) {
                        $tamano = (int) ($adj['size'] ?? 0);
                        $esEndoso = $this->detectarEndoso($adj['name'] ?? '', $adj['contentType'] ?? '');
                        $reg = PolizaSolicitudEmailAdjunto::create([
                            'email_id'                => $email->id,
                            'nombre_archivo'          => $adj['name'] ?? 'adjunto',
                            'mime_type'               => $adj['contentType'] ?? 'application/octet-stream',
                            'tamano_bytes'            => $tamano,
                            'microsoft_attachment_id' => $adj['id'] ?? null,
                            'es_endoso'               => $esEndoso,
                        ]);
                        $stats['adjuntos_nuevos']++;

                        // Si la póliza está configurada para auto-guardar endosos,
                        // y este adjunto fue detectado como endoso, lo vinculamos.
                        if ($esEndoso && $solicitud->poliza?->auto_guardar_endosos_recibidos) {
                            try {
                                $this->vincularAdjuntoComoEndoso($cuenta, $reg, $solicitud, $msg['id']);
                            } catch (\Throwable $e) {
                                Log::warning("Auto-guardar endoso falló: " . $e->getMessage());
                            }
                        }
                    }
                } catch (\Throwable $e) {
                    Log::warning("listAttachments falló para msg {$msg['id']}: " . $e->getMessage());
                }
            }
        }

        return $stats;
    }

    /**
     * Detecta si un adjunto es candidato a endoso por nombre/MIME.
     */
    public static function detectarEndoso(string $nombre, string $mime): bool
    {
        if (stripos($mime, 'pdf') === false) return false;
        foreach (self::PATRONES_ENDOSO as $patron) {
            if (preg_match($patron, $nombre)) return true;
        }
        return false;
    }

    /**
     * Descarga el contenido binario del adjunto desde Graph (con cache).
     * Si ya está en `storage_path`, lo lee de disco. Si está inline en
     * `contenido_base64`, lo decodifica. Si no, lo baja de Graph y cachea.
     */
    public function obtenerContenidoAdjunto(PolizaAdminEmailAccount $cuenta, PolizaSolicitudEmailAdjunto $adjunto): string
    {
        if ($adjunto->storage_path && Storage::exists($adjunto->storage_path)) {
            return Storage::get($adjunto->storage_path);
        }
        if ($adjunto->contenido_base64) {
            return base64_decode($adjunto->contenido_base64);
        }
        if (!$adjunto->microsoft_attachment_id) {
            throw new \RuntimeException("Adjunto sin microsoft_attachment_id — no se puede recuperar de Graph.");
        }

        $email = $adjunto->email;
        if (!$email?->microsoft_message_id) {
            throw new \RuntimeException("Email asociado sin microsoft_message_id.");
        }

        $msg = PolizaSolicitudEmail::find($adjunto->email_id);
        // El `microsoft_message_id` que tenemos cacheado es el `internetMessageId`,
        // pero `descargarAdjunto` necesita el `id` interno de Graph. Lo recuperamos
        // listando el mensaje por `internetMessageId`.
        $mensajesGraph = $this->oauth->listarMensajesDeConversacion(
            $cuenta,
            $msg->conversation_id ?: ''
        );
        $msgGraphId = null;
        foreach ($mensajesGraph as $m) {
            if (trim((string) ($m['internetMessageId'] ?? ''), '<>') === $msg->microsoft_message_id) {
                $msgGraphId = $m['id'];
                break;
            }
        }
        if (!$msgGraphId) {
            throw new \RuntimeException("Mensaje no encontrado en Graph (puede haber sido borrado del Inbox).");
        }

        $adjGraph = $this->oauth->descargarAdjunto($cuenta, $msgGraphId, $adjunto->microsoft_attachment_id);
        $contentB64 = $adjGraph['contentBytes'] ?? '';
        if (!$contentB64) {
            throw new \RuntimeException("Graph devolvió adjunto sin contentBytes.");
        }
        $bytes = base64_decode($contentB64);

        // Cachear: si entra inline, en BD; si no, en disco.
        if (strlen($bytes) <= self::CACHE_INLINE_MAX_KB * 1024) {
            $adjunto->update(['contenido_base64' => $contentB64, 'descargado_en' => now()]);
        } else {
            $path = "polizas/inbox/{$adjunto->id}-" . preg_replace('/[^A-Za-z0-9._-]+/', '_', $adjunto->nombre_archivo);
            Storage::put($path, $bytes);
            $adjunto->update(['storage_path' => $path, 'descargado_en' => now()]);
        }

        return $bytes;
    }

    /**
     * Crea un `polizas_endosos` con el contenido del adjunto y lo vincula.
     * Idempotente: si el adjunto ya tiene `endoso_id`, no duplica.
     */
    public function vincularAdjuntoComoEndoso(
        PolizaAdminEmailAccount $cuenta,
        PolizaSolicitudEmailAdjunto $adjunto,
        PolizaSolicitud $solicitud,
        ?string $msgGraphId = null
    ): PolizaEndoso {
        if ($adjunto->endoso_id) {
            $endoso = PolizaEndoso::find($adjunto->endoso_id);
            if ($endoso) return $endoso;
        }

        $bytes = $this->obtenerContenidoAdjunto($cuenta, $adjunto);

        return DB::transaction(function () use ($adjunto, $solicitud, $bytes) {
            // Heurística: número de endoso = primer match de \d{2,8} en el nombre.
            $numero = '—';
            if (preg_match('/(\d{2,8})/', $adjunto->nombre_archivo, $m)) {
                $numero = $m[1];
            }

            $endoso = PolizaEndoso::create([
                'poliza_id'      => $solicitud->poliza_id,
                'numero_endoso'  => $numero,
                'tipo'           => 'asegurados_adherentes',
                'fecha_emision'  => now()->toDateString(),
                'descripcion'    => "Endoso recibido en respuesta a solicitud #{$solicitud->id}",
            ]);

            // Persistir el archivo en `archivos` para que aparezca en Documentos.
            $path = "polizas/{$solicitud->poliza_id}/endosos/{$endoso->id}-" .
                    preg_replace('/[^A-Za-z0-9._-]+/', '_', $adjunto->nombre_archivo);
            Storage::put($path, $bytes);

            $archivo = Archivo::create([
                'persona_id'      => null,  // endoso no es de una persona individual
                'categoria'       => 'endoso_aseguradora',
                'nombre_original' => $adjunto->nombre_archivo,
                'carpeta'         => "polizas/{$solicitud->poliza_id}/endosos",
                'ruta'            => $path,
                'disk'            => config('filesystems.default'),
                'mime'            => $adjunto->mime_type,
                'size'            => strlen($bytes),
            ]);

            $endoso->update(['archivo_id' => $archivo->id]);
            $adjunto->update(['endoso_id' => $endoso->id, 'storage_path' => $path]);

            return $endoso;
        });
    }
}

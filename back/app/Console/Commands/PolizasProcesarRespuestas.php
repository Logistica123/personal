<?php

namespace App\Console\Commands;

use App\Models\PolizaAdminEmailAccount;
use App\Models\PolizaSolicitud;
use App\Services\Polizas\OAuthMicrosoftService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Bloque D.3 — Auto-detección de respuestas de aseguradoras.
 *
 * Por cada admin con cuenta OAuth activa, lee los mensajes recibidos en su
 * Inbox desde la última corrida y los matchea contra solicitudes en estado
 * `enviado` que estén esperando respuesta. Si la respuesta dice algo como
 * "OK / aprobado / confirmado" → marca la solicitud como `respondida_ok`
 * automáticamente. Si menciona rechazo → `respondida_rechazada`.
 *
 * Reglas de matching:
 *  1. Mismo `email_message_id` (en `In-Reply-To` / `References`) — match seguro.
 *  2. Mismo `conversationId` de Graph y remitente coincide con destinatarios
 *     originales de la solicitud — match medio.
 *  3. Asunto contiene `Re:` + número de póliza/asunto original (heurístico).
 *
 * Para evitar falsos positivos, **NO confirma silenciosamente**: registra un
 * candidato y deja la confirmación final al admin (queda como flag
 * `respuesta_resumen` con el preview del email recibido). El admin pulsa
 * "Confirmar" desde la bandeja.
 *
 * Uso: php artisan polizas:procesar-respuestas-aseguradora
 */
class PolizasProcesarRespuestas extends Command
{
    protected $signature = 'polizas:procesar-respuestas-aseguradora {--ventana=24 : Horas hacia atrás a leer (default 24)}';
    protected $description = 'Lee Inbox de admins con OAuth y matchea respuestas contra solicitudes enviadas';

    public function handle(OAuthMicrosoftService $oauth): int
    {
        $ventanaHoras = (int) $this->option('ventana');
        $since = Carbon::now()->subHours($ventanaHoras);

        $cuentas = PolizaAdminEmailAccount::query()
            ->where('activo', true)
            ->whereNotNull('access_token')
            ->get();

        if ($cuentas->isEmpty()) {
            $this->info('Sin cuentas OAuth activas.');
            return self::SUCCESS;
        }

        $totalProcesados = 0;
        $totalCandidatos = 0;

        foreach ($cuentas as $cuenta) {
            $this->line("→ Procesando inbox de {$cuenta->ms_account_email}");
            try {
                $mensajes = $oauth->listInboxMessagesSince($cuenta, $since);
            } catch (\Throwable $e) {
                $this->warn("   inbox falló: " . $e->getMessage());
                continue;
            }

            // Solicitudes enviadas por ESTE admin que están esperando respuesta.
            $pendientes = PolizaSolicitud::query()
                ->where('administrativo_user_id', $cuenta->user_id)
                ->where('estado', 'enviado')
                ->whereNotNull('email_message_id')
                ->get();

            if ($pendientes->isEmpty()) {
                continue;
            }

            // Mapa para lookup rápido por message_id (sin <>).
            $byMessageId = $pendientes->keyBy(fn ($s) => trim((string) $s->email_message_id, '<>'));

            foreach ($mensajes as $msg) {
                $totalProcesados++;
                $candidata = $this->matchear($msg, $byMessageId, $pendientes);
                if (!$candidata) continue;

                [$solicitud, $clasificacion, $razon] = $candidata;
                $totalCandidatos++;

                // NO confirmamos silenciosamente — guardamos el candidato como
                // resumen en la solicitud para que el admin lo revise y confirme.
                $solicitud->update([
                    'respuesta_resumen' => sprintf(
                        "[%s] Posible respuesta detectada vía Outlook (%s)\n" .
                        "De: %s\nAsunto: %s\nFecha: %s\n\n%s",
                        strtoupper($clasificacion),
                        $razon,
                        $msg['from']['emailAddress']['address'] ?? '?',
                        $msg['subject'] ?? '?',
                        $msg['receivedDateTime'] ?? '?',
                        substr($msg['bodyPreview'] ?? '', 0, 500),
                    ),
                ]);
            }
        }

        $this->info("Procesados {$totalProcesados} mensajes · {$totalCandidatos} candidatos detectados.");
        return self::SUCCESS;
    }

    /**
     * Devuelve `[solicitud, 'ok'|'rechazada'|'duda', 'razon']` si encontramos
     * un match. Null si el mensaje no corresponde a ninguna solicitud activa.
     */
    private function matchear(array $msg, \Illuminate\Support\Collection $byMessageId, \Illuminate\Support\Collection $pendientes): ?array
    {
        // 1) Match seguro por In-Reply-To / References.
        $headers = $msg['internetMessageHeaders'] ?? [];
        foreach ($headers as $h) {
            $nombre = strtolower((string) ($h['name'] ?? ''));
            if (!in_array($nombre, ['in-reply-to', 'references'], true)) continue;
            $val = trim((string) ($h['value'] ?? ''), '<>');
            if (!$val) continue;
            // El header de References puede tener varios IDs separados; chequeamos cada uno.
            foreach (preg_split('/\s+/', $val) as $candidatoId) {
                $clean = trim($candidatoId, '<>');
                if ($byMessageId->has($clean)) {
                    return [$byMessageId->get($clean), $this->clasificarTexto($msg), 'In-Reply-To match'];
                }
            }
        }

        // 2) Match medio por remitente + asunto contiene "Re:" y referencia poliza.
        $from = strtolower((string) ($msg['from']['emailAddress']['address'] ?? ''));
        $subject = (string) ($msg['subject'] ?? '');
        if ($from && stripos($subject, 're:') !== false) {
            foreach ($pendientes as $sol) {
                $destinatarios = array_map('strtolower', (array) ($sol->destinatarios_to_resueltos ?? []));
                if (in_array($from, $destinatarios, true)
                    && stripos($subject, $sol->asunto) !== false) {
                    return [$sol, $this->clasificarTexto($msg), 'remitente + asunto'];
                }
            }
        }

        return null;
    }

    /**
     * Heurística simple sobre subject + bodyPreview para clasificar el mensaje.
     * Conservador — ante duda, marca 'duda' (el admin decide).
     */
    private function clasificarTexto(array $msg): string
    {
        $texto = strtolower(($msg['subject'] ?? '') . ' ' . ($msg['bodyPreview'] ?? ''));
        $okPatrones = ['confirmad', 'aprobad', ' ok ', 'procesad', 'realizad'];
        $rechPatrones = ['rechazad', 'no procede', 'denegad', 'observac'];
        foreach ($okPatrones as $p) {
            if (str_contains($texto, $p)) return 'ok';
        }
        foreach ($rechPatrones as $p) {
            if (str_contains($texto, $p)) return 'rechazada';
        }
        return 'duda';
    }
}

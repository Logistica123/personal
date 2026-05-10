<?php

namespace App\Services\Polizas;

use App\Models\PolizaAdminEmailAccount;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * ADDENDUM 9 Parte A — cliente OAuth para Microsoft Entra ID + Microsoft Graph.
 *
 * Flow Authorization Code:
 *  1. `getAuthorizeUrl(user)` arma la URL a la que el navegador del admin se
 *     redirige (lo lleva a login.microsoftonline.com con MFA si aplica). Guarda
 *     un `state` aleatorio en cache asociado al user_id (TTL 10 min) para
 *     prevenir CSRF en el callback.
 *  2. Microsoft redirige al `redirect_uri` con `?code=...&state=...`.
 *     `exchangeCode()` valida el state, intercambia el code por
 *     access_token + refresh_token vía POST al token endpoint, y persiste
 *     todo en `polizas_admin_email_accounts`.
 *  3. `refreshAccessToken()` se invoca antes de cada envío (y desde el cron
 *     `polizas:refresh-tokens-outlook` para los que vencen pronto). Si el
 *     refresh_token también caduca/se revoca, marca `activo=false` y guarda
 *     el error en `last_error` — el admin tiene que re-vincular.
 *  4. `sendEmail()` invoca `POST /me/sendMail` de Graph con `saveToSentItems=true`
 *     para que el mail aparezca en la carpeta "Enviados" del admin.
 *
 * No usamos Resource Owner Password Credentials Flow — el spec lo prohíbe
 * explícitamente porque pediría MFA dentro de DistriApp.
 */
class OAuthMicrosoftService
{
    public const CACHE_PREFIX = 'oauth_ms_state:';
    public const STATE_TTL_SECONDS = 600;            // 10 min para completar el flow
    public const REFRESH_BEFORE_EXPIRY_SECONDS = 1800; // refrescar si vence en <30min

    /**
     * Devuelve la URL a Microsoft a la que el navegador del admin debe ser
     * redirigido para iniciar el flow. Persiste un `state` ligado al user_id
     * en cache para validarlo en el callback.
     */
    public function getAuthorizeUrl(User $user): string
    {
        $state = Str::random(40);
        Cache::put(self::CACHE_PREFIX . $state, [
            'user_id'    => $user->id,
            'created_at' => time(),
        ], self::STATE_TTL_SECONDS);

        $config = $this->config();
        $authorizeBase = str_replace('{tenant}', $config['tenant_id'], $config['authorize_url']);

        $params = [
            'client_id'     => $config['client_id'],
            'response_type' => 'code',
            'redirect_uri'  => $config['redirect_uri'],
            'response_mode' => 'query',
            'scope'         => $config['scope'],
            'state'         => $state,
            // `prompt=select_account` deja al admin elegir cuenta si tiene
            // varias activas en el navegador (común con cuentas personales
            // mezcladas con corporativas).
            'prompt'        => 'select_account',
        ];

        return $authorizeBase . '?' . http_build_query($params);
    }

    /**
     * Recibe el `code` + `state` que Microsoft devuelve al callback.
     * Valida state, intercambia tokens y persiste/actualiza la cuenta del admin.
     */
    public function exchangeCode(string $code, string $state): PolizaAdminEmailAccount
    {
        $entry = Cache::pull(self::CACHE_PREFIX . $state);
        if (!$entry || empty($entry['user_id'])) {
            throw new RuntimeException('State inválido o expirado. Volvé a iniciar la vinculación.');
        }

        $userId = (int) $entry['user_id'];
        $config = $this->config();
        $tokenUrl = str_replace('{tenant}', $config['tenant_id'], $config['token_url']);

        $resp = Http::asForm()->post($tokenUrl, [
            'client_id'     => $config['client_id'],
            'client_secret' => $config['client_secret'],
            'code'          => $code,
            'redirect_uri'  => $config['redirect_uri'],
            'grant_type'    => 'authorization_code',
            'scope'         => $config['scope'],
        ]);

        if (!$resp->successful()) {
            throw new RuntimeException('Microsoft rechazó el code: ' . $resp->status() . ' ' . $resp->body());
        }

        $body = $resp->json();
        $accessToken  = $body['access_token']  ?? null;
        $refreshToken = $body['refresh_token'] ?? null;
        $expiresIn    = (int) ($body['expires_in'] ?? 3600);
        $scope        = $body['scope'] ?? $config['scope'];

        if (!$accessToken || !$refreshToken) {
            throw new RuntimeException('Respuesta de token incompleta.');
        }

        // Resolver email + id de la cuenta vinculada.
        $me = $this->fetchMe($accessToken);
        $email = $me['mail'] ?? $me['userPrincipalName'] ?? null;
        $msId  = $me['id'] ?? null;

        return PolizaAdminEmailAccount::updateOrCreate(
            ['user_id' => $userId, 'provider' => 'microsoft'],
            [
                'ms_account_email' => $email,
                'ms_account_id'    => $msId,
                'access_token'     => $accessToken,
                'refresh_token'    => $refreshToken,
                'token_expires_at' => Carbon::now()->addSeconds($expiresIn - 60),
                'scope'            => $scope,
                'last_refresh_at'  => Carbon::now(),
                'last_error'       => null,
                'activo'           => true,
            ]
        );
    }

    /**
     * Renueva el access_token usando el refresh_token. Si Microsoft devuelve
     * un nuevo refresh_token (rotación opcional), lo guarda. Si falla por
     * revocación o expiración del refresh, marca la cuenta como `activo=false`
     * con el error para que el admin re-vincule.
     */
    public function refreshAccessToken(PolizaAdminEmailAccount $acc): PolizaAdminEmailAccount
    {
        if (!$acc->refresh_token) {
            throw new RuntimeException("Cuenta {$acc->id} sin refresh_token");
        }

        $config = $this->config();
        $tokenUrl = str_replace('{tenant}', $config['tenant_id'], $config['token_url']);

        $resp = Http::asForm()->post($tokenUrl, [
            'client_id'     => $config['client_id'],
            'client_secret' => $config['client_secret'],
            'grant_type'    => 'refresh_token',
            'refresh_token' => $acc->refresh_token,
            'scope'         => $config['scope'],
        ]);

        if (!$resp->successful()) {
            $err = "refresh fallido: {$resp->status()} {$resp->body()}";
            $acc->update(['activo' => false, 'last_error' => $err]);
            throw new RuntimeException($err);
        }

        $body = $resp->json();
        $accessToken = $body['access_token'] ?? null;
        $expiresIn   = (int) ($body['expires_in'] ?? 3600);
        // Microsoft puede o no rotar el refresh_token.
        $newRefresh = $body['refresh_token'] ?? $acc->refresh_token;
        $scope = $body['scope'] ?? $acc->scope;

        if (!$accessToken) {
            throw new RuntimeException('Respuesta de refresh sin access_token');
        }

        $acc->update([
            'access_token'     => $accessToken,
            'refresh_token'    => $newRefresh,
            'token_expires_at' => Carbon::now()->addSeconds($expiresIn - 60),
            'scope'            => $scope,
            'last_refresh_at'  => Carbon::now(),
            'last_error'       => null,
            'activo'           => true,
        ]);

        return $acc->fresh();
    }

    /**
     * Garantiza que el access_token esté vigente (refresca si vence pronto).
     */
    public function ensureValidToken(PolizaAdminEmailAccount $acc): PolizaAdminEmailAccount
    {
        if (!$acc->activo) {
            throw new RuntimeException("Cuenta {$acc->id} desactivada. Re-vinculación necesaria.");
        }
        $vence = $acc->token_expires_at;
        if (!$vence || $vence->lt(Carbon::now()->addSeconds(self::REFRESH_BEFORE_EXPIRY_SECONDS))) {
            return $this->refreshAccessToken($acc);
        }
        return $acc;
    }

    /**
     * Manda un email vía Microsoft Graph `/me/sendMail`. El email aparece en
     * "Enviados" del admin (saveToSentItems=true).
     *
     * Devuelve un `Message-ID` sintético para correlación interna —
     * Graph no expone el internetMessageId directamente desde sendMail.
     *
     * @param array $rendered {
     *   asunto: string,
     *   body: string,
     *   destinatarios_to: string[],
     *   destinatarios_cc?: string[],
     *   destinatarios_bcc?: string[],
     * }
     */
    public function sendEmail(PolizaAdminEmailAccount $acc, array $rendered, string $messageId): string
    {
        $acc = $this->ensureValidToken($acc);

        $payload = [
            'message' => [
                'subject' => $rendered['asunto'] ?? '',
                'body' => [
                    'contentType' => 'Text',
                    'content'     => $rendered['body'] ?? '',
                ],
                'toRecipients'  => $this->mapRecipients($rendered['destinatarios_to']  ?? []),
                'ccRecipients'  => $this->mapRecipients($rendered['destinatarios_cc']  ?? []),
                'bccRecipients' => $this->mapRecipients($rendered['destinatarios_bcc'] ?? []),
                // X-headers personalizados (Graph solo permite los que empiezan con `x-`).
                'internetMessageHeaders' => [
                    [
                        'name'  => 'x-polizas-message-id',
                        'value' => trim($messageId, '<>'),
                    ],
                ],
            ],
            'saveToSentItems' => true,
        ];

        $url = rtrim($this->config()['graph_base'], '/') . '/me/sendMail';
        $resp = Http::withToken($acc->access_token)
            ->withHeaders(['Content-Type' => 'application/json'])
            ->post($url, $payload);

        if (!$resp->successful()) {
            throw new RuntimeException("Graph sendMail falló: {$resp->status()} {$resp->body()}");
        }

        return $messageId;
    }

    /**
     * ADDENDUM 13 Parte D — busca el último mensaje saliente del admin que matchee
     * el `x-polizas-message-id` que pusimos al enviar. Devuelve el `conversationId`
     * de Graph para correlacionar todas las respuestas posteriores.
     *
     * Hace polling: como `sendMail` es asíncrono en Graph, el mensaje puede tardar
     * varios segundos en aparecer en SentItems. Reintenta hasta `maxRetries` veces
     * con delay creciente.
     */
    public function buscarConversationIdPorMessageId(PolizaAdminEmailAccount $acc, string $messageId, int $maxRetries = 5): ?string
    {
        $acc = $this->ensureValidToken($acc);
        $messageIdClean = trim($messageId, '<>');
        $url = rtrim($this->config()['graph_base'], '/') . '/me/mailFolders/SentItems/messages';

        for ($i = 0; $i < $maxRetries; $i++) {
            if ($i > 0) sleep(2 + $i);  // 2, 3, 4, 5, 6 segundos

            $resp = Http::withToken($acc->access_token)->get($url, [
                '$select'  => 'id,conversationId,internetMessageHeaders,sentDateTime',
                '$orderby' => 'sentDateTime desc',
                '$top'     => 20,
            ]);
            if (!$resp->successful()) continue;

            foreach ($resp->json('value', []) as $msg) {
                foreach ($msg['internetMessageHeaders'] ?? [] as $h) {
                    if (strtolower($h['name'] ?? '') === 'x-polizas-message-id'
                        && trim((string) ($h['value'] ?? '')) === $messageIdClean) {
                        return $msg['conversationId'] ?? null;
                    }
                }
            }
        }
        return null;
    }

    /**
     * ADDENDUM 13 Parte D — trae todos los mensajes de una conversación.
     * Incluye el mensaje original enviado por nosotros + todas las respuestas
     * de la aseguradora.
     *
     * @return array<int,array> raw messages de Graph
     */
    public function listarMensajesDeConversacion(PolizaAdminEmailAccount $acc, string $conversationId, int $top = 50): array
    {
        $acc = $this->ensureValidToken($acc);
        $url = rtrim($this->config()['graph_base'], '/') . '/me/messages';
        $resp = Http::withToken($acc->access_token)->get($url, [
            '$filter'  => "conversationId eq '{$conversationId}'",
            '$select'  => 'id,internetMessageId,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,hasAttachments,conversationId,isDraft',
            '$orderby' => 'receivedDateTime asc',
            '$top'     => $top,
        ]);
        if (!$resp->successful()) {
            throw new RuntimeException("Graph listMessages conversación falló: {$resp->status()} {$resp->body()}");
        }
        return $resp->json('value', []);
    }

    /**
     * ADDENDUM 13 Parte D — listado de adjuntos de un mensaje específico.
     * Incluye el contenido base64 si pasamos `$expandContent=true` (cuidado con
     * tamaños — Graph limita el body a unos pocos MB).
     */
    public function listarAdjuntosDeMensaje(PolizaAdminEmailAccount $acc, string $messageId, bool $expandContent = false): array
    {
        $acc = $this->ensureValidToken($acc);
        $url = rtrim($this->config()['graph_base'], '/') . "/me/messages/{$messageId}/attachments";
        $params = $expandContent ? [] : ['$select' => 'id,name,contentType,size,isInline'];
        $resp = Http::withToken($acc->access_token)->get($url, $params);
        if (!$resp->successful()) {
            throw new RuntimeException("Graph listAttachments falló: {$resp->status()} {$resp->body()}");
        }
        return $resp->json('value', []);
    }

    /**
     * ADDENDUM 13 Parte D — descarga UN adjunto específico con su contenido.
     * Devuelve el array Graph completo (`contentBytes` viene en base64).
     */
    public function descargarAdjunto(PolizaAdminEmailAccount $acc, string $messageId, string $attachmentId): array
    {
        $acc = $this->ensureValidToken($acc);
        $url = rtrim($this->config()['graph_base'], '/') . "/me/messages/{$messageId}/attachments/{$attachmentId}";
        $resp = Http::withToken($acc->access_token)->get($url);
        if (!$resp->successful()) {
            throw new RuntimeException("Graph getAttachment falló: {$resp->status()} {$resp->body()}");
        }
        return (array) $resp->json();
    }

    /**
     * GET /me — devuelve datos básicos del usuario logueado en Microsoft.
     */
    public function fetchMe(string $accessToken): array
    {
        $url = rtrim($this->config()['graph_base'], '/') . '/me';
        $resp = Http::withToken($accessToken)->get($url);
        if (!$resp->successful()) {
            throw new RuntimeException("Graph /me falló: {$resp->status()} {$resp->body()}");
        }
        return (array) $resp->json();
    }

    /**
     * Bloque D.3 — busca mensajes recibidos en el inbox del admin desde una
     * fecha dada. Filtra por `receivedDateTime > $since`. Devuelve el shape
     * de Graph (sender, subject, bodyPreview, internetMessageId, etc.) — el
     * caller decide cómo matchearlos contra solicitudes.
     *
     * Solo lee Inbox (no carpetas custom). Un volumen típico de admin con
     * pocas solicitudes activas devuelve <100 mensajes — `top=200` alcanza.
     */
    public function listInboxMessagesSince(PolizaAdminEmailAccount $acc, Carbon $since, int $top = 200): array
    {
        $acc = $this->ensureValidToken($acc);
        $isoSince = $since->copy()->utc()->format('Y-m-d\TH:i:s\Z');

        $url = rtrim($this->config()['graph_base'], '/') . '/me/mailFolders/Inbox/messages';
        $resp = Http::withToken($acc->access_token)->get($url, [
            // Filtrar por fecha de recepción para no traer todo el inbox.
            '$filter' => "receivedDateTime gt {$isoSince}",
            '$select' => 'id,internetMessageId,internetMessageHeaders,subject,bodyPreview,from,receivedDateTime,isRead,conversationId',
            '$orderby' => 'receivedDateTime desc',
            '$top'    => $top,
        ]);

        if (!$resp->successful()) {
            throw new RuntimeException("Graph listInbox falló: {$resp->status()} {$resp->body()}");
        }

        $body = $resp->json();
        return $body['value'] ?? [];
    }

    /** Devuelve la cuenta vinculada al user, o null. */
    public function findByUser(User $user): ?PolizaAdminEmailAccount
    {
        return PolizaAdminEmailAccount::query()
            ->where('user_id', $user->id)
            ->where('provider', 'microsoft')
            ->first();
    }

    private function mapRecipients(array $emails): array
    {
        return array_values(array_filter(array_map(
            fn ($e) => $e ? ['emailAddress' => ['address' => $e]] : null,
            $emails
        )));
    }

    private function config(): array
    {
        $cfg = config('services.microsoft');
        if (empty($cfg['client_id']) || empty($cfg['client_secret']) || empty($cfg['tenant_id']) || empty($cfg['redirect_uri'])) {
            throw new RuntimeException('OAuth Microsoft no está configurado (faltan MS_CLIENT_ID / MS_CLIENT_SECRET / MS_TENANT_ID / MS_REDIRECT_URI).');
        }
        return $cfg;
    }
}

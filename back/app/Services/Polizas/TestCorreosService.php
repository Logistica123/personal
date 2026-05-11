<?php

namespace App\Services\Polizas;

use App\Models\PolizaAdminEmailAccount;
use App\Models\PolizaSolicitudEmail;
use App\Models\PolizaTestCorreo;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * ADDENDUM 14 Parte A — diagnóstico E2E del flujo OAuth de correos.
 *
 * 3 tests independientes:
 *   - envioBasico:   manda un email simple a `destinatario` y mide latencia
 *   - loopCompleto:  manda email al propio admin y hace polling de SentItems
 *                    hasta detectarlo (máx 60s) → valida sendMail + Mail.Read
 *   - conAdjunto:    manda email con PDF mínimo adjunto a la propia cuenta
 *
 * Cada ejecución persiste en `polizas_tests_correos` para auditoría.
 */
class TestCorreosService
{
    private const POLLING_MAX_SEGUNDOS = 60;
    private const POLLING_INTERVAL = 5;

    public function __construct(private readonly OAuthMicrosoftService $oauth)
    {
    }

    /**
     * Test 1 — envío básico: manda un email a `destinatario` y mide latencia.
     */
    public function envioBasico(User $admin, string $destinatario): PolizaTestCorreo
    {
        $log = PolizaTestCorreo::create([
            'user_id'      => $admin->id,
            'tipo_test'    => 'envio_basico',
            'fecha_inicio' => now(),
            'estado'       => 'en_progreso',
            'metadata'     => ['destinatario' => $destinatario],
        ]);

        try {
            $cuenta = $this->cuentaActivaDelAdmin($admin);
            $testId = Str::uuid()->toString();
            $start = microtime(true);

            $rendered = [
                'asunto'           => '[TEST DistriApp] Verificación OAuth — ' . now()->format('d/m/Y H:i:s'),
                'body'             => "Email de prueba enviado desde el módulo Pólizas de DistriApp.\n\n"
                    . "Si recibís este email, la integración OAuth está funcionando correctamente.\n\n"
                    . "ID del test: {$testId}",
                'destinatarios_to' => [$destinatario],
                'destinatarios_cc' => [],
                'destinatarios_bcc' => [],
            ];

            $messageId = '<test-' . $testId . '@distriapp>';
            $this->oauth->sendEmail($cuenta, $rendered, $messageId);

            $tiempoMs = (int) round((microtime(true) - $start) * 1000);

            $log->update([
                'fecha_fin' => now(),
                'estado'    => 'ok',
                'metadata'  => array_merge($log->metadata ?? [], [
                    'test_id'        => $testId,
                    'message_id'     => $messageId,
                    'tiempo_envio_ms'=> $tiempoMs,
                ]),
            ]);
        } catch (\Throwable $e) {
            $log->update([
                'fecha_fin'     => now(),
                'estado'        => 'error',
                'paso_fallo'    => 'envio',
                'detalle_error' => mb_substr($e->getMessage(), 0, 1000),
            ]);
            Log::warning("TestCorreos.envioBasico falló: {$e->getMessage()}");
        }

        return $log->fresh();
    }

    /**
     * Test 2 — loop completo: el admin se manda email a sí mismo y se valida
     * que aparece en SentItems vía polling (máx 60s con interval 5s).
     */
    public function loopCompleto(User $admin): PolizaTestCorreo
    {
        $log = PolizaTestCorreo::create([
            'user_id'      => $admin->id,
            'tipo_test'    => 'loop_completo',
            'fecha_inicio' => now(),
            'estado'       => 'en_progreso',
        ]);

        try {
            $cuenta = $this->cuentaActivaDelAdmin($admin);
            $testId = Str::uuid()->toString();
            $destinatario = $cuenta->ms_account_email;

            // Paso 1 — envío.
            $rendered = [
                'asunto'           => "[TEST LOOP DistriApp] {$testId}",
                'body'             => "Test de loop completo — ID {$testId}\n\nNo respondas a este email.",
                'destinatarios_to' => [$destinatario],
                'destinatarios_cc' => [],
                'destinatarios_bcc' => [],
            ];
            $messageId = '<test-loop-' . $testId . '@distriapp>';
            $this->oauth->sendEmail($cuenta, $rendered, $messageId);

            // Paso 2 — polling para que aparezca el conversationId en SentItems.
            $conversationId = null;
            $tiempoTotal = 0;
            $startPolling = microtime(true);
            for ($intento = 0; $intento < (self::POLLING_MAX_SEGUNDOS / self::POLLING_INTERVAL); $intento++) {
                sleep(self::POLLING_INTERVAL);
                $tiempoTotal = (int) round(microtime(true) - $startPolling);
                $conversationId = $this->oauth->buscarConversationIdPorMessageId($cuenta, $messageId, 1);
                if ($conversationId) break;
            }

            if (!$conversationId) {
                throw new RuntimeException("Email enviado OK pero no apareció en SentItems en {$tiempoTotal}s. "
                    . "Verificá los permisos Mail.Read y Mail.Send en Azure.");
            }

            $log->update([
                'fecha_fin' => now(),
                'estado'    => 'ok',
                'metadata'  => [
                    'test_id'                 => $testId,
                    'message_id'              => $messageId,
                    'conversation_id'         => $conversationId,
                    'tiempo_envio_segundos'   => $tiempoTotal,
                ],
            ]);
        } catch (\Throwable $e) {
            $paso = str_contains($e->getMessage(), 'no apareció') ? 'recepcion' : 'envio';
            $log->update([
                'fecha_fin'     => now(),
                'estado'        => 'error',
                'paso_fallo'    => $paso,
                'detalle_error' => mb_substr($e->getMessage(), 0, 1000),
            ]);
            Log::warning("TestCorreos.loopCompleto falló: {$e->getMessage()}");
        }

        return $log->fresh();
    }

    /**
     * Test 3 — con adjunto: manda email con PDF mínimo de muestra (~500 bytes)
     * a la propia cuenta del admin para validar que la API acepta attachments.
     */
    public function conAdjunto(User $admin): PolizaTestCorreo
    {
        $log = PolizaTestCorreo::create([
            'user_id'      => $admin->id,
            'tipo_test'    => 'con_adjunto',
            'fecha_inicio' => now(),
            'estado'       => 'en_progreso',
        ]);

        try {
            $cuenta = $this->cuentaActivaDelAdmin($admin);
            $testId = Str::uuid()->toString();
            $pdfBytes = $this->pdfMinimoDeMuestra();

            // Para adjuntos hay que usar el endpoint Graph directo — el helper
            // sendEmail() no soporta `attachments` por defecto.
            $this->sendEmailConAdjunto($cuenta, [
                'destinatario' => $cuenta->ms_account_email,
                'asunto'       => "[TEST ADJUNTO DistriApp] {$testId}",
                'body'         => "Test con adjunto PDF — ID {$testId}",
                'message_id'   => '<test-adjunto-' . $testId . '@distriapp>',
                'adjunto_nombre' => "test-{$testId}.pdf",
                'adjunto_contenido_base64' => base64_encode($pdfBytes),
                'adjunto_mime' => 'application/pdf',
            ]);

            $log->update([
                'fecha_fin' => now(),
                'estado'    => 'ok',
                'metadata'  => [
                    'test_id'        => $testId,
                    'adjunto_bytes'  => strlen($pdfBytes),
                ],
            ]);
        } catch (\Throwable $e) {
            $log->update([
                'fecha_fin'     => now(),
                'estado'        => 'error',
                'paso_fallo'    => 'envio_adjunto',
                'detalle_error' => mb_substr($e->getMessage(), 0, 1000),
            ]);
            Log::warning("TestCorreos.conAdjunto falló: {$e->getMessage()}");
        }

        return $log->fresh();
    }

    public function ultimosDelAdmin(User $admin, int $limit = 10): array
    {
        return PolizaTestCorreo::query()
            ->where('user_id', $admin->id)
            ->orderByDesc('fecha_inicio')
            ->limit($limit)
            ->get()
            ->map(fn ($t) => [
                'id'            => $t->id,
                'tipo_test'     => $t->tipo_test,
                'fecha_inicio'  => $t->fecha_inicio?->toIso8601String(),
                'fecha_fin'     => $t->fecha_fin?->toIso8601String(),
                'duracion_ms'   => $t->fecha_fin && $t->fecha_inicio
                    ? (int) round($t->fecha_inicio->diffInMilliseconds($t->fecha_fin))
                    : null,
                'estado'        => $t->estado,
                'paso_fallo'    => $t->paso_fallo,
                'detalle_error' => $t->detalle_error,
                'metadata'      => $t->metadata,
            ])->all();
    }

    private function cuentaActivaDelAdmin(User $admin): PolizaAdminEmailAccount
    {
        $cuenta = PolizaAdminEmailAccount::query()
            ->where('user_id', $admin->id)
            ->where('activo', true)
            ->first();
        if (!$cuenta) {
            throw new RuntimeException("No tenés cuenta OAuth activa. Vinculá tu Outlook en /polizas/configuracion/mi-outlook.");
        }
        return $cuenta;
    }

    /**
     * Manda email con un adjunto inline (contentBytes base64) — sin pasar por el
     * helper estándar sendEmail() porque éste no acepta attachments.
     */
    private function sendEmailConAdjunto(PolizaAdminEmailAccount $cuenta, array $datos): void
    {
        $cuenta = $this->oauth->ensureValidToken($cuenta);
        $url = 'https://graph.microsoft.com/v1.0/me/sendMail';

        $payload = [
            'message' => [
                'subject'      => $datos['asunto'],
                'body'         => ['contentType' => 'Text', 'content' => $datos['body']],
                'toRecipients' => [[
                    'emailAddress' => ['address' => $datos['destinatario']],
                ]],
                'attachments'  => [[
                    '@odata.type'  => '#microsoft.graph.fileAttachment',
                    'name'         => $datos['adjunto_nombre'],
                    'contentType'  => $datos['adjunto_mime'],
                    'contentBytes' => $datos['adjunto_contenido_base64'],
                ]],
                'internetMessageHeaders' => [[
                    'name'  => 'x-polizas-message-id',
                    'value' => trim($datos['message_id'], '<>'),
                ]],
            ],
            'saveToSentItems' => true,
        ];

        $resp = Http::withToken($cuenta->access_token)
            ->timeout(60)
            ->post($url, $payload);

        if (!$resp->successful()) {
            throw new RuntimeException("Graph sendMail con adjunto falló: {$resp->status()} {$resp->body()}");
        }
    }

    /**
     * Devuelve los bytes de un PDF de 1 página con texto "TEST ATTACHMENT".
     * Es un PDF mínimo válido construido a mano, ~500 bytes, no requiere dompdf
     * ni otras dependencias.
     */
    private function pdfMinimoDeMuestra(): string
    {
        $contenido = "BT /F1 24 Tf 72 720 Td (TEST ATTACHMENT - DistriApp) Tj ET";
        $stream = "<< /Length " . strlen($contenido) . " >>\nstream\n{$contenido}\nendstream";

        $objetos = [
            "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
            "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
            "3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> "
                . "/MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj",
            "4 0 obj\n{$stream}\nendobj",
            "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
        ];

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objetos as $obj) {
            $offsets[] = strlen($pdf);
            $pdf .= $obj . "\n";
        }
        $xrefOffset = strlen($pdf);
        $pdf .= "xref\n0 " . (count($objetos) + 1) . "\n";
        $pdf .= "0000000000 65535 f \n";
        foreach ($offsets as $off) {
            $pdf .= sprintf("%010d 00000 n \n", $off);
        }
        $pdf .= "trailer\n<< /Size " . (count($objetos) + 1) . " /Root 1 0 R >>\n";
        $pdf .= "startxref\n{$xrefOffset}\n%%EOF";

        return $pdf;
    }
}

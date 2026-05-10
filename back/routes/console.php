<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Models\User;

// ─── Cierre Diario: sync desde Kommo API todos los días a las 16:40 ─────────
Schedule::command('cierre:sync-kommo')
    ->dailyAt('16:40')
    ->timezone('America/Argentina/Buenos_Aires')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/cierre-sync.log'));

// ─── Pólizas: recálculo de estados (sin emails automáticos — ADDENDUM 11) ────
// Las alertas de vencimiento y recordatorios de solicitudes se eliminaron a
// favor de indicadores in-app (badges en /polizas y "días sin respuesta" en
// la bandeja /polizas/solicitudes). El módulo solo envía emails cuando un
// admin dispara la acción explícitamente vía OAuth.
Schedule::command('polizas:recalcular-estados-asegurados')
    ->dailyAt('08:10')
    ->timezone('America/Argentina/Buenos_Aires')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/polizas-alertas.log'));

// ADDENDUM 9 Parte A — refresh silencioso de access_tokens de Outlook (cada hora).
// Microsoft emite tokens de ~60 min; este job renueva los que vencen en <30 min.
Schedule::command('polizas:refresh-tokens-outlook')
    ->hourly()
    ->timezone('America/Argentina/Buenos_Aires')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/polizas-oauth.log'));

// Bloque D.3 — auto-detección de respuestas de aseguradoras en Outlook
// (cada 30 min). Solo registra candidatos en `respuesta_resumen`; el admin
// confirma manualmente desde la bandeja para evitar falsos positivos.
Schedule::command('polizas:procesar-respuestas-aseguradora --ventana=2')
    ->everyThirtyMinutes()
    ->timezone('America/Argentina/Buenos_Aires')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/polizas-oauth.log'));

// ADDENDUM 13 Parte D — sincronización del Inbox con cache local
// (cada 15 min). Cachea los emails de cada thread (`microsoft_conversation_id`)
// en `polizas_solicitud_emails` + adjuntos. Auto-vincula como endoso los PDFs
// detectados si la póliza tiene `auto_guardar_endosos_recibidos=true`.
Schedule::command('polizas:sincronizar-inbox')
    ->everyFifteenMinutes()
    ->timezone('America/Argentina/Buenos_Aires')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/polizas-inbox.log'));

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('auth:clear-totp {email : Email del usuario}', function () {
    $email = strtolower(trim((string) $this->argument('email')));
    if ($email === '') {
        $this->error('Email inválido.');
        return 1;
    }

    /** @var User|null $user */
    $user = User::query()->where('email', $email)->first();
    if (! $user) {
        $this->error('Usuario no encontrado: ' . $email);
        return 1;
    }

    $user->forceFill([
        'totp_secret' => null,
        'totp_enabled_at' => null,
        'remember_token' => null,
    ])->save();

    $this->info('OK: 2FA (TOTP) limpiado para ' . $email);
    return 0;
})->purpose('Desactiva 2FA (TOTP) para un usuario (uso soporte/dev).');

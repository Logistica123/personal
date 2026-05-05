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

// ─── Pólizas: alertas de vencimiento + recordatorios diarios a las 08:00 ────
Schedule::command('polizas:alertas-vencimiento')
    ->dailyAt('08:00')
    ->timezone('America/Argentina/Buenos_Aires')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/polizas-alertas.log'));

Schedule::command('polizas:recordar-solicitudes-pendientes')
    ->dailyAt('08:05')
    ->timezone('America/Argentina/Buenos_Aires')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/polizas-alertas.log'));

Schedule::command('polizas:recalcular-estados-asegurados')
    ->dailyAt('08:10')
    ->timezone('America/Argentina/Buenos_Aires')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/polizas-alertas.log'));

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

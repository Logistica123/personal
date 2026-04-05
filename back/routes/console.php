<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Models\User;

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

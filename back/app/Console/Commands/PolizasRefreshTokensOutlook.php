<?php

namespace App\Console\Commands;

use App\Models\PolizaAdminEmailAccount;
use App\Services\Polizas\OAuthMicrosoftService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * ADDENDUM 9 Parte A — refresh silencioso de access_tokens de Outlook.
 *
 * Microsoft Graph emite access_tokens de ~1 hora. Este cron corre cada hora y
 * refresca los que vencen en <30 min para que el envío de emails nunca se
 * frene esperando el round-trip al token endpoint. Si el refresh_token también
 * caducó (>90 días sin uso o consentimiento revocado), el `OAuthMicrosoftService`
 * marca la cuenta como `activo=false` con el error en `last_error`.
 *
 * Uso: php artisan polizas:refresh-tokens-outlook
 *
 * Schedule sugerido (`routes/console.php` o `app/Console/Kernel.php`):
 *   $schedule->command('polizas:refresh-tokens-outlook')->hourly();
 */
class PolizasRefreshTokensOutlook extends Command
{
    protected $signature = 'polizas:refresh-tokens-outlook {--force : Refrescar todos los activos sin importar la fecha de vencimiento}';
    protected $description = 'Renueva access_tokens de Outlook que vencen pronto';

    public function handle(OAuthMicrosoftService $oauth): int
    {
        $umbral = Carbon::now()->addSeconds(OAuthMicrosoftService::REFRESH_BEFORE_EXPIRY_SECONDS);

        $query = PolizaAdminEmailAccount::query()
            ->where('activo', true)
            ->whereNotNull('refresh_token');

        if (!$this->option('force')) {
            $query->where(function ($q) use ($umbral) {
                $q->whereNull('token_expires_at')
                  ->orWhere('token_expires_at', '<=', $umbral);
            });
        }

        $cuentas = $query->get();

        if ($cuentas->isEmpty()) {
            $this->info('Sin cuentas para refrescar.');
            return self::SUCCESS;
        }

        $ok = 0;
        $errores = 0;

        foreach ($cuentas as $cuenta) {
            try {
                $oauth->refreshAccessToken($cuenta);
                $ok++;
                $this->line("✓ {$cuenta->ms_account_email} (cuenta #{$cuenta->id})");
            } catch (\Throwable $e) {
                $errores++;
                $this->warn("✗ {$cuenta->ms_account_email} (cuenta #{$cuenta->id}): " . $e->getMessage());
            }
        }

        $this->info("Refresh terminado: {$ok} OK, {$errores} fallidos.");
        return $errores > 0 ? self::FAILURE : self::SUCCESS;
    }
}

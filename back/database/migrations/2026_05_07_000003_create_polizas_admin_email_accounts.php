<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM 9 Parte A — vinculación OAuth de Outlook por administrativo.
 *
 * Cada admin que vincula su Outlook tiene 1 fila acá con su access_token y
 * refresh_token. Cuando se manda una solicitud de alta/baja, `SolicitudService`
 * mira si el usuario tiene cuenta vinculada y activa: si sí, manda con
 * Microsoft Graph (remitente = el admin); si no, fallback a SMTP institucional.
 *
 * - `provider`: por ahora solo `microsoft`. Dejado como string para extender a
 *   Google u otros si hace falta.
 * - `access_token` / `refresh_token`: tokens del flow Authorization Code de
 *   Azure AD. Se guardan en plano (la base ya está protegida; tokens son
 *   rotables y caducables). Si el día de mañana se quiere encriptar at-rest,
 *   alcanza con sumar un cast `encrypted` al modelo.
 * - `token_expires_at`: typical 1h después de cada refresh. El cron
 *   `polizas:refresh-tokens-outlook` renueva los que vencen en <30 min.
 * - `activo`: false cuando el admin desvincula manualmente o cuando un refresh
 *   falla persistentemente (ej. revocación de consentimiento desde Microsoft).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('polizas_admin_email_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('provider', 20)->default('microsoft');
            $table->string('ms_account_email', 150)->nullable();
            $table->string('ms_account_id', 100)->nullable();
            $table->text('access_token')->nullable();
            $table->text('refresh_token')->nullable();
            $table->timestamp('token_expires_at')->nullable();
            $table->text('scope')->nullable();
            $table->timestamp('last_refresh_at')->nullable();
            $table->text('last_error')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->unique(['user_id', 'provider'], 'uniq_user_provider');
            $table->index(['activo', 'token_expires_at'], 'idx_acc_refresh');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('polizas_admin_email_accounts');
    }
};

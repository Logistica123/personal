<?php

namespace App\Console\Commands;

use App\Models\PolizaAdminEmailAccount;
use App\Services\Polizas\InboxService;
use Illuminate\Console\Command;

/**
 * ADDENDUM 13 Parte D — sincroniza el Inbox de Outlook de cada admin con
 * pólizas activas. Itera todas las cuentas OAuth y por cada una busca los
 * threads (`microsoft_conversation_id`) de sus solicitudes enviadas, cachea
 * los mensajes nuevos y auto-vincula endosos detectados (PDFs cuyos nombres
 * matchean los patrones `endoso/anexo/certificado/...`) si la póliza tiene
 * `auto_guardar_endosos_recibidos=true`.
 *
 * Uso: php artisan polizas:sincronizar-inbox
 *
 * Schedule sugerido (`routes/console.php`):
 *   Schedule::command('polizas:sincronizar-inbox')->everyFifteenMinutes();
 */
class PolizasSincronizarInbox extends Command
{
    protected $signature = 'polizas:sincronizar-inbox
        {--cuenta= : Sincroniza solo la cuenta indicada (id de polizas_admin_email_accounts)}';

    protected $description = 'Sincroniza el Inbox de Outlook de los admins de Pólizas (cachea respuestas + auto-vincula endosos)';

    public function handle(InboxService $inbox): int
    {
        $query = PolizaAdminEmailAccount::query()->where('activo', true);
        if ($id = $this->option('cuenta')) {
            $query->where('id', (int) $id);
        }
        $cuentas = $query->get();

        if ($cuentas->isEmpty()) {
            $this->info('Sin cuentas activas para sincronizar.');
            return self::SUCCESS;
        }

        $totales = ['procesadas' => 0, 'mensajes_nuevos' => 0, 'adjuntos_nuevos' => 0, 'errores' => 0];

        foreach ($cuentas as $cuenta) {
            $this->line("→ {$cuenta->ms_account_email} (cuenta #{$cuenta->id})");
            try {
                $r = $inbox->sincronizarCuenta($cuenta);
                $totales['procesadas']      += $r['procesadas'];
                $totales['mensajes_nuevos'] += $r['mensajes_nuevos'];
                $totales['adjuntos_nuevos'] += $r['adjuntos_nuevos'];
                $totales['errores']         += count($r['errores']);
                $this->line("  procesadas={$r['procesadas']} msg_nuevos={$r['mensajes_nuevos']} adj_nuevos={$r['adjuntos_nuevos']}");
                foreach ($r['errores'] as $err) {
                    $this->warn("  ⚠ {$err}");
                }
            } catch (\Throwable $e) {
                $totales['errores']++;
                $this->warn("  ✗ falló: {$e->getMessage()}");
            }
        }

        $this->info(sprintf(
            'Sync Inbox terminado — solicitudes=%d msg_nuevos=%d adj_nuevos=%d errores=%d',
            $totales['procesadas'],
            $totales['mensajes_nuevos'],
            $totales['adjuntos_nuevos'],
            $totales['errores'],
        ));

        return $totales['errores'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}

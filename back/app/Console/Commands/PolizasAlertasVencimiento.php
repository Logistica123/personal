<?php

namespace App\Console\Commands;

use App\Models\Poliza;
use App\Models\PolizaAdminPermiso;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;

/**
 * Cron diario: alerta a los administrativos de pólizas próximas a vencer.
 *
 * Una póliza dispara alerta cuando faltan <= `alerta_dias_antes_vencimiento`
 * días para su `vigencia_hasta` (y aún no venció). Manda email a los users
 * con `polizas_admin_permisos.recibe_alertas_vencimiento = true`.
 */
class PolizasAlertasVencimiento extends Command
{
    protected $signature = 'polizas:alertas-vencimiento {--dry-run : Lista las pólizas sin mandar mail}';
    protected $description = 'Alerta a administrativos de pólizas próximas a vencer';

    public function handle(): int
    {
        $hoy = Carbon::now()->startOfDay();

        $polizas = Poliza::query()
            ->where('activa', true)
            ->whereNotNull('vigencia_hasta')
            ->whereDate('vigencia_hasta', '>=', $hoy)
            ->whereRaw('DATEDIFF(vigencia_hasta, ?) <= alerta_dias_antes_vencimiento', [$hoy])
            ->with('aseguradora:id,nombre')
            ->get();

        if ($polizas->isEmpty()) {
            $this->info('No hay pólizas próximas a vencer.');
            return self::SUCCESS;
        }

        $destinatarios = $this->resolverDestinatarios();
        $this->info(sprintf('%d póliza(s) próxima(s) a vencer · %d destinatario(s)',
            $polizas->count(), $destinatarios->count()));

        if ($this->option('dry-run')) {
            foreach ($polizas as $p) {
                $dias = $hoy->diffInDays(Carbon::parse($p->vigencia_hasta));
                $this->line(sprintf('  · %s (%s) vence en %d día(s)',
                    $p->nombre_descriptivo, $p->numero_poliza, $dias));
            }
            $this->warn('--dry-run: no se envió email.');
            return self::SUCCESS;
        }

        if ($destinatarios->isEmpty()) {
            $this->warn('No hay administrativos con `recibe_alertas_vencimiento=true` — alerta no enviada.');
            return self::SUCCESS;
        }

        $body = $this->armarBody($polizas, $hoy);
        Mail::raw($body, function ($mail) use ($destinatarios) {
            $mail->subject('[Pólizas] Vencimientos próximos')
                 ->to($destinatarios->pluck('email')->filter()->all());
        });

        $this->info('Alerta enviada.');
        return self::SUCCESS;
    }

    private function resolverDestinatarios()
    {
        $userIds = PolizaAdminPermiso::query()
            ->where('recibe_alertas_vencimiento', true)
            ->pluck('user_id');

        return User::query()->whereIn('id', $userIds)->get(['id', 'name', 'email']);
    }

    private function armarBody($polizas, Carbon $hoy): string
    {
        $lineas = ['Pólizas próximas a vencer:', ''];
        foreach ($polizas as $p) {
            $dias = (int) $hoy->diffInDays(Carbon::parse($p->vigencia_hasta));
            $lineas[] = sprintf('  · %s (%s · N° %s) — vence el %s (en %d día%s)',
                $p->aseguradora?->nombre ?? '?',
                $p->nombre_descriptivo,
                $p->numero_poliza,
                Carbon::parse($p->vigencia_hasta)->format('d/m/Y'),
                $dias,
                $dias === 1 ? '' : 's',
            );
        }
        $lineas[] = '';
        $lineas[] = 'Recordá iniciar la renovación con la aseguradora correspondiente.';
        return implode("\n", $lineas);
    }
}

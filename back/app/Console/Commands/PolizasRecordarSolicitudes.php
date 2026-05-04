<?php

namespace App\Console\Commands;

use App\Models\PolizaSolicitud;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;

/**
 * Cron diario: recordatorio al administrativo creador de solicitudes enviadas
 * hace > 7 días que aún no fueron confirmadas/rechazadas.
 */
class PolizasRecordarSolicitudes extends Command
{
    protected $signature = 'polizas:recordar-solicitudes-pendientes {--dias=7} {--dry-run}';
    protected $description = 'Recuerda al admin las solicitudes enviadas hace N días sin confirmar';

    public function handle(): int
    {
        $dias = (int) $this->option('dias');
        $umbral = Carbon::now()->subDays($dias);

        $solicitudes = PolizaSolicitud::query()
            ->where('estado', 'enviado')
            ->where('enviado_en', '<', $umbral)
            ->with([
                'administrativo:id,name,email',
                'poliza:id,nombre_descriptivo,numero_poliza,aseguradora_id',
                'poliza.aseguradora:id,nombre',
            ])
            ->get();

        if ($solicitudes->isEmpty()) {
            $this->info('Sin solicitudes pendientes de respuesta hace > ' . $dias . ' días.');
            return self::SUCCESS;
        }

        // Agrupar por administrativo creador.
        $porAdmin = $solicitudes->groupBy('administrativo_user_id');
        $this->info(sprintf('%d solicitud(es) pendientes · %d admin(s) a notificar',
            $solicitudes->count(), $porAdmin->count()));

        if ($this->option('dry-run')) {
            foreach ($porAdmin as $adminId => $sols) {
                $admin = $sols->first()->administrativo;
                $this->line("  Admin {$admin?->name} ({$admin?->email}):");
                foreach ($sols as $s) {
                    $this->line(sprintf('    · #%d %s — enviada %s',
                        $s->id, $s->asunto, $s->enviado_en?->diffForHumans()));
                }
            }
            $this->warn('--dry-run: no se envió email.');
            return self::SUCCESS;
        }

        foreach ($porAdmin as $adminId => $sols) {
            $admin = $sols->first()->administrativo;
            if (!$admin?->email) continue;

            $body = $this->armarBody($sols);
            Mail::raw($body, function ($mail) use ($admin) {
                $mail->subject('[Pólizas] Solicitudes pendientes de respuesta')
                     ->to($admin->email);
            });
        }

        $this->info('Recordatorios enviados.');
        return self::SUCCESS;
    }

    private function armarBody($solicitudes): string
    {
        $lineas = ['Tenés solicitudes enviadas sin respuesta de la aseguradora:', ''];
        foreach ($solicitudes as $s) {
            $lineas[] = sprintf('  · #%d %s/%s · %s — enviada %s',
                $s->id,
                $s->poliza?->aseguradora?->nombre ?? '?',
                $s->tipo,
                $s->asunto,
                $s->enviado_en?->format('d/m/Y'),
            );
        }
        $lineas[] = '';
        $lineas[] = 'Hacé seguimiento por mail o marcá la solicitud como "respondida_*" desde la plataforma.';
        return implode("\n", $lineas);
    }
}

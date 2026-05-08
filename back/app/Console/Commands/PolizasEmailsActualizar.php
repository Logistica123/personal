<?php

namespace App\Console\Commands;

use App\Models\PolizaEmailConfig;
use Illuminate\Console\Command;

/**
 * Operativo — comando interactivo para reemplazar los emails `TODO_*` que
 * quedaron en los seeders por las direcciones reales de cada contacto.
 *
 * Uso (interactivo):
 *   php artisan polizas:emails-actualizar
 *
 * Uso (no interactivo, por config_id):
 *   php artisan polizas:emails-actualizar --config=5 --to=carlos@mapfre.com.ar --cc=admin1@logarg...
 *
 * Listar configs sin tocar nada:
 *   php artisan polizas:emails-actualizar --listar
 */
class PolizasEmailsActualizar extends Command
{
    protected $signature = 'polizas:emails-actualizar
        {--listar : Solo lista las configs y sus destinatarios actuales}
        {--config= : ID de polizas_email_config a actualizar (modo no-interactivo)}
        {--to=* : Email(s) para destinatarios_to (reemplaza todo el array)}
        {--cc=* : Email(s) para destinatarios_cc (reemplaza todo el array)}
        {--contacto= : Nombre del contacto en la aseguradora (ej. Carlos / Ramón)}';

    protected $description = 'Reemplaza emails placeholder TODO_* en polizas_email_config por las direcciones reales';

    public function handle(): int
    {
        if ($this->option('listar')) {
            $this->listar();
            return self::SUCCESS;
        }

        if ($configId = $this->option('config')) {
            return $this->actualizarUna((int) $configId);
        }

        return $this->modoInteractivo();
    }

    private function listar(): int
    {
        $rows = PolizaEmailConfig::query()
            ->with('poliza:id,nombre_descriptivo,numero_poliza')
            ->orderBy('poliza_id')
            ->orderBy('tipo')
            ->get();

        if ($rows->isEmpty()) {
            $this->warn('No hay email_configs.');
            return self::SUCCESS;
        }

        foreach ($rows as $r) {
            $tienePlaceholder = $this->tieneTodo($r);
            $marker = $tienePlaceholder ? '⚠' : '✓';
            $this->line("{$marker} #{$r->id} — {$r->poliza?->nombre_descriptivo} [{$r->tipo}]");
            $this->line("   To:  " . implode(', ', $r->destinatarios_to ?? []));
            if (!empty($r->destinatarios_cc)) {
                $this->line("   CC:  " . implode(', ', $r->destinatarios_cc));
            }
            if ($r->contacto_nombre) {
                $this->line("   Contacto: {$r->contacto_nombre}");
            }
            $this->line('');
        }
        $this->info('Configs marcadas con ⚠ tienen emails placeholder TODO_*. Ejecutá `php artisan polizas:emails-actualizar` para corregirlas.');
        return self::SUCCESS;
    }

    private function actualizarUna(int $id): int
    {
        $config = PolizaEmailConfig::with('poliza')->find($id);
        if (!$config) {
            $this->error("No existe email_config #{$id}");
            return self::FAILURE;
        }

        $updates = [];
        if ($to = $this->option('to')) {
            $updates['destinatarios_to'] = is_array($to) ? $to : [$to];
        }
        if ($cc = $this->option('cc')) {
            $updates['destinatarios_cc'] = is_array($cc) ? $cc : [$cc];
        }
        if ($contacto = $this->option('contacto')) {
            $updates['contacto_nombre'] = $contacto;
        }
        if (empty($updates)) {
            $this->warn('Nada para actualizar (pasá al menos --to= --cc= o --contacto=).');
            return self::SUCCESS;
        }

        $config->fill($updates)->save();
        $this->info("Actualizado #{$id} — {$config->poliza?->nombre_descriptivo} [{$config->tipo}]");
        return self::SUCCESS;
    }

    private function modoInteractivo(): int
    {
        $rows = PolizaEmailConfig::query()
            ->with('poliza:id,nombre_descriptivo,numero_poliza')
            ->orderBy('poliza_id')
            ->orderBy('tipo')
            ->get()
            ->filter(fn ($r) => $this->tieneTodo($r))
            ->values();

        if ($rows->isEmpty()) {
            $this->info('Ninguna config tiene emails placeholder TODO_*. Todo OK.');
            return self::SUCCESS;
        }

        $this->info("Hay {$rows->count()} config(s) con emails placeholder. Te las paso una por una:\n");

        foreach ($rows as $r) {
            $this->line("─── #{$r->id} {$r->poliza?->nombre_descriptivo} [{$r->tipo}] ───");
            $this->line("   To actuales:  " . implode(', ', $r->destinatarios_to ?? []));
            $this->line("   CC actuales:  " . implode(', ', $r->destinatarios_cc ?? []));
            if ($r->contacto_nombre) {
                $this->line("   Contacto actual: {$r->contacto_nombre}");
            }

            if (!$this->confirm('¿Actualizar esta config?', true)) {
                continue;
            }

            $toRaw = $this->ask('Emails de TO (separados por coma)', implode(',', $r->destinatarios_to ?? []));
            $ccRaw = $this->ask('Emails de CC (separados por coma, vacío = sin CC)', implode(',', $r->destinatarios_cc ?? []));
            $contacto = $this->ask('Nombre del contacto', $r->contacto_nombre ?? '');

            $r->fill([
                'destinatarios_to' => array_values(array_filter(array_map('trim', explode(',', $toRaw)))),
                'destinatarios_cc' => array_values(array_filter(array_map('trim', explode(',', $ccRaw)))),
                'contacto_nombre'  => $contacto ?: null,
            ])->save();
            $this->info("✓ Actualizado.\n");
        }

        $this->info('Listo. Volvé a correr con --listar para confirmar que no quedaron TODO_*.');
        return self::SUCCESS;
    }

    private function tieneTodo(PolizaEmailConfig $r): bool
    {
        $emails = array_merge($r->destinatarios_to ?? [], $r->destinatarios_cc ?? []);
        foreach ($emails as $e) {
            if (str_contains((string) $e, 'TODO_')) return true;
        }
        return false;
    }
}

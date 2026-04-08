<?php

namespace App\Console\Commands;

use App\Services\Kommo\KommoClient;
use Illuminate\Console\Command;

class KommoListFieldsCommand extends Command
{
    protected $signature = 'kommo:list-fields
                            {--entity=leads : Entidad (leads, contacts, companies)}';

    protected $description = 'Lista los custom fields de Kommo para descubrir los IDs necesarios';

    public function handle(): int
    {
        $entity = $this->option('entity');

        $client = new KommoClient();

        $this->info("Obteniendo custom fields de '{$entity}'...");

        $fields = $client->fetchCustomFields($entity);

        if (empty($fields)) {
            $this->warn('No se encontraron custom fields.');
            return self::SUCCESS;
        }

        $this->table(
            ['ID', 'Nombre', 'Tipo', 'Código'],
            array_map(fn ($f) => [
                $f['id'] ?? '-',
                $f['name'] ?? '-',
                $f['type'] ?? '-',
                $f['code'] ?? '-',
            ], $fields)
        );

        $this->newLine();
        $this->info('Usá estos IDs en el .env:');
        $this->line('  KOMMO_FIELD_SUCURSAL=<id>');
        $this->line('  KOMMO_FIELD_VEHICULO=<id>');
        $this->line('  KOMMO_FIELD_NOMBRE_DISTRIBUIDOR=<id>');

        return self::SUCCESS;
    }
}

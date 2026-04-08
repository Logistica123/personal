<?php

namespace App\Console\Commands;

use App\Models\CierreDiario;
use App\Services\Kommo\KommoClient;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SyncCierreDiarioCommand extends Command
{
    protected $signature = 'cierre:sync-kommo
                            {--fecha= : Fecha de importación (default: hoy)}
                            {--pipelines= : Pipeline IDs separados por coma (override config)}
                            {--dry-run : Solo muestra lo que haría, sin guardar}';

    protected $description = 'Sincroniza leads desde Kommo API y los guarda como cierre diario';

    public function handle(): int
    {
        $fechaImportacion = $this->option('fecha')
            ? Carbon::parse($this->option('fecha'))->toDateString()
            : Carbon::today()->toDateString();

        $pipelinesRaw = $this->option('pipelines') ?: config('kommo.pipeline_ids', '');
        $pipelineIds = array_values(array_filter(array_map(
            fn ($v) => (int) trim($v),
            explode(',', (string) $pipelinesRaw)
        ), fn ($v) => $v > 0));

        $dryRun = (bool) $this->option('dry-run');

        $this->info("Sincronizando cierre diario desde Kommo para {$fechaImportacion}...");

        if (! empty($pipelineIds)) {
            $this->info('Filtrando por pipelines: ' . implode(', ', $pipelineIds));
        }

        $client = new KommoClient();

        // Fetch reference data for mapping IDs to names
        $this->info('Obteniendo pipelines y usuarios de Kommo...');
        $pipelines = $client->fetchPipelines();
        $users = $client->fetchUsers();

        $statusMap = $this->buildStatusMap($pipelines);
        $pipelineMap = $this->buildPipelineMap($pipelines);
        $userMap = $this->buildUserMap($users);

        $customFieldIds = [
            'sucursal' => config('kommo.fields.sucursal'),
            'vehiculo' => config('kommo.fields.vehiculo'),
            'empresa' => config('kommo.fields.empresa'),
            'nombre_distribuidor' => config('kommo.fields.nombre_distribuidor'),
        ];

        // Fetch leads
        $this->info('Obteniendo leads desde Kommo...');
        $leads = $client->fetchAllLeads($pipelineIds);
        $this->info('Leads obtenidos: ' . count($leads));

        if (empty($leads)) {
            $this->warn('No se encontraron leads. Verificá las credenciales y el pipeline_id.');
            return self::SUCCESS;
        }

        // Map leads to CierreDiario records
        $records = [];
        foreach ($leads as $lead) {
            $records[] = $this->mapLeadToRecord($lead, $statusMap, $pipelineMap, $userMap, $customFieldIds);
        }

        if ($dryRun) {
            $this->info("--- DRY RUN: {$this->countWithValues($records)} registros válidos de " . count($records) . " leads ---");
            $this->table(
                ['Lead ID', 'Contacto', 'Estatus', 'Embudo', 'Asesor', 'Sucursal', 'Fecha Lead'],
                array_map(fn ($r) => [
                    $r['lead_id'],
                    $r['contacto'] ?? '-',
                    $r['estatus_lead'] ?? '-',
                    $r['embudo'] ?? '-',
                    $r['asesor_comercial'] ?? '-',
                    $r['sucursal'] ?? '-',
                    $r['fecha_lead'] ? $r['fecha_lead']->toDateString() : '-',
                ], array_slice($records, 0, 20))
            );

            if (count($records) > 20) {
                $this->info('... y ' . (count($records) - 20) . ' registros más.');
            }

            return self::SUCCESS;
        }

        // Upsert into database
        $stats = $this->upsertRecords($records, $fechaImportacion);

        $message = "Cierre sincronizado: {$stats['created']} nuevos, {$stats['updated']} actualizados para {$fechaImportacion}.";
        $this->info($message);
        Log::info('cierre:sync-kommo ' . $message);

        return self::SUCCESS;
    }

    private function mapLeadToRecord(
        array $lead,
        array $statusMap,
        array $pipelineMap,
        array $userMap,
        array $customFieldIds,
    ): array {
        $leadId = (int) ($lead['id'] ?? 0);
        $createdAt = isset($lead['created_at'])
            ? Carbon::createFromTimestamp($lead['created_at'])
            : null;

        $statusId = $lead['status_id'] ?? null;
        $pipelineIdLead = $lead['pipeline_id'] ?? null;
        $responsibleUserId = $lead['responsible_user_id'] ?? null;

        // Status name
        $estatusLead = null;
        if ($statusId !== null && $pipelineIdLead !== null) {
            $estatusLead = $statusMap["{$pipelineIdLead}_{$statusId}"] ?? null;
        }

        // Pipeline name (embudo)
        $embudo = $pipelineIdLead !== null ? ($pipelineMap[$pipelineIdLead] ?? null) : null;

        // Responsible user (asesor comercial)
        $asesorComercial = $responsibleUserId !== null ? ($userMap[$responsibleUserId] ?? null) : null;

        // Tags (etiquetas)
        $tags = $lead['_embedded']['tags'] ?? [];
        $etiquetasLead = ! empty($tags)
            ? implode(', ', array_map(fn ($t) => $t['name'] ?? '', $tags))
            : null;

        // Contact phone
        $contacto = $this->extractContactPhone($lead);

        // Custom fields
        $customFields = $lead['custom_fields_values'] ?? [];
        $sucursal = $this->extractCustomField($customFields, $customFieldIds['sucursal']);
        $vehiculo = $this->extractCustomField($customFields, $customFieldIds['vehiculo']);
        $empresa = $this->extractCustomField($customFields, $customFieldIds['empresa'])
            ?? $this->extractCompanyName($lead);
        $nombreDistribuidor = $this->extractCustomField($customFields, $customFieldIds['nombre_distribuidor']);

        return [
            'lead_id' => $leadId,
            'fecha_lead' => $createdAt,
            'contacto' => $contacto,
            'estatus_lead' => $estatusLead,
            'etiquetas_lead' => $etiquetasLead,
            'sucursal' => $sucursal,
            'vehiculo' => $vehiculo,
            'empresa' => $empresa,
            'embudo' => $embudo,
            'nombre_distribuidor' => $nombreDistribuidor,
            'asesor_comercial' => $asesorComercial,
            'mes' => $createdAt?->month,
            'semana' => $createdAt ? min(4, (int) floor(($createdAt->day - 1) / 7) + 1) : null,
            'dia' => $createdAt?->day,
        ];
    }

    private function extractContactPhone(array $lead): ?string
    {
        $contacts = $lead['_embedded']['contacts'] ?? [];

        foreach ($contacts as $contact) {
            $customFields = $contact['custom_fields_values'] ?? [];
            foreach ($customFields as $field) {
                $code = $field['field_code'] ?? '';
                if ($code === 'PHONE') {
                    $values = $field['values'] ?? [];
                    if (! empty($values[0]['value'])) {
                        return (string) $values[0]['value'];
                    }
                }
            }
        }

        return null;
    }

    private function extractCompanyName(array $lead): ?string
    {
        $companies = $lead['_embedded']['companies'] ?? [];

        if (! empty($companies[0]['name'])) {
            return (string) $companies[0]['name'];
        }

        return null;
    }

    private function extractCustomField(array $customFields, ?string $fieldId): ?string
    {
        if ($fieldId === null) {
            return null;
        }

        $id = (int) $fieldId;

        foreach ($customFields as $field) {
            if (($field['field_id'] ?? null) === $id) {
                $values = $field['values'] ?? [];
                if (! empty($values[0]['value'])) {
                    return (string) $values[0]['value'];
                }
            }
        }

        return null;
    }

    private function buildStatusMap(array $pipelines): array
    {
        $map = [];

        foreach ($pipelines as $pipeline) {
            $pipelineId = $pipeline['id'] ?? null;
            $statuses = $pipeline['_embedded']['statuses'] ?? [];

            foreach ($statuses as $status) {
                $statusId = $status['id'] ?? null;
                if ($pipelineId !== null && $statusId !== null) {
                    $map["{$pipelineId}_{$statusId}"] = $status['name'] ?? '';
                }
            }
        }

        return $map;
    }

    private function buildPipelineMap(array $pipelines): array
    {
        $map = [];

        foreach ($pipelines as $pipeline) {
            $id = $pipeline['id'] ?? null;
            if ($id !== null) {
                $map[$id] = $pipeline['name'] ?? '';
            }
        }

        return $map;
    }

    private function buildUserMap(array $users): array
    {
        $map = [];

        foreach ($users as $user) {
            $id = $user['id'] ?? null;
            if ($id !== null) {
                $map[$id] = $user['name'] ?? '';
            }
        }

        return $map;
    }

    private function upsertRecords(array $records, string $fechaImportacion): array
    {
        return DB::transaction(function () use ($records, $fechaImportacion) {
            $created = 0;
            $updated = 0;

            $leadIds = array_values(array_filter(
                array_map(fn ($r) => $r['lead_id'] ?? null, $records),
                fn ($id) => $id !== null && $id > 0
            ));

            $existingByLeadId = [];
            if (! empty($leadIds)) {
                $existingByLeadId = CierreDiario::query()
                    ->select(['id', 'lead_id'])
                    ->whereDate('fecha_importacion', $fechaImportacion)
                    ->whereIn('lead_id', $leadIds)
                    ->get()
                    ->keyBy('lead_id')
                    ->all();
            }

            foreach ($records as $record) {
                $payload = [
                    'fecha_importacion' => $fechaImportacion,
                    'fecha_lead' => $record['fecha_lead'],
                    'lead_id' => $record['lead_id'],
                    'contacto' => $record['contacto'],
                    'estatus_lead' => $record['estatus_lead'],
                    'etiquetas_lead' => $record['etiquetas_lead'],
                    'sucursal' => $record['sucursal'],
                    'vehiculo' => $record['vehiculo'],
                    'empresa' => $record['empresa'],
                    'embudo' => $record['embudo'],
                    'nombre_distribuidor' => $record['nombre_distribuidor'],
                    'asesor_comercial' => $record['asesor_comercial'],
                    'mes' => $record['mes'],
                    'semana' => $record['semana'],
                    'dia' => $record['dia'],
                    'importado_por' => 'sistema:kommo-sync',
                ];

                $leadId = $record['lead_id'] ?? null;
                if ($leadId !== null && $leadId > 0 && isset($existingByLeadId[$leadId])) {
                    $existingId = (int) $existingByLeadId[$leadId]->id;
                    CierreDiario::query()->whereKey($existingId)->update($payload);
                    $updated++;
                    continue;
                }

                $model = CierreDiario::query()->create($payload);
                $created++;
                if ($leadId !== null && $leadId > 0) {
                    $existingByLeadId[$leadId] = $model;
                }
            }

            return ['created' => $created, 'updated' => $updated, 'total' => count($records)];
        });
    }

    private function countWithValues(array $records): int
    {
        return count(array_filter($records, function ($r) {
            return ($r['lead_id'] ?? 0) > 0;
        }));
    }
}

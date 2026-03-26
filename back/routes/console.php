<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Models\LiquidacionClientRule;
use App\Services\Liquidaciones\LoginterTarifarioImporter;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('liquidaciones:import-loginter-tarifario
    {path : Ruta al XLSX del tarifario}
    {--clientCode=LOGINTER : Código del cliente en liq_client_rules}
    {--stdout : Imprime el JSON y no escribe en la BD}', function () {
    $path = (string) $this->argument('path');
    if (!is_file($path)) {
        $this->error('Archivo no encontrado: ' . $path);
        return 1;
    }

    /** @var LoginterTarifarioImporter $importer */
    $importer = app(LoginterTarifarioImporter::class);
    $tarifario = $importer->importFromXlsx($path);

    $clientCode = strtoupper(trim((string) $this->option('clientCode'))) ?: 'LOGINTER';
    $payload = [
        'loginter' => [
            'tarifario' => $tarifario,
        ],
    ];

    if ((bool) $this->option('stdout')) {
        $this->line(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        $this->info('OK: JSON generado. Sucursales: ' . ($tarifario['sucursal_count'] ?? '?') . ' | Filas: ' . ($tarifario['row_count'] ?? '?'));
        return 0;
    }

    $record = LiquidacionClientRule::query()->where('client_code', $clientCode)->first();
    $rules = is_array($record?->rules_json) ? $record->rules_json : [];
    $loginter = is_array($rules['loginter'] ?? null) ? $rules['loginter'] : [];
    $loginter['tarifario'] = $tarifario;
    $rules['loginter'] = $loginter;

    LiquidacionClientRule::query()->updateOrCreate(
        ['client_code' => $clientCode],
        [
            'active' => true,
            'rules_json' => $rules,
            'note' => 'Tarifario ' . $clientCode . ' importado desde XLSX (' . basename($path) . ')',
            'updated_by' => null,
        ]
    );

    $this->info('OK: tarifario importado en BD. Cliente=' . $clientCode . ' | Sucursales: ' . ($tarifario['sucursal_count'] ?? '?') . ' | Filas: ' . ($tarifario['row_count'] ?? '?'));
    return 0;
})->purpose('Importa el tarifario de LOGINTER desde un XLSX y lo guarda en liq_client_rules.');

<?php

namespace App\Console\Commands;

use App\Helpers\LiqV2DocumentoHelper;
use App\Models\Archivo;
use App\Models\FileType;
use App\Models\LiqCliente;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqLiquidacionDistribuidor;
use App\Models\LiqOperacion;
use App\Services\Liq\LiqDistribuidorPdfService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * SPEC INTEGRAL Fase B — Regenera en masa los PDFs de distribuidor para un cliente/período.
 *
 *   php artisan liq:regenerar-pdfs-distribuidor --cliente=OCASA --periodo=2026-03
 *   php artisan liq:regenerar-pdfs-distribuidor --liq-cliente-id=41
 *
 * Replica la lógica de LiqDistribuidorDocumentoController::store pero sin auth/role checks,
 * usada para re-emitir los PDFs cuando cambian tarifas, eficiencia o diseño.
 */
class RegenerarPdfsDistribuidor extends Command
{
    protected $signature = 'liq:regenerar-pdfs-distribuidor
                            {--cliente= : nombre_corto del cliente}
                            {--periodo= : YYYY-MM (requiere --cliente)}
                            {--liq-cliente-id= : O directamente el liquidacion_cliente_id}
                            {--dry-run : Lista los que regeneraría sin escribir archivos}';

    protected $description = 'SPEC Fase B: regenera los PDFs de distribuidor del período.';

    public function handle(LiqDistribuidorPdfService $pdfSvc): int
    {
        $dryRun = (bool) $this->option('dry-run');

        // Resolver liqIds
        $liqIds = [];
        if ($liqId = $this->option('liq-cliente-id')) {
            $liqIds = [(int) $liqId];
        } else {
            $cli = $this->option('cliente');
            $per = $this->option('periodo');
            if (!$cli || !preg_match('/^(\d{4})-(\d{2})$/', (string) $per, $m)) {
                $this->error('Pasar --liq-cliente-id=N o --cliente=X --periodo=YYYY-MM');
                return 1;
            }
            $cliente = LiqCliente::where('nombre_corto', $cli)->orWhere('razon_social', 'like', "%{$cli}%")->first();
            if (!$cliente) { $this->error("Cliente '{$cli}' no existe"); return 1; }
            $from = sprintf('%04d-%02d-01', (int) $m[1], (int) $m[2]);
            $to   = date('Y-m-t', strtotime($from));
            $liqIds = LiqLiquidacionCliente::where('cliente_id', $cliente->id)
                ->whereBetween('periodo_desde', [$from, $to])->pluck('id')->toArray();
        }

        if (empty($liqIds)) { $this->warn('No se encontraron liquidaciones cliente'); return 0; }

        $dists = LiqLiquidacionDistribuidor::whereIn('liquidacion_cliente_id', $liqIds)
            ->with([
                'distribuidor:id,apellidos,nombres,email,patente',
                'liquidacionCliente:id,cliente_id,periodo_desde,periodo_hasta',
                'liquidacionCliente.cliente:id,nombre_corto,razon_social',
            ])
            ->whereNotIn('estado', ['anulada'])
            ->get();

        $this->info("Liquidaciones distribuidor a procesar: {$dists->count()}");

        $tipoLiquidacion = $dryRun ? null : FileType::query()->firstOrCreate(['nombre' => 'Liquidación'], ['vence' => false]);
        $bar = $this->output->createProgressBar($dists->count());
        $bar->start();

        $stats = ['ok' => 0, 'error' => 0, 'skipped' => 0];
        $errores = [];

        foreach ($dists as $liqDist) {
            try {
                $personaId = (int) $liqDist->distribuidor_id;
                if ($personaId <= 0) { $stats['skipped']++; $bar->advance(); continue; }

                $operaciones = LiqOperacion::where('liquidacion_cliente_id', $liqDist->liquidacion_cliente_id)
                    ->where('distribuidor_id', $personaId)
                    ->whereIn('estado', ['ok', 'diferencia'])
                    ->where('excluida', false)
                    ->get();

                if ($dryRun) {
                    $stats['ok']++;
                    $bar->advance();
                    continue;
                }

                $clienteLabel = $liqDist->liquidacionCliente?->cliente?->nombre_corto
                    ?? $liqDist->liquidacionCliente?->cliente?->razon_social
                    ?? 'Cliente';
                $desde = $liqDist->periodo_desde?->toDateString() ?? (string) $liqDist->periodo_desde;
                $hasta = $liqDist->periodo_hasta?->toDateString() ?? (string) $liqDist->periodo_hasta;

                $disk = LiqV2DocumentoHelper::disk();
                $directory = LiqV2DocumentoHelper::directoryForPersona($personaId);
                $storedPath = LiqV2DocumentoHelper::buildStoredPath($personaId, $liqDist);

                $pdf = $pdfSvc->renderPdf($liqDist, $operaciones);
                Storage::disk($disk)->put($storedPath, $pdf);
                $size = (int) (Storage::disk($disk)->size($storedPath) ?? 0);

                $nombre = sprintf(
                    'Liquidación (Extractos) - %s - %s al %s - Dist %d.pdf',
                    $clienteLabel, $desde, $hasta, $personaId
                );

                // Upsert Archivo (misma idempotencia que el controller)
                $doc = Archivo::withTrashed()
                    ->where('persona_id', $personaId)
                    ->where('disk', $disk)
                    ->where('ruta', $storedPath)
                    ->first();

                $fechaMes = null;
                try { $fechaMes = Carbon::parse($hasta)->startOfMonth(); } catch (\Throwable) { $fechaMes = now()->startOfMonth(); }
                $fortnight = null;
                try { $end = Carbon::parse($hasta); $fortnight = $end->day <= 15 ? 'Q1' : 'Q2'; } catch (\Throwable) {}

                $payload = [
                    'persona_id' => $personaId,
                    'parent_document_id' => null,
                    'liquidacion_id' => null,
                    'es_pendiente' => true,
                    'tipo_archivo_id' => $tipoLiquidacion->id,
                    'carpeta' => $directory,
                    'ruta' => $storedPath,
                    'disk' => $disk,
                    'nombre_original' => $nombre,
                    'mime' => 'application/pdf',
                    'size' => $size,
                    'fecha_vencimiento' => $fechaMes,
                    'fortnight_key' => $fortnight,
                    'month_key' => $fechaMes?->format('Y-m'),
                    'importe_facturar' => (float) $liqDist->total_a_pagar,
                ];

                if ($doc) {
                    if ($doc->trashed()) $doc->restore();
                    $doc->fill($payload)->save();
                } else {
                    $doc = Archivo::create($payload);
                }

                $liqDist->update(['pdf_path' => $storedPath]);

                $stats['ok']++;
            } catch (\Throwable $e) {
                $stats['error']++;
                $errores[] = "LiqDist #{$liqDist->id}: " . $e->getMessage();
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info(sprintf('OK: %d  |  Errores: %d  |  Skip: %d', $stats['ok'], $stats['error'], $stats['skipped']));
        if (!empty($errores)) {
            $this->newLine();
            $this->warn('Errores:');
            foreach (array_slice($errores, 0, 10) as $e) $this->line("  · {$e}");
            if (count($errores) > 10) $this->line('  (+' . (count($errores) - 10) . ' más)');
        }
        if ($dryRun) $this->warn('DRY-RUN: no se escribieron archivos');

        return $stats['error'] > 0 ? 1 : 0;
    }
}

<?php

namespace App\Services\Liq;

use App\Models\Archivo;
use App\Models\FileType;
use App\Models\LiqLiquidacionDistribuidor;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

class LiqDistribuidorPersonalLiquidacionService
{
    /**
     * Copia el PDF generado en el módulo de Liquidaciones v2 al legajo Personal,
     * creando un documento "Liquidación" para el proveedor/distribuidor.
     *
     * Devuelve el documento creado (o existente si ya estaba generado).
     */
    public function crearDocumentoPersonalDesdeLiquidacion(LiqLiquidacionDistribuidor $liqDistribuidor): ?Archivo
    {
        $persona = $liqDistribuidor->distribuidor;
        if (! $persona) {
            return null;
        }

        $sourcePath = $liqDistribuidor->pdf_path ? trim((string) $liqDistribuidor->pdf_path) : '';
        if ($sourcePath === '' || ! Storage::disk('public')->exists($sourcePath)) {
            throw new \RuntimeException('PDF no disponible todavía.');
        }

        $tipoLiquidacion = FileType::query()->firstOrCreate(
            ['nombre' => 'Liquidación'],
            ['vence' => false]
        );

        $periodoDesde = $liqDistribuidor->periodo_desde ? Carbon::parse($liqDistribuidor->periodo_desde) : null;
        $periodoHasta = $liqDistribuidor->periodo_hasta ? Carbon::parse($liqDistribuidor->periodo_hasta) : null;

        $directory = 'personal/' . $persona->id;
        $targetFileName = sprintf(
            'liq_dist_%d_%s_%s.pdf',
            $liqDistribuidor->id,
            $periodoDesde?->format('Ymd') ?? 'desde',
            $periodoHasta?->format('Ymd') ?? 'hasta'
        );
        $targetPath = $directory . '/' . $targetFileName;

        $existing = Archivo::query()
            ->where('persona_id', $persona->id)
            ->where('disk', 'public')
            ->where('ruta', $targetPath)
            ->first();
        if ($existing) {
            return $existing;
        }

        if (! Storage::disk('public')->exists($targetPath)) {
            Storage::disk('public')->copy($sourcePath, $targetPath);
        }

        $mime = (string) (Storage::disk('public')->mimeType($targetPath) ?: 'application/pdf');
        $size = (int) (Storage::disk('public')->size($targetPath) ?: 0);

        $clienteNombre = $liqDistribuidor->liquidacionCliente?->cliente?->nombre_corto
            ?? $liqDistribuidor->liquidacionCliente?->cliente?->razon_social
            ?? 'Cliente';

        $patente = trim((string) ($persona->patente ?? ''));
        $nombreBase = sprintf(
            'Liquidación %s %s - %s a %s',
            $clienteNombre,
            $patente !== '' ? "({$patente})" : '',
            $periodoDesde?->format('d-m-Y') ?? '',
            $periodoHasta?->format('d-m-Y') ?? ''
        );
        $nombreOriginal = trim(preg_replace('/\s+/', ' ', $nombreBase)) . '.pdf';

        $createdAt = $periodoHasta?->copy()->endOfDay() ?? now();
        $fortnightKey = $this->resolveFortnightKey($createdAt);

        $documento = $persona->documentos()->create([
            'carpeta' => $directory,
            'ruta' => $targetPath,
            'parent_document_id' => null,
            'liquidacion_id' => null,
            'es_pendiente' => false,
            'download_url' => null,
            'disk' => 'public',
            'nombre_original' => $nombreOriginal,
            'mime' => $mime,
            'size' => $size,
            'tipo_archivo_id' => $tipoLiquidacion->id,
            'fecha_vencimiento' => null,
            'fortnight_key' => $fortnightKey,
            'importe_facturar' => $liqDistribuidor->total_a_pagar,
            'enviada' => false,
            'recibido' => false,
            'pagado' => false,
            'liquidacion_destinatario_tipo' => null,
            'liquidacion_destinatario_emails' => null,
        ]);

        $documento->created_at = $createdAt;
        $documento->updated_at = $createdAt;
        $documento->save();

        $relativeDownloadUrl = route('personal.documentos.descargar', [
            'persona' => $persona->id,
            'documento' => $documento->id,
        ], false);

        $documento->download_url = $relativeDownloadUrl;
        $documento->save();

        return $documento;
    }

    private function resolveFortnightKey(Carbon $date): string
    {
        if ($date->day <= 15) {
            return 'Q1';
        }

        return 'Q2';
    }
}

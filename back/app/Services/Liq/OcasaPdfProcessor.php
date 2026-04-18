<?php

namespace App\Services\Liq;

use App\Models\LiqArchivoEntrada;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqOperacion;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * BUGFIX 22 Feature A: parsea los PDFs facturables que OCASA envía y
 * actualiza las liq_operaciones con importe_gravado, importe_no_gravado
 * y id_liquidacion_cliente_externo (vinculando por id_operacion_cliente = Transporte).
 */
class OcasaPdfProcessor
{
    private function baseUrl(): string
    {
        return rtrim((string) config('services.oca.base_url', 'http://localhost:8100'), '/');
    }

    /**
     * Procesa un archivo PDF OCASA ya cargado en storage.
     *
     * @return array{operaciones_actualizadas:int, operaciones_huerfanas:int, total_importe:float, total_gravado:float, total_no_gravado:float, sucursal:?string, warnings:array}
     */
    public function procesarArchivo(LiqArchivoEntrada $archivo, LiqLiquidacionCliente $liquidacion): array
    {
        $disk = $archivo->disk ?: 'local';
        $ruta = $archivo->ruta_storage;
        if (!$ruta || !Storage::disk($disk)->exists($ruta)) {
            throw new RuntimeException("Archivo no encontrado: {$ruta}");
        }

        $path = Storage::disk($disk)->path($ruta);
        $nombre = $archivo->nombre_original ?: basename($path);

        // Llamar al microservicio Python
        $response = Http::timeout(120)
            ->attach('pdf', fopen($path, 'r'), $nombre)
            ->post($this->baseUrl() . '/api/ocasa/parse-pdf');

        if (!$response->ok()) {
            throw new RuntimeException('Error del microservicio Python: ' . $response->body());
        }

        $data = $response->json();
        if (!($data['success'] ?? false)) {
            throw new RuntimeException('Error parseando PDF: ' . ($data['error'] ?? 'Desconocido'));
        }

        $sucursal = $data['sucursal'] ?? null;
        $operaciones = $data['operaciones'] ?? [];
        $warnings = $data['warnings'] ?? [];

        // Vincular cada línea del PDF con una liq_operacion por id_operacion_cliente (Transporte)
        $actualizadas = 0;
        $huerfanas = 0;

        foreach ($operaciones as $op) {
            $transporte = (string) ($op['transporte'] ?? '');
            if ($transporte === '') {
                $huerfanas++;
                continue;
            }

            $liqOp = LiqOperacion::where('liquidacion_cliente_id', $liquidacion->id)
                ->where('id_operacion_cliente', $transporte)
                ->first();

            if (!$liqOp) {
                $huerfanas++;
                continue;
            }

            $liqOp->update([
                'importe_gravado' => $op['imp_gravado'] ?? 0,
                'importe_no_gravado' => $op['imp_no_gravado'] ?? 0,
                'id_liquidacion_cliente_externo' => $op['id_liquidacion'] ?? null,
            ]);
            $actualizadas++;
        }

        // Actualizar archivo con info de parseo
        $archivo->update([
            'cant_registros' => count($operaciones),
            'sucursal' => $sucursal ?? $archivo->sucursal,
        ]);

        // Recalcular totales por sucursal
        if ($sucursal) {
            $this->recalcularTotalSucursal($liquidacion->id, $sucursal, $archivo->id);
        }

        return [
            'operaciones_actualizadas' => $actualizadas,
            'operaciones_huerfanas' => $huerfanas,
            'total_operaciones' => count($operaciones),
            'total_importe' => (float) ($data['total_importe'] ?? 0),
            'total_gravado' => (float) ($data['total_gravado'] ?? 0),
            'total_no_gravado' => (float) ($data['total_no_gravado'] ?? 0),
            'sucursal' => $sucursal,
            'warnings' => $warnings,
        ];
    }

    /**
     * Recalcula totales gravado/no gravado por sucursal en liq_liquidacion_sucursal_totales.
     */
    public function recalcularTotalSucursal(int $liquidacionClienteId, string $sucursal, ?int $pdfArchivoId = null): void
    {
        $totales = LiqOperacion::where('liquidacion_cliente_id', $liquidacionClienteId)
            ->where('sucursal_tarifa', $sucursal)
            ->whereNotIn('estado', ['ignorado', 'anulado', 'excluida'])
            ->selectRaw('COUNT(*) as cantidad, COALESCE(SUM(valor_cliente),0) as total_importe, COALESCE(SUM(importe_gravado),0) as total_grav, COALESCE(SUM(importe_no_gravado),0) as total_nograv')
            ->first();

        if (!$totales) return;

        \DB::table('liq_liquidacion_sucursal_totales')->updateOrInsert(
            [
                'liquidacion_cliente_id' => $liquidacionClienteId,
                'sucursal' => $sucursal,
            ],
            [
                'cantidad_operaciones' => $totales->cantidad,
                'total_importe' => $totales->total_importe,
                'total_gravado' => $totales->total_grav,
                'total_no_gravado' => $totales->total_nograv,
                'pdf_archivo_id' => $pdfArchivoId,
                'parseado_at' => now(),
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );
    }
}

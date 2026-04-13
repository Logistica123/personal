<?php

namespace App\Services\Liq\Banco;

use App\Models\LiqOrdenPago;
use App\Models\LiqOrdenPagoDetalle;
use ZipArchive;

/**
 * Genera el archivo CSV en formato PPV4 y lo comprime en ZIP
 * para enviar a ICBC Multipay via createListUpload.
 *
 * Formato PPV4: CSV con campos por línea de pago.
 * Encoding: ISO-8859-1 (requerido por ICBC, NO UTF-8).
 * El ZIP contiene UN solo archivo CSV sin directorios.
 *
 * NOTA: El layout exacto del PPV4 es PROVISIONAL.
 * Confirmar campos con ICBC antes de usar en producción.
 */
class ICBCCsvHelper
{
    /**
     * Genera el byte[] del ZIP con el CSV de items de pago.
     *
     * @param LiqOrdenPago $op  La orden de pago con detalles cargados
     * @return string  Contenido binario del ZIP
     */
    public function generarZip(LiqOrdenPago $op): string
    {
        $op->loadMissing('detalles');

        $csv = '';
        $itemNum = 0;

        foreach ($op->detalles as $detalle) {
            // Solo incluir items que van por transferencia
            if ($detalle->medio_pago && $detalle->medio_pago !== 'Transferencia') {
                continue;
            }

            $itemNum++;
            $cbu = $this->limpiarCbu($detalle->ordenPago?->beneficiario_cbu ?? '');
            $cuil = $this->limpiarCuil($detalle->ordenPago?->beneficiario_cuil ?? '');
            $importeCentavos = intval(round((float) $detalle->importe_final * 100));

            // Formato PPV4 (provisional - confirmar con ICBC)
            $campos = [
                str_pad((string) $itemNum, 14, '0', STR_PAD_LEFT),  // Nro proveedor
                '06',                                                 // Tipo doc = CUIT
                $cuil,                                                // CUIT/CUIL beneficiario
                '1',                                                  // Forma pago = Crédito en cuenta
                $cbu,                                                 // CBU beneficiario
                (string) $importeCentavos,                           // Importe en centavos
                'ARP',                                                // Moneda = Pesos
                $this->sanitizar($detalle->cliente_nombre . ' ' . $detalle->periodo), // Observación
            ];

            $csv .= implode(',', $campos) . "\r\n";
        }

        if ($csv === '') {
            throw new \RuntimeException('No hay items de transferencia para generar el CSV.');
        }

        // Convertir a ISO-8859-1 (requerido por ICBC)
        $csvLatin = mb_convert_encoding($csv, 'ISO-8859-1', 'UTF-8');

        // Crear ZIP en memoria
        $zipPath = tempnam(sys_get_temp_dir(), 'icbc_ppv4_');
        $zip = new ZipArchive();

        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException('No se pudo crear el archivo ZIP.');
        }

        $zip->addFromString('items.csv', $csvLatin);
        $zip->close();

        $content = file_get_contents($zipPath);
        unlink($zipPath);

        return $content;
    }

    /**
     * Cuenta los items de transferencia en la OP.
     */
    public function contarItems(LiqOrdenPago $op): int
    {
        $op->loadMissing('detalles');

        return $op->detalles->filter(function ($d) {
            return !$d->medio_pago || $d->medio_pago === 'Transferencia';
        })->count();
    }

    /**
     * Suma el importe total en centavos de los items de transferencia.
     */
    public function importeTotalCentavos(LiqOrdenPago $op): int
    {
        $op->loadMissing('detalles');

        $total = $op->detalles
            ->filter(fn ($d) => !$d->medio_pago || $d->medio_pago === 'Transferencia')
            ->sum('importe_final');

        return intval(round((float) $total * 100));
    }

    private function limpiarCbu(string $cbu): string
    {
        return preg_replace('/\D/', '', $cbu);
    }

    private function limpiarCuil(string $cuil): string
    {
        return preg_replace('/\D/', '', $cuil);
    }

    /**
     * Sanitiza texto para CSV: quita comas, comillas, y limita largo.
     */
    private function sanitizar(string $texto, int $maxLen = 80): string
    {
        $texto = str_replace([',', '"', ';', "\n", "\r"], ' ', $texto);
        return mb_substr(trim($texto), 0, $maxLen);
    }
}

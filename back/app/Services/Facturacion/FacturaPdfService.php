<?php

namespace App\Services\Facturacion;

use App\Models\FacturaCabecera;
use Illuminate\Support\Facades\Storage;

class FacturaPdfService
{
    public function generate(FacturaCabecera $factura): string
    {
        $factura->loadMissing(['emisor', 'cliente', 'sucursal', 'detallePdf', 'ivaItems', 'tributos']);

        $comprobante = $this->resolveComprobanteLabel((int) $factura->cbte_tipo);
        $letra = $this->resolveComprobanteLetra((int) $factura->cbte_tipo);
        $numero = sprintf('%04d-%08d', (int) $factura->pto_vta, (int) ($factura->cbte_numero ?? 0));
        $periodo = sprintf(
            '%d/%02d %s',
            (int) $factura->anio_facturado,
            (int) $factura->mes_facturado,
            (string) ($factura->periodo_facturado?->value ?? $factura->periodo_facturado)
        );

        $elements = [];
        $leftY = 800;
        $rightY = 800;

        $razonSocial = (string) (config('services.arca.emisor_razon_social', '') ?: ($factura->emisor?->razon_social ?? ''));
        $cuitEmisor = (string) (config('services.arca.cuit_emisor_default', '') ?: ($factura->emisor?->cuit ?? ''));
        $condicionIva = (string) (config('services.arca.emisor_condicion_iva', '') ?: ($factura->emisor?->condicion_iva ?? ''));
        $domicilioFiscal = (string) config('services.arca.emisor_domicilio', '');

        $this->addText($elements, 50, $leftY, 'F2', 14, $razonSocial);
        $leftY -= 14;
        $this->addText($elements, 50, $leftY, 'F1', 10, sprintf('CUIT emisor: %s', $cuitEmisor));
        $leftY -= 12;
        $this->addText($elements, 50, $leftY, 'F1', 10, sprintf('Condicion IVA: %s', $condicionIva));
        $leftY -= 12;
        if ($domicilioFiscal !== '') {
            $this->addText($elements, 50, $leftY, 'F1', 10, sprintf('Domicilio fiscal: %s', $domicilioFiscal));
            $leftY -= 12;
        }
        $this->addText($elements, 50, $leftY, 'F1', 10, sprintf('Punto de venta: %04d', (int) $factura->pto_vta));
        $leftY -= 12;
        $this->addText($elements, 50, $leftY, 'F1', 10, sprintf('Ambiente: %s', (string) ($factura->ambiente?->value ?? $factura->ambiente)));

        $this->addText($elements, 330, $rightY, 'F2', 12, sprintf('Factura %s', $letra !== '' ? $letra : $comprobante));
        $rightY -= 14;
        $this->addText($elements, 330, $rightY, 'F1', 10, sprintf('Comprobante: %s', $comprobante));
        $rightY -= 12;
        $this->addText($elements, 330, $rightY, 'F1', 10, sprintf('Numero: %s', $numero));
        $rightY -= 12;
        $this->addText($elements, 330, $rightY, 'F1', 10, sprintf('Fecha emision: %s', $this->formatDate($factura->fecha_cbte)));

        $separatorY = min($leftY, $rightY) - 10;
        $this->addLine($elements, 50, $separatorY, 545, $separatorY);

        $y = $separatorY - 18;
        $this->addText($elements, 50, $y, 'F2', 11, 'Receptor');
        $y -= 12;
        $this->addText($elements, 50, $y, 'F1', 10, sprintf('Cliente: %s', $factura->cliente_nombre));
        $y -= 12;
        $this->addText($elements, 50, $y, 'F1', 10, sprintf('CUIT receptor: %s', $factura->doc_nro));
        $y -= 12;
        $domicilioLines = $this->wrapText(sprintf('Domicilio: %s', (string) ($factura->cliente_domicilio ?? '')), 70);
        foreach ($domicilioLines as $line) {
            $this->addText($elements, 50, $y, 'F1', 10, $line);
            $y -= 12;
        }
        if ($factura->sucursal) {
            $this->addText($elements, 50, $y, 'F1', 10, sprintf('Sucursal: %s', $factura->sucursal->nombre ?? ''));
            $y -= 12;
        }
        $this->addText($elements, 50, $y, 'F1', 10, sprintf('Periodo facturado: %s', $periodo));
        $y -= 12;
        $this->addText($elements, 50, $y, 'F1', 10, sprintf('Fecha vto pago: %s', $this->formatDate($factura->fecha_vto_pago)));
        $y -= 12;
        $this->addText($elements, 50, $y, 'F1', 10, sprintf('Concepto: %s', $this->resolveConcepto((int) $factura->concepto)));
        $y -= 14;

        $this->addText($elements, 50, $y, 'F2', 11, 'Detalle');
        $y -= 12;
        $header = sprintf('%-3s %-42s %6s %10s %10s', '#', 'Descripcion', 'Cant', 'Precio', 'Subtotal');
        $this->addText($elements, 50, $y, 'F3', 9, $header);
        $y -= 10;
        $this->addLine($elements, 50, $y, 545, $y);
        $y -= 12;

        foreach ($factura->detallePdf as $item) {
            $line = sprintf(
                '%-3s %-42s %6s %10s %10s',
                (string) (int) $item->orden,
                $this->truncate((string) $item->descripcion, 42),
                $this->formatNumber($item->cantidad),
                $this->formatMoney($item->precio_unitario),
                $this->formatMoney($item->subtotal_con_iva)
            );
            $this->addText($elements, 50, $y, 'F3', 9, $line);
            $y -= 12;
        }

        $y -= 6;
        $this->addLine($elements, 50, $y, 545, $y);
        $y -= 14;

        $this->addText($elements, 50, $y, 'F2', 10, 'IVA discriminado');
        $y -= 12;
        if ($factura->ivaItems->isEmpty()) {
            $this->addText($elements, 50, $y, 'F1', 10, 'Sin IVA detallado.');
            $y -= 12;
        } else {
            foreach ($factura->ivaItems as $iva) {
                $this->addText(
                    $elements,
                    50,
                    $y,
                    'F1',
                    10,
                    sprintf('IVA %s Base %s Importe %s', (string) $iva->iva_id, $this->formatMoney($iva->base_imp), $this->formatMoney($iva->importe))
                );
                $y -= 12;
            }
        }

        if ($factura->tributos->isNotEmpty()) {
            $this->addText($elements, 50, $y, 'F2', 10, 'Otros tributos');
            $y -= 12;
            foreach ($factura->tributos as $tributo) {
                $this->addText(
                    $elements,
                    50,
                    $y,
                    'F1',
                    10,
                    sprintf(
                        '%s %s Importe %s',
                        (string) $tributo->tributo_id,
                        (string) ($tributo->descr ?? ''),
                        $this->formatMoney($tributo->importe)
                    )
                );
                $y -= 12;
            }
        }

        $y -= 4;
        $this->addText($elements, 330, $y, 'F2', 10, sprintf('Neto gravado: %s', $this->formatMoney($factura->imp_neto)));
        $y -= 12;
        $this->addText(
            $elements,
            330,
            $y,
            'F2',
            10,
            sprintf('No gravado: %s', $this->formatMoney((float) ($factura->imp_tot_conc + $factura->imp_op_ex)))
        );
        $y -= 12;
        $this->addText($elements, 330, $y, 'F2', 10, sprintf('IVA: %s', $this->formatMoney($factura->imp_iva)));
        $y -= 12;
        $this->addText($elements, 330, $y, 'F2', 10, sprintf('Tributos: %s', $this->formatMoney($factura->imp_trib)));
        $y -= 12;
        $this->addText($elements, 330, $y, 'F2', 12, sprintf('Total: %s', $this->formatMoney($factura->imp_total)));

        $y -= 20;
        $this->addText($elements, 50, $y, 'F1', 10, sprintf('CAE: %s', (string) ($factura->cae ?? '')));
        $y -= 12;
        $this->addText($elements, 50, $y, 'F1', 10, sprintf('Vto CAE: %s', $this->formatDate($factura->cae_vto)));

        $pdfContent = $this->buildPdf($elements);
        $path = sprintf('facturacion/pdfs/factura-%d.pdf', $factura->id);

        Storage::disk((string) config('services.arca.storage_disk', 'local'))->put($path, $pdfContent);

        return $path;
    }

    /**
     * @param list<string> $elements
     */
    private function buildPdf(array $elements): string
    {
        $content = implode("\n", $elements);

        $objects = [];
        $objects[] = "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj";
        $objects[] = "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj";
        $objects[] = "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >> endobj";
        $objects[] = "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj";
        $objects[] = "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj";
        $objects[] = "6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj";
        $objects[] = sprintf("7 0 obj << /Length %d >> stream\n%s\nendstream endobj", strlen($content), $content);

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $object) {
            $offsets[] = strlen($pdf);
            $pdf .= $object . "\n";
        }

        $xrefOffset = strlen($pdf);
        $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
        $pdf .= "0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }
        $pdf .= "trailer << /Size " . (count($objects) + 1) . " /Root 1 0 R >>\n";
        $pdf .= "startxref\n{$xrefOffset}\n%%EOF";

        return $pdf;
    }

    /**
     * @param list<string> $elements
     */
    private function addText(array &$elements, float $x, float $y, string $font, int $size, string $text): void
    {
        $elements[] = sprintf(
            "BT /%s %d Tf 1 0 0 1 %.2f %.2f Tm (%s) Tj ET",
            $font,
            $size,
            $x,
            $y,
            $this->escapePdfText($text)
        );
    }

    /**
     * @param list<string> $elements
     */
    private function addLine(array &$elements, float $x1, float $y1, float $x2, float $y2): void
    {
        $elements[] = sprintf("0.7 w %.2f %.2f m %.2f %.2f l S", $x1, $y1, $x2, $y2);
    }

    private function escapePdfText(string $text): string
    {
        $text = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);

        return preg_replace('/[^\x20-\x7E]/', ' ', $text) ?: '';
    }

    /**
     * @return list<string>
     */
    private function wrapText(string $text, int $maxChars): array
    {
        $words = preg_split('/\s+/', trim($text)) ?: [];
        if ($words === []) {
            return [''];
        }
        $lines = [];
        $current = '';
        foreach ($words as $word) {
            $candidate = $current === '' ? $word : $current . ' ' . $word;
            if (strlen($candidate) > $maxChars) {
                if ($current !== '') {
                    $lines[] = $current;
                }
                $current = $word;
            } else {
                $current = $candidate;
            }
        }
        if ($current !== '') {
            $lines[] = $current;
        }

        return $lines;
    }

    private function truncate(string $text, int $maxChars): string
    {
        if (strlen($text) <= $maxChars) {
            return $text;
        }

        return substr($text, 0, max(0, $maxChars - 3)) . '...';
    }

    private function formatDate(?\Carbon\Carbon $date): string
    {
        return $date ? $date->format('d/m/Y') : '—';
    }

    private function formatMoney(mixed $value): string
    {
        return number_format((float) $value, 2, '.', '');
    }

    private function formatNumber(mixed $value): string
    {
        $float = (float) $value;
        return number_format($float, $float === floor($float) ? 0 : 2, '.', '');
    }

    private function resolveComprobanteLabel(int $cbteTipo): string
    {
        return match ($cbteTipo) {
            1 => 'Factura A',
            2 => 'Nota Debito A',
            3 => 'Nota Credito A',
            6 => 'Factura B',
            7 => 'Nota Debito B',
            8 => 'Nota Credito B',
            11 => 'Factura C',
            12 => 'Nota Debito C',
            13 => 'Nota Credito C',
            default => sprintf('Comprobante %d', $cbteTipo),
        };
    }

    private function resolveComprobanteLetra(int $cbteTipo): string
    {
        if (in_array($cbteTipo, [1, 2, 3, 4, 5, 19, 20, 21, 22, 23, 24, 25], true)) {
            return 'A';
        }
        if (in_array($cbteTipo, [6, 7, 8, 9, 10], true)) {
            return 'B';
        }
        if (in_array($cbteTipo, [11, 12, 13, 15], true)) {
            return 'C';
        }

        return '';
    }

    private function resolveConcepto(int $concepto): string
    {
        return match ($concepto) {
            1 => 'Productos',
            2 => 'Servicios',
            3 => 'Productos y servicios',
            default => (string) $concepto,
        };
    }
}

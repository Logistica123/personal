<?php

namespace App\Services\Facturacion;

use App\Models\FacturaCabecera;
use Illuminate\Support\Facades\Storage;

class FacturaPdfService
{
    public function generate(FacturaCabecera $factura): string
    {
        $factura->loadMissing(['emisor', 'cliente', 'sucursal', 'detallePdf', 'ivaItems', 'tributos']);

        $pages = [
            $this->buildFacturaPageElements($factura, 'ORIGINAL', 1, 3),
            $this->buildFacturaPageElements($factura, 'DUPLICADO', 2, 3),
            $this->buildFacturaPageElements($factura, 'TRIPLICADO', 3, 3),
        ];

        $pdfContent = $this->buildPdf($pages);
        $path = sprintf('facturacion/pdfs/factura-%d.pdf', $factura->id);

        Storage::disk((string) config('services.arca.storage_disk', 'local'))->put($path, $pdfContent);

        return $path;
    }

    /**
     * @param list<list<string>> $pages
     */
    private function buildPdf(array $pages): string
    {
        $pageCount = count($pages);
        if ($pageCount === 0) {
            $pages = [[]];
            $pageCount = 1;
        }

        $objects = [];
        $objects[] = "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj";

        $kids = [];
        for ($i = 0; $i < $pageCount; $i += 1) {
            // Page objects start at 3 0 obj, one per page.
            $kids[] = (3 + $i) . " 0 R";
        }
        $objects[] = "2 0 obj << /Type /Pages /Count {$pageCount} /Kids [" . implode(' ', $kids) . "] >> endobj";

        $pageObjectsStart = 3;
        $fontsStart = $pageObjectsStart + $pageCount;
        $contentStart = $fontsStart + 3;

        for ($i = 0; $i < $pageCount; $i += 1) {
            $contentRef = ($contentStart + $i) . " 0 R";
            $objects[] = sprintf(
                "%d 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 %d 0 R /F2 %d 0 R /F3 %d 0 R >> >> /Contents %s >> endobj",
                $pageObjectsStart + $i,
                $fontsStart,
                $fontsStart + 1,
                $fontsStart + 2,
                $contentRef
            );
        }

        $objects[] = sprintf("%d 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj", $fontsStart);
        $objects[] = sprintf("%d 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj", $fontsStart + 1);
        $objects[] = sprintf("%d 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj", $fontsStart + 2);

        for ($i = 0; $i < $pageCount; $i += 1) {
            $content = implode("\n", $pages[$i]);
            $objects[] = sprintf(
                "%d 0 obj << /Length %d >> stream\n%s\nendstream endobj",
                $contentStart + $i,
                strlen($content),
                $content
            );
        }

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
     * @return list<string>
     */
    private function buildFacturaPageElements(FacturaCabecera $factura, string $copia, int $pageNumber, int $totalPages): array
    {
        $left = 50.0;
        $right = 545.0;
        $bottom = 60.0;
        $top = 820.0;
        $width = $right - $left;

        $comprobante = $this->resolveComprobanteLabel((int) $factura->cbte_tipo);
        $letra = $this->resolveComprobanteLetra((int) $factura->cbte_tipo);
        $numero = sprintf('%04d-%08d', (int) $factura->pto_vta, (int) ($factura->cbte_numero ?? 0));
        $periodo = sprintf(
            '%d/%02d %s',
            (int) $factura->anio_facturado,
            (int) $factura->mes_facturado,
            (string) ($factura->periodo_facturado?->value ?? $factura->periodo_facturado)
        );

        $razonSocial = (string) (config('services.arca.emisor_razon_social', '') ?: ($factura->emisor?->razon_social ?? ''));
        $cuitEmisor = (string) (config('services.arca.cuit_emisor_default', '') ?: ($factura->emisor?->cuit ?? ''));
        $condicionIva = (string) (config('services.arca.emisor_condicion_iva', '') ?: ($factura->emisor?->condicion_iva ?? ''));
        $domicilioFiscal = (string) config('services.arca.emisor_domicilio', '');

        $detalleTotals = $this->computeDetalleTotals($factura);
        $ivaBreakdown = $this->computeIvaBreakdown($factura, $detalleTotals);

        $netoGravado = (float) $factura->imp_neto;
        if ($netoGravado <= 0.0 && (float) ($detalleTotals['neto'] ?? 0) > 0.0) {
            $netoGravado = (float) $detalleTotals['neto'];
        }

        $noGravado = (float) $factura->imp_tot_conc;
        $exento = (float) $factura->imp_op_ex;

        $ivaTotal = (float) $factura->imp_iva;
        if ($ivaTotal <= 0.0 && (float) ($detalleTotals['iva'] ?? 0) > 0.0) {
            $ivaTotal = (float) $detalleTotals['iva'];
        }

        $otrosTributos = (float) $factura->imp_trib;
        $total = (float) $factura->imp_total;
        if ($total <= 0.0 && (float) ($detalleTotals['total'] ?? 0) > 0.0) {
            $total = (float) $detalleTotals['total'] + $noGravado + $exento + $otrosTributos;
        }

        $elements = [];

        // Outer border.
        $this->addRect($elements, $left, $bottom, $width, $top - $bottom);

        // Copy label.
        $this->addText($elements, $left + ($width / 2) - 30, $top - 10, 'F2', 12, $copia);

        // Header block like ARCA: left info, middle letter box, right info.
        $headerTop = $top - 20;
        $headerBottom = 705;
        $this->addLine($elements, $left, $headerBottom, $right, $headerBottom);

        $midBoxLeft = 260;
        $midBoxRight = 315;
        $this->addLine($elements, $midBoxLeft, $headerBottom, $midBoxLeft, $headerTop);
        $this->addLine($elements, $midBoxRight, $headerBottom, $midBoxRight, $headerTop);
        $this->addRect($elements, $midBoxLeft, $headerBottom, $midBoxRight - $midBoxLeft, $headerTop - $headerBottom);

        // Emisor (left column).
        $y = $headerTop - 16;
        $this->addText($elements, $left + 6, $y, 'F2', 10, $this->truncate($razonSocial, 26));
        $y -= 12;
        $this->addText($elements, $left + 6, $y, 'F1', 9, sprintf('Razon social: %s', $this->truncate($razonSocial, 34)));
        $y -= 11;
        if ($domicilioFiscal !== '') {
            $this->addText($elements, $left + 6, $y, 'F1', 9, sprintf('Domicilio: %s', $this->truncate($domicilioFiscal, 40)));
            $y -= 11;
        }
        $this->addText($elements, $left + 6, $y, 'F1', 9, sprintf('Condicion IVA: %s', $this->truncate($condicionIva, 34)));
        $y -= 11;

        // Letter box.
        $letter = $letra !== '' ? $letra : $this->truncate($comprobante, 1);
        $this->addText($elements, $midBoxLeft + 18, $headerTop - 45, 'F2', 30, $letter);
        $this->addText($elements, $midBoxLeft + 12, $headerBottom + 10, 'F2', 7, 'COD. 01');

        // Comprobante info (right column).
        $ry = $headerTop - 22;
        $this->addText($elements, $midBoxRight + 10, $ry, 'F2', 14, 'FACTURA');
        $ry -= 14;
        $this->addText($elements, $midBoxRight + 10, $ry, 'F1', 9, sprintf('Punto de Venta: %04d', (int) $factura->pto_vta));
        $ry -= 11;
        $this->addText($elements, $midBoxRight + 10, $ry, 'F1', 9, sprintf('Comp. Nro: %s', $this->truncate($numero, 20)));
        $ry -= 11;
        $this->addText($elements, $midBoxRight + 10, $ry, 'F1', 9, sprintf('Fecha emision: %s', $this->formatDate($factura->fecha_cbte)));
        $ry -= 11;
        $this->addText($elements, $midBoxRight + 10, $ry, 'F1', 9, sprintf('CUIT: %s', $cuitEmisor));
        $ry -= 11;

        // Receptor block.
        $receptorTop = $headerBottom;
        // Dejar espacio suficiente para domicilio/sucursal/condición de venta sin pisar el encabezado del detalle.
        $receptorBottom = 595;
        $this->addLine($elements, $left, $receptorBottom, $right, $receptorBottom);

        $ry = $receptorTop - 18;
        $this->addText($elements, $left + 6, $ry, 'F2', 10, 'Receptor');
        $ry -= 12;
        $this->addText($elements, $left + 6, $ry, 'F1', 9, sprintf('Cliente: %s', $this->truncate((string) $factura->cliente_nombre, 45)));
        $ry -= 11;
        $this->addText($elements, $left + 6, $ry, 'F1', 9, sprintf('CUIT receptor: %s', (string) $factura->doc_nro));
        $ry -= 11;
        $domicilio = (string) ($factura->cliente_domicilio ?? '');
        if ($domicilio !== '') {
            $this->addText($elements, $left + 6, $ry, 'F1', 9, sprintf('Domicilio: %s', $this->truncate($domicilio, 55)));
            $ry -= 11;
        }
        if ($factura->sucursal) {
            $this->addText($elements, $left + 6, $ry, 'F1', 9, sprintf('Sucursal: %s', $this->truncate((string) ($factura->sucursal->nombre ?? ''), 45)));
            $ry -= 11;
        }
        $this->addText($elements, $left + 6, $ry, 'F1', 9, sprintf('Periodo facturado: %s', $this->truncate($periodo, 40)));
        $ry -= 11;
        $this->addText($elements, $left + 6, $ry, 'F1', 9, sprintf('Fecha vto pago: %s', $this->formatDate($factura->fecha_vto_pago)));
        $ry -= 11;
        $condicionesVenta = $this->formatCondicionesVenta($factura->condiciones_venta ?? []);
        if ($condicionesVenta !== '') {
            $this->addText($elements, $left + 6, $ry, 'F1', 9, sprintf('Condicion de venta: %s', $this->truncate($condicionesVenta, 40)));
            $ry -= 11;
        }

        // Detalle table header with separators.
        $tableHeaderTop = $receptorBottom;
        $tableHeaderBottom = $tableHeaderTop - 18;
        $this->addLine($elements, $left, $tableHeaderBottom, $right, $tableHeaderBottom);

        $this->addText($elements, $left + 4, $tableHeaderTop - 13, 'F2', 8, 'Detalle');

        $colDesc = 315.0;
        $colCant = 365.0;
        $colPrecio = 435.0;
        $colIva = 475.0;
        $this->addRect($elements, $left, $tableHeaderBottom, $width, 18);
        $this->addLine($elements, $colDesc, $tableHeaderBottom, $colDesc, $tableHeaderTop);
        $this->addLine($elements, $colCant, $tableHeaderBottom, $colCant, $tableHeaderTop);
        $this->addLine($elements, $colPrecio, $tableHeaderBottom, $colPrecio, $tableHeaderTop);
        $this->addLine($elements, $colIva, $tableHeaderBottom, $colIva, $tableHeaderTop);

        $ty = $tableHeaderTop - 13;
        $this->addText($elements, $left + 6, $ty, 'F2', 8, 'Producto/Servicio');
        $this->addText($elements, $colDesc + 6, $ty, 'F2', 8, 'Cant');
        $this->addText($elements, $colCant + 6, $ty, 'F2', 8, 'Precio Unit');
        $this->addText($elements, $colPrecio + 6, $ty, 'F2', 8, 'IVA%');
        $this->addText($elements, $colIva + 6, $ty, 'F2', 8, 'Subtotal');

        // Rows.
        $rowY = $tableHeaderBottom - 14;
        $minY = 320;
        foreach ($factura->detallePdf as $index => $item) {
            if ($rowY < $minY) {
                $this->addText($elements, $left + 6, $rowY, 'F1', 9, '... (detalle truncado)');
                $rowY -= 12;
                break;
            }

            $desc = $this->truncate((string) $item->descripcion, 40);
            $this->addText($elements, $left + 6, $rowY, 'F1', 9, $desc);
            $this->addText($elements, $colDesc + 6, $rowY, 'F1', 9, $this->formatNumber($item->cantidad));
            $this->addText($elements, $colCant + 6, $rowY, 'F1', 9, $this->formatMoney($item->precio_unitario));
            $this->addText($elements, $colPrecio + 6, $rowY, 'F1', 9, $this->formatNumber($item->alicuota_iva_pct ?? 0) . '%');
            $this->addText($elements, $colIva + 6, $rowY, 'F1', 9, $this->formatMoney($item->subtotal_con_iva));
            $rowY -= 14;
        }

        // Totals block (boxed) similar to ARCA.
        $totalsBoxY = 120.0;
        $totalsBoxH = 170.0;
        $this->addRect($elements, $left, $totalsBoxY, $width, $totalsBoxH);

        // Left: Otros tributos.
        $lx = $left + 10;
        $ly = $totalsBoxY + $totalsBoxH - 18;
        $this->addText($elements, $lx, $ly, 'F1', 9, sprintf('Importe Otros Tributos: %s', $this->formatMoney($otrosTributos)));
        $ly -= 12;
        if ($factura->tributos->isNotEmpty()) {
            foreach ($factura->tributos as $tributo) {
                if ($ly < $totalsBoxY + 24) {
                    break;
                }
                $this->addText(
                    $elements,
                    $lx,
                    $ly,
                    'F1',
                    9,
                    sprintf('%s %s: %s', (string) $tributo->tributo_id, $this->truncate((string) ($tributo->descr ?? ''), 18), $this->formatMoney($tributo->importe))
                );
                $ly -= 12;
            }
        }

        // Right: Totals breakdown.
        $rx = 330;
        $ry = $totalsBoxY + $totalsBoxH - 18;
        $this->addText($elements, $rx, $ry, 'F2', 9, sprintf('Importe Neto Gravado: %s', $this->formatMoney($netoGravado)));
        $ry -= 12;
        $this->addText($elements, $rx, $ry, 'F1', 9, sprintf('Importe Neto No Gravado: %s', $this->formatMoney($noGravado)));
        $ry -= 12;
        $this->addText($elements, $rx, $ry, 'F1', 9, sprintf('Importe Exento: %s', $this->formatMoney($exento)));
        $ry -= 14;

        // IVA lines (show common rates like ARCA).
        $ivaRates = [27.0, 21.0, 10.5, 5.0, 2.5, 0.0];
        foreach ($ivaRates as $rate) {
            if ($ry < $totalsBoxY + 34) {
                break;
            }
            $importe = $ivaBreakdown[(string) $rate] ?? 0.0;
            $this->addText($elements, $rx, $ry, 'F1', 9, sprintf('IVA %s%%: %s', $this->formatNumber($rate), $this->formatMoney($importe)));
            $ry -= 12;
        }

        $this->addText($elements, $rx, $totalsBoxY + 20, 'F2', 10, sprintf('Importe Total: %s', $this->formatMoney($total)));

        // Footer.
        $this->addText($elements, $left + 6, 90, 'F2', 12, 'ARCA');
        $this->addText($elements, $left + 6, 78, 'F1', 8, 'Comprobante Autorizado');
        $this->addText($elements, $left + 150, 78, 'F1', 8, 'Esta Agencia no se responsabiliza por los datos ingresados en el detalle de la operacion.');

        $this->addText($elements, $left + 250, 40, 'F1', 9, sprintf('Pag. %d/%d', $pageNumber, $totalPages));
        $this->addText($elements, $right - 230, 40, 'F1', 9, sprintf('CAE N: %s', (string) ($factura->cae ?? '')));
        $this->addText($elements, $right - 230, 28, 'F1', 9, sprintf('Fecha de Vto. de CAE: %s', $this->formatDate($factura->cae_vto)));

        return $elements;
    }

    /**
     * @return array{neto:float,iva:float,total:float,no_gravado:float,iva_groups:list<array{rate:float,base:float,iva:float}>}
     */
    private function computeDetalleTotals(FacturaCabecera $factura): array
    {
        $neto = 0.0;
        $total = 0.0;
        $noGravado = 0.0;
        $groups = [];

        foreach ($factura->detallePdf as $item) {
            $base = (float) $item->subtotal;
            $conIva = (float) $item->subtotal_con_iva;
            $alic = (float) ($item->alicuota_iva_pct ?? 0);

            $neto += $base;
            $total += $conIva;

            if ($alic <= 0) {
                $noGravado += $base;
                continue;
            }

            $iva = $conIva - $base;
            $key = (string) round($alic, 2);
            if (! isset($groups[$key])) {
                $groups[$key] = ['rate' => round($alic, 2), 'base' => 0.0, 'iva' => 0.0];
            }
            $groups[$key]['base'] += $base;
            $groups[$key]['iva'] += $iva;
        }

        $ivaGroups = array_values(array_map(
            fn ($row) => [
                'rate' => (float) $row['rate'],
                'base' => round((float) $row['base'], 2),
                'iva' => round((float) $row['iva'], 2),
            ],
            $groups
        ));

        return [
            'neto' => round($neto, 2),
            'iva' => round(max(0.0, $total - $neto), 2),
            'total' => round($total, 2),
            'no_gravado' => round($noGravado, 2),
            'iva_groups' => $ivaGroups,
        ];
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

    /**
     * @param list<string> $elements
     */
    private function addRect(array &$elements, float $x, float $y, float $w, float $h): void
    {
        $elements[] = sprintf("0.7 w %.2f %.2f %.2f %.2f re S", $x, $y, $w, $h);
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

    /**
     * @param array{iva_groups:list<array{rate:float,base:float,iva:float}>,iva:float} $detalleTotals
     * @return array<string,float> key rate string (e.g. "21") => importe
     */
    private function computeIvaBreakdown(FacturaCabecera $factura, array $detalleTotals): array
    {
        $breakdown = [];

        if ($factura->ivaItems->isNotEmpty()) {
            foreach ($factura->ivaItems as $item) {
                $rate = $this->resolveIvaRateById((int) $item->iva_id);
                if ($rate === null) {
                    continue;
                }
                $key = (string) $rate;
                $breakdown[$key] = ($breakdown[$key] ?? 0.0) + (float) $item->importe;
            }
        } elseif (! empty($detalleTotals['iva_groups'])) {
            foreach ($detalleTotals['iva_groups'] as $group) {
                $key = (string) (float) $group['rate'];
                $breakdown[$key] = ($breakdown[$key] ?? 0.0) + (float) $group['iva'];
            }
        }

        foreach ($breakdown as $key => $importe) {
            $breakdown[$key] = round((float) $importe, 2);
        }

        return $breakdown;
    }

    private function resolveIvaRateById(int $ivaId): ?float
    {
        return match ($ivaId) {
            6 => 27.0,
            5 => 21.0,
            4 => 10.5,
            3 => 5.0,
            2 => 2.5,
            1 => 0.0,
            default => null,
        };
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

    /**
     * @param array<int,string> $condiciones
     */
    private function formatCondicionesVenta(array $condiciones): string
    {
        if ($condiciones === []) {
            return '';
        }

        $map = [
            'CONTADO' => 'Contado',
            'TARJETA_DEBITO' => 'Tarjeta de Débito',
            'TARJETA_CREDITO' => 'Tarjeta de Crédito',
            'CUENTA_CORRIENTE' => 'Cuenta corriente',
            'CHEQUE' => 'Cheque',
            'TRANSFERENCIA_BANCARIA' => 'Transferencia bancaria',
            'OTRA' => 'Otra',
            'OTROS_MEDIOS_PAGO_ELECTRONICO' => 'Otros medios de pago electrónico',
        ];

        $labels = [];
        foreach ($condiciones as $condicion) {
            $key = strtoupper(trim((string) $condicion));
            $labels[] = $map[$key] ?? $condicion;
        }

        return implode(' / ', array_values(array_unique($labels)));
    }
}

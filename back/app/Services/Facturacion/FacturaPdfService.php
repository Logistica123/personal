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

        $letra = $this->resolveComprobanteLetra((int) $factura->cbte_tipo);
        $comprobante = $this->resolveComprobanteLabel((int) $factura->cbte_tipo);

        $razonSocial = (string) (config('services.arca.emisor_razon_social', '') ?: ($factura->emisor?->razon_social ?? ''));
        $cuitEmisor = (string) (config('services.arca.cuit_emisor_default', '') ?: ($factura->emisor?->cuit ?? ''));
        $condicionIvaEmisor = (string) (config('services.arca.emisor_condicion_iva', '') ?: ($factura->emisor?->condicion_iva ?? ''));
        $domicilioFiscal = (string) config('services.arca.emisor_domicilio', '');
        $ingresosBrutos = (string) (config('services.arca.emisor_ingresos_brutos', '') ?: $cuitEmisor);
        $fechaInicioActividades = (string) config('services.arca.emisor_fecha_inicio_actividades', '');

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

        // Copy label centered at top.
        $this->addText($elements, $left + ($width / 2) - 30, $top - 10, 'F2', 12, $copia);

        // ─── HEADER BLOCK ────────────────────────────────────────────────────────
        $headerTop = $top - 20;
        $headerBottom = 700.0;
        $this->addLine($elements, $left, $headerBottom, $right, $headerBottom);

        $midBoxLeft = 258.0;
        $midBoxRight = 318.0;
        $this->addLine($elements, $midBoxLeft, $headerBottom, $midBoxLeft, $headerTop);
        $this->addLine($elements, $midBoxRight, $headerBottom, $midBoxRight, $headerTop);
        $this->addRect($elements, $midBoxLeft, $headerBottom, $midBoxRight - $midBoxLeft, $headerTop - $headerBottom);

        // Emisor — left column.
        $y = $headerTop - 14;
        $this->addText($elements, $left + 6, $y, 'F2', 11, $this->truncate($razonSocial, 28));
        $y -= 13;
        $this->addText($elements, $left + 6, $y, 'F1', 8, sprintf('Razon Social: %s', $this->truncate($razonSocial, 38)));
        $y -= 11;
        if ($domicilioFiscal !== '') {
            $this->addText($elements, $left + 6, $y, 'F1', 8, sprintf('Domicilio Comercial: %s', $this->truncate($domicilioFiscal, 34)));
            $y -= 11;
        }
        $this->addText($elements, $left + 6, $y, 'F1', 8, sprintf('Condicion frente al IVA: %s', $this->truncate($condicionIvaEmisor, 28)));

        // Letter box — center.
        $letter = $letra !== '' ? $letra : $this->truncate($comprobante, 1);
        $this->addText($elements, $midBoxLeft + 13, $headerTop - 52, 'F2', 34, $letter);
        $this->addText($elements, $midBoxLeft + 10, $headerBottom + 8, 'F2', 7, 'COD. 01');

        // Comprobante — right column.
        $ry = $headerTop - 14;
        $this->addText($elements, $midBoxRight + 8, $ry, 'F2', 14, 'FACTURA');
        $ry -= 16;
        $this->addText($elements, $midBoxRight + 8, $ry, 'F1', 8, sprintf(
            'Punto de Venta: %05d   Comp. Nro: %08d',
            (int) $factura->pto_vta,
            (int) ($factura->cbte_numero ?? 0)
        ));
        $ry -= 11;
        $this->addText($elements, $midBoxRight + 8, $ry, 'F1', 8, sprintf('Fecha de Emision: %s', $this->formatDate($factura->fecha_cbte)));
        $ry -= 11;
        $this->addText($elements, $midBoxRight + 8, $ry, 'F1', 8, sprintf('CUIT: %s', $cuitEmisor));
        $ry -= 11;
        if ($ingresosBrutos !== '') {
            $this->addText($elements, $midBoxRight + 8, $ry, 'F1', 8, sprintf('Ingresos Brutos: %s', $ingresosBrutos));
            $ry -= 11;
        }
        if ($fechaInicioActividades !== '') {
            $this->addText($elements, $midBoxRight + 8, $ry, 'F1', 8, sprintf('Fecha de Inicio de Actividades: %s', $fechaInicioActividades));
        }

        // ─── PERIOD ROW ──────────────────────────────────────────────────────────
        $periodRowTop = $headerBottom;
        $periodRowBottom = 680.0;
        $this->addLine($elements, $left, $periodRowBottom, $right, $periodRowBottom);

        $periodoDesde = $factura->fecha_serv_desde ? $this->formatDate($factura->fecha_serv_desde) : '—';
        $periodoHasta = $factura->fecha_serv_hasta ? $this->formatDate($factura->fecha_serv_hasta) : '—';

        $py = $periodRowTop - 12;
        $this->addText($elements, $left + 6, $py, 'F2', 8, sprintf(
            'Periodo Facturado Desde:   %s   Hasta: %s',
            $periodoDesde,
            $periodoHasta
        ));
        $this->addText($elements, 380.0, $py, 'F2', 8, sprintf('Fecha de Vto. para el pago: %s', $this->formatDate($factura->fecha_vto_pago)));

        // ─── CLIENT SECTION ──────────────────────────────────────────────────────
        $clientTop = $periodRowBottom;
        $clientBottom = 615.0;
        $this->addLine($elements, $left, $clientBottom, $right, $clientBottom);

        $clientMid = 297.5;
        $this->addLine($elements, $clientMid, $clientBottom, $clientMid, $clientTop);

        $clientRow1 = $clientTop - 20.0;
        $this->addLine($elements, $left, $clientRow1, $right, $clientRow1);
        $clientRow2 = $clientRow1 - 20.0;
        $this->addLine($elements, $left, $clientRow2, $right, $clientRow2);

        // Row 0: CUIT | Apellido y Nombre / Razon Social.
        $cy = $clientTop - 13;
        $this->addText($elements, $left + 4, $cy, 'F2', 8, 'CUIT:');
        $this->addText($elements, $left + 30, $cy, 'F1', 8, (string) $factura->doc_nro);
        $this->addText($elements, $clientMid + 4, $cy, 'F2', 8, 'Apellido y Nombre / Razon Social:');
        $this->addText($elements, $clientMid + 132, $cy, 'F1', 8, $this->truncate((string) $factura->cliente_nombre, 25));

        // Row 1: Condicion frente al IVA | Domicilio Comercial.
        $cy = $clientRow1 - 13;
        $this->addText($elements, $left + 4, $cy, 'F2', 8, 'Condicion frente al IVA:');
        $clienteCondIva = (string) ($factura->cliente?->condicion_iva ?? 'IVA Responsable Inscripto');
        $this->addText($elements, $left + 88, $cy, 'F1', 8, $this->truncate($clienteCondIva, 22));
        $this->addText($elements, $clientMid + 4, $cy, 'F2', 8, 'Domicilio Comercial:');
        $domicilio = (string) ($factura->cliente_domicilio ?? '');
        $this->addText($elements, $clientMid + 76, $cy, 'F1', 8, $this->truncate($domicilio, 28));

        // Row 2: Condicion de venta | Sucursal.
        $cy = $clientRow2 - 13;
        $condicionesVenta = $this->formatCondicionesVenta($factura->condiciones_venta ?? []);
        $this->addText($elements, $left + 4, $cy, 'F2', 8, 'Condicion de venta:');
        $this->addText($elements, $left + 72, $cy, 'F1', 8, $this->truncate($condicionesVenta, 28));
        if ($factura->sucursal) {
            $this->addText($elements, $clientMid + 4, $cy, 'F2', 8, 'Sucursal:');
            $this->addText($elements, $clientMid + 42, $cy, 'F1', 8, $this->truncate((string) ($factura->sucursal->nombre ?? ''), 28));
        }

        // ─── ITEMS TABLE ─────────────────────────────────────────────────────────
        $tableTop = $clientBottom;
        $tableHeaderBottom = $tableTop - 20.0;
        $this->addLine($elements, $left, $tableHeaderBottom, $right, $tableHeaderBottom);
        $this->addRect($elements, $left, $tableHeaderBottom, $width, 20.0);

        // Column X positions (right edge of each column).
        $colCodigo   = 85.0;   // Codigo:           50–85   (35px)
        $colDesc     = 215.0;  // Producto/Servicio: 85–215 (130px)
        $colCant     = 257.0;  // Cantidad:         215–257 (42px)
        $colUmed     = 305.0;  // U. medida:        257–305 (48px)
        $colPrecio   = 360.0;  // Precio Unit.:     305–360 (55px)
        $colBonif    = 395.0;  // % Bonif:          360–395 (35px)
        $colSubtotal = 445.0;  // Subtotal:         395–445 (50px)
        $colAlicuota = 490.0;  // Alicuota IVA:     445–490 (45px)
        // Subtotal c/IVA:    490–545 (55px)

        foreach ([$colCodigo, $colDesc, $colCant, $colUmed, $colPrecio, $colBonif, $colSubtotal, $colAlicuota] as $colX) {
            $this->addLine($elements, $colX, $tableHeaderBottom, $colX, $tableTop);
        }

        $hy = $tableTop - 13;
        $this->addText($elements, $left + 2,        $hy, 'F2', 7, 'Codigo');
        $this->addText($elements, $colCodigo + 2,   $hy, 'F2', 7, 'Producto / Servicio');
        $this->addText($elements, $colDesc + 2,     $hy, 'F2', 7, 'Cantidad');
        $this->addText($elements, $colCant + 2,     $hy, 'F2', 7, 'U. medida');
        $this->addText($elements, $colUmed + 2,     $hy, 'F2', 7, 'Precio Unit.');
        $this->addText($elements, $colPrecio + 2,   $hy, 'F2', 7, '% Bonif');
        $this->addText($elements, $colBonif + 2,    $hy, 'F2', 7, 'Subtotal');
        $this->addText($elements, $colSubtotal + 2, $hy, 'F2', 7, 'Alicuota IVA');
        $this->addText($elements, $colAlicuota + 2, $hy, 'F2', 7, 'Subtotal c/IVA');

        // Rows.
        $rowY = $tableHeaderBottom - 13.0;
        $minY = 240.0;
        foreach ($factura->detallePdf as $item) {
            if ($rowY < $minY) {
                $this->addText($elements, $left + 6, $rowY, 'F1', 8, '... (detalle truncado)');
                break;
            }
            $bonif = (float) ($item->bonificacion_pct ?? 0);
            $this->addText($elements, $left + 2,        $rowY, 'F1', 8, '');
            $this->addText($elements, $colCodigo + 2,   $rowY, 'F1', 8, $this->truncate((string) $item->descripcion, 34));
            $this->addText($elements, $colDesc + 2,     $rowY, 'F1', 8, $this->formatNumber($item->cantidad));
            $this->addText($elements, $colCant + 2,     $rowY, 'F1', 8, $this->truncate((string) ($item->unidad_medida ?? 'unidades'), 9));
            $this->addText($elements, $colUmed + 2,     $rowY, 'F1', 8, $this->formatMoney($item->precio_unitario));
            $this->addText($elements, $colPrecio + 2,   $rowY, 'F1', 8, $bonif > 0 ? $this->formatNumber($bonif) : '0,00');
            $this->addText($elements, $colBonif + 2,    $rowY, 'F1', 8, $this->formatMoney($item->subtotal));
            $this->addText($elements, $colSubtotal + 2, $rowY, 'F1', 8, $this->formatNumber($item->alicuota_iva_pct ?? 0) . '%');
            $this->addText($elements, $colAlicuota + 2, $rowY, 'F1', 8, $this->formatMoney($item->subtotal_con_iva));
            $rowY -= 14;
        }

        // ─── TOTALS BLOCK ────────────────────────────────────────────────────────
        $totalsBoxY = 105.0;
        $totalsBoxH = 130.0;
        $this->addRect($elements, $left, $totalsBoxY, $width, $totalsBoxH);

        // Left: Otros tributos.
        $lx = $left + 10;
        $ly = $totalsBoxY + $totalsBoxH - 18;
        $this->addText($elements, $lx, $ly, 'F1', 8, sprintf('Importe Otros Tributos: $ %s', $this->formatMoney($otrosTributos)));
        $ly -= 12;
        if ($factura->tributos->isNotEmpty()) {
            foreach ($factura->tributos as $tributo) {
                if ($ly < $totalsBoxY + 8) {
                    break;
                }
                $this->addText(
                    $elements, $lx, $ly, 'F1', 8,
                    sprintf('%s %s: $ %s', (string) $tributo->tributo_id, $this->truncate((string) ($tributo->descr ?? ''), 16), $this->formatMoney($tributo->importe))
                );
                $ly -= 12;
            }
        }

        // Right: Totals breakdown.
        $rx = 330.0;
        $ry = $totalsBoxY + $totalsBoxH - 18;
        $this->addText($elements, $rx, $ry, 'F2', 8, sprintf('Importe Neto Gravado: $ %s', $this->formatMoney($netoGravado)));
        $ry -= 12;

        $ivaRates = [27.0, 21.0, 10.5, 5.0, 2.5, 0.0];
        foreach ($ivaRates as $rate) {
            if ($ry < $totalsBoxY + 28) {
                break;
            }
            $importe = $ivaBreakdown[(string) $rate] ?? 0.0;
            $this->addText($elements, $rx, $ry, 'F1', 8, sprintf('IVA %s%%: $ %s', $this->formatNumber($rate), $this->formatMoney($importe)));
            $ry -= 12;
        }

        if ($ry >= $totalsBoxY + 24) {
            $this->addText($elements, $rx, $ry, 'F1', 8, sprintf('Importe Otros Tributos: $ %s', $this->formatMoney($otrosTributos)));
            $ry -= 12;
        }

        $this->addText($elements, $rx, $totalsBoxY + 14, 'F2', 10, sprintf('Importe Total: $ %s', $this->formatMoney($total)));

        // ─── FOOTER ──────────────────────────────────────────────────────────────
        // QR placeholder.
        $this->addRect($elements, $left + 4, 66, 38, 38);
        $this->addText($elements, $left + 13, 82, 'F1', 6, 'QR');

        // ARCA branding.
        $this->addText($elements, $left + 48, 98, 'F2', 10, 'ARCA');
        $this->addText($elements, $left + 48, 87, 'F1', 7, 'Agencia de recaudacion y control aduanero');
        $this->addText($elements, $left + 48, 77, 'F1', 7, 'Comprobante Autorizado');
        $this->addText($elements, $left + 48, 67, 'F1', 6, 'Esta Agencia no se responsabiliza por los datos ingresados en el detalle de la operacion.');

        // Page / CAE — right side.
        $this->addText($elements, $right - 155, 98, 'F1', 8, sprintf('Pag. %d/%d', $pageNumber, $totalPages));
        $this->addText($elements, $right - 155, 87, 'F2', 8, sprintf('CAE N: %s', (string) ($factura->cae ?? '')));
        $this->addText($elements, $right - 155, 76, 'F1', 8, sprintf('Fecha de Vto. de CAE: %s', $this->formatDate($factura->cae_vto)));

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

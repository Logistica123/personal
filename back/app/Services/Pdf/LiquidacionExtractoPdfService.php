<?php

namespace App\Services\Pdf;

class LiquidacionExtractoPdfService
{
    /**
     * @param array{
     *   company_name: string,
     *   titulo: string,
     *   persona_nombre: string,
     *   dominio: string,
     *   cliente: string,
     *   sucursal?: string|null,
     *   periodo: string,
     *   quincena: string,
     *   rows: list<array{fecha:string,id_viaje:string,categoria:string,km:string,jornada:string,importe:string}>,
     *   totals: array{subtotal:string,gastos_admin:string,ajuste:string,total:string}
     * } $data
     */
    public function generate(array $data): string
    {
        $rows = $data['rows'] ?? [];

        $pages = [];
        $chunks = array_chunk($rows, 26);
        if (empty($chunks)) {
            $chunks = [[]];
        }

        foreach ($chunks as $pageIndex => $pageRows) {
            $pages[] = $this->buildPage($data, $pageRows, $pageIndex, count($chunks));
        }

        return $this->buildPdf($pages);
    }

    /**
     * @param array<string, mixed> $data
     * @param list<array{fecha:string,id_viaje:string,categoria:string,km:string,jornada:string,importe:string}> $rows
     * @return list<string>
     */
    private function buildPage(array $data, array $rows, int $pageIndex, int $pageCount): array
    {
        $content = [];

        // Header band
        $content[] = '0.86 0.92 0.98 rg';
        $content[] = '0 790 595 40 re f';
        $content[] = '0 0 0 rg';

        $company = (string) ($data['company_name'] ?? 'Logistica Argentina');
        $this->drawCenteredText($content, 812, $company, 'F2', 14);

        // Title (centered, italic-ish by using Helvetica)
        $titulo = (string) ($data['titulo'] ?? '');
        if ($titulo !== '') {
            $this->drawCenteredText($content, 770, $titulo, 'F1', 11);
        }

        // Meta line (right): page X/Y
        if ($pageCount > 1) {
            $this->drawTextRight($content, 560, 770, sprintf('Página %d/%d', $pageIndex + 1, $pageCount), 'F1', 9);
        }

        // Key-value block
        $y = 742;
        $labelFont = 'F2';
        $valueFont = 'F1';
        $labelSize = 9;
        $valueSize = 9;

        $this->drawKeyValueRow($content, 50, $y, 'Nombre y Apellido:', (string) ($data['persona_nombre'] ?? ''), $labelFont, $labelSize, $valueFont, $valueSize);
        $this->drawKeyValueRow($content, 320, $y, 'Cliente:', (string) ($data['cliente'] ?? ''), $labelFont, $labelSize, $valueFont, $valueSize);
        $y -= 16;

        $this->drawKeyValueRow($content, 50, $y, 'Dominio:', (string) ($data['dominio'] ?? ''), $labelFont, $labelSize, $valueFont, $valueSize);
        $sucursal = (string) ($data['sucursal'] ?? '');
        if ($sucursal !== '') {
            $this->drawKeyValueRow($content, 320, $y, 'Suc:', $sucursal, $labelFont, $labelSize, $valueFont, $valueSize);
        }
        $y -= 16;

        $this->drawKeyValueRow($content, 50, $y, 'Período:', (string) ($data['periodo'] ?? ''), $labelFont, $labelSize, $valueFont, $valueSize);
        $this->drawKeyValueRow($content, 320, $y, 'Quincena:', (string) ($data['quincena'] ?? ''), $labelFont, $labelSize, $valueFont, $valueSize);
        $y -= 18;

        // Divider line
        $content[] = '0 0 0 RG';
        $content[] = sprintf('50 %d m 560 %d l S', $y, $y);
        $y -= 16;

        // Table header background
        $content[] = '0.92 0.92 0.92 rg';
        $content[] = sprintf('50 %.2f 510 18 re f', $y);
        $content[] = '0 0 0 rg';

        // Table headers
        $headerY = $y + 5;
        $this->drawText($content, 55, $headerY, 'Fecha', 'F2', 9);
        $this->drawText($content, 120, $headerY, 'IDVIAJE', 'F2', 9);
        $this->drawText($content, 190, $headerY, 'Categoría', 'F2', 9);
        $this->drawText($content, 340, $headerY, 'KM', 'F2', 9);
        $this->drawTextRight($content, 470, $headerY, '$/Jornada', 'F2', 9);
        $this->drawTextRight($content, 560, $headerY, 'Importe', 'F2', 9);

        $y -= 24;

        // Table rows
        foreach ($rows as $row) {
            $this->drawText($content, 55, $y, (string) ($row['fecha'] ?? ''), 'F3', 9);
            $this->drawText($content, 120, $y, (string) ($row['id_viaje'] ?? ''), 'F3', 9);
            $this->drawText($content, 190, $y, (string) ($row['categoria'] ?? ''), 'F3', 9);
            $this->drawText($content, 340, $y, (string) ($row['km'] ?? ''), 'F3', 9);
            $this->drawTextRight($content, 470, $y, (string) ($row['jornada'] ?? ''), 'F3', 9);
            $this->drawTextRight($content, 560, $y, (string) ($row['importe'] ?? ''), 'F3', 9);
            $y -= 14;
            if ($y < 120) {
                break;
            }
        }

        // Totals block only on last page
        if ($pageIndex === $pageCount - 1) {
            $totals = is_array($data['totals'] ?? null) ? $data['totals'] : [];
            $y = 160;
            $content[] = '0 0 0 RG';
            $content[] = sprintf('240 %d m 560 %d l S', $y + 44, $y + 44);

            $this->drawText($content, 250, $y + 28, 'SubTotal', 'F1', 9);
            $this->drawTextRight($content, 560, $y + 28, (string) ($totals['subtotal'] ?? ''), 'F1', 9);

            $this->drawText($content, 250, $y + 14, 'Gastos Administrativos', 'F1', 9);
            $this->drawTextRight($content, 560, $y + 14, (string) ($totals['gastos_admin'] ?? ''), 'F1', 9);

            $this->drawText($content, 250, $y, 'Ajuste manual', 'F1', 9);
            $this->drawTextRight($content, 560, $y, (string) ($totals['ajuste'] ?? ''), 'F1', 9);

            $this->drawText($content, 250, $y - 18, 'TOTAL', 'F2', 10);
            $this->drawTextRight($content, 560, $y - 18, (string) ($totals['total'] ?? ''), 'F2', 10);
        }

        return $content;
    }

    /**
     * @param list<string> $content
     */
    private function drawKeyValueRow(array &$content, float $x, float $y, string $label, string $value, string $labelFont, int $labelSize, string $valueFont, int $valueSize): void
    {
        $this->drawText($content, $x, $y, $label, $labelFont, $labelSize);
        $this->drawText($content, $x + 110, $y, $value, $valueFont, $valueSize);
    }

    /**
     * @param list<string> $content
     */
    private function drawCenteredText(array &$content, float $y, string $text, string $font, int $size): void
    {
        $width = $this->estimateTextWidth($text, $font, $size);
        $x = (595 - $width) / 2;
        $this->drawText($content, $x, $y, $text, $font, $size);
    }

    /**
     * @param list<string> $content
     */
    private function drawTextRight(array &$content, float $rightX, float $y, string $text, string $font, int $size): void
    {
        $width = $this->estimateTextWidth($text, $font, $size);
        $this->drawText($content, max(40, $rightX - $width), $y, $text, $font, $size);
    }

    /**
     * @param list<string> $content
     */
    private function drawText(array &$content, float $x, float $y, string $text, string $font, int $size): void
    {
        $text = $this->escapePdfText($text);
        $content[] = 'BT';
        $content[] = sprintf('/%s %d Tf', $font, $size);
        $content[] = sprintf('1 0 0 1 %.2f %.2f Tm', $x, $y);
        $content[] = sprintf('(%s) Tj', $text);
        $content[] = 'ET';
    }

    private function estimateTextWidth(string $text, string $font, int $size): float
    {
        $len = strlen($text);
        $factor = 0.55;
        if ($font === 'F3') {
            // Courier: monospace ~0.6em
            $factor = 0.60;
        } elseif ($font === 'F2') {
            $factor = 0.58;
        }
        return $len * $size * $factor;
    }

    private function escapePdfText(string $value): string
    {
        $value = preg_replace('/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]/', '', $value) ?? $value;
        $value = str_replace('\\', '\\\\', $value);
        $value = str_replace('(', '\\(', $value);
        $value = str_replace(')', '\\)', $value);
        return $value;
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
        $objects[] = '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj';

        $kids = [];
        for ($i = 0; $i < $pageCount; $i += 1) {
            $kids[] = (3 + $i) . ' 0 R';
        }
        $objects[] = '2 0 obj << /Type /Pages /Count ' . $pageCount . ' /Kids [' . implode(' ', $kids) . '] >> endobj';

        $pageObjectsStart = 3;
        $fontsStart = $pageObjectsStart + $pageCount;
        $contentStart = $fontsStart + 3;

        for ($i = 0; $i < $pageCount; $i += 1) {
            $contentRef = ($contentStart + $i) . ' 0 R';
            $objects[] = sprintf(
                '%d 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 %d 0 R /F2 %d 0 R /F3 %d 0 R >> >> /Contents %s >> endobj',
                $pageObjectsStart + $i,
                $fontsStart,
                $fontsStart + 1,
                $fontsStart + 2,
                $contentRef
            );
        }

        $objects[] = sprintf('%d 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj', $fontsStart);
        $objects[] = sprintf('%d 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj', $fontsStart + 1);
        $objects[] = sprintf('%d 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj', $fontsStart + 2);

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
}

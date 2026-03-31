<?php

namespace App\Services\Pdf;

/**
 * Genera el PDF de liquidación individual para un distribuidor.
 *
 * Uso:
 *   $pdf = (new LiqDistribuidorPdfService())->generate($data);
 *   Storage::disk('public')->put($path, $pdf);
 *
 * Estructura de $data:
 *   company_name      string     Ej. "Logística Argentina SRL"
 *   cliente           string     Nombre corto del cliente (ej. "Loginter")
 *   distribuidor_nombre string   Apellido y Nombre
 *   distribuidor_patente string  Dominio / Patente
 *   distribuidor_cuit string     CUIT/CUIL
 *   periodo           string     Ej. "01/03/2026 al 31/03/2026"
 *   fecha_generacion  string     Ej. "31/03/2026"
 *   rows              list<array{fecha,dominio,concepto,valor_cliente,tarifa_dist,diferencia}>
 *   totals            array{subtotal,gastos_admin,total}  (strings ya formateados)
 */
class LiqDistribuidorPdfService
{
    private const ROWS_PER_PAGE = 28;

    public function generate(array $data): string
    {
        $rows   = $data['rows'] ?? [];
        $chunks = array_chunk($rows, self::ROWS_PER_PAGE);
        if (empty($chunks)) {
            $chunks = [[]];
        }

        $pages = [];
        foreach ($chunks as $idx => $pageRows) {
            $pages[] = $this->buildPage($data, $pageRows, $idx, count($chunks));
        }

        return $this->buildPdf($pages);
    }

    // ─── Page builder ─────────────────────────────────────────────────────────

    /** @return list<string> */
    private function buildPage(array $data, array $rows, int $pageIndex, int $pageCount): array
    {
        $c = [];

        // ── Header band ──────────────────────────────────────────────────────
        $c[] = '0.18 0.32 0.55 rg';   // azul oscuro
        $c[] = '0 800 595 42 re f';
        $c[] = '1 1 1 rg';             // texto blanco

        $company = (string) ($data['company_name'] ?? 'Logística Argentina SRL');
        $this->drawCenteredText($c, 820, $company, 'F2', 13);

        $c[] = '0 0 0 rg';

        // Paginación (arriba derecha)
        if ($pageCount > 1) {
            $c[] = '1 1 1 rg';
            $this->drawTextRight($c, 570, 804, sprintf('Pág. %d/%d', $pageIndex + 1, $pageCount), 'F1', 8);
            $c[] = '0 0 0 rg';
        }

        // ── Título ────────────────────────────────────────────────────────────
        $this->drawCenteredText($c, 778, 'LIQUIDACIÓN A DISTRIBUIDOR', 'F2', 11);

        // ── Bloque de datos ───────────────────────────────────────────────────
        $y    = 754;
        $lF   = 'F2';
        $vF   = 'F1';
        $sz   = 9;

        $this->drawKV($c, 50, $y, 'Distribuidor:', (string) ($data['distribuidor_nombre'] ?? ''), $lF, $vF, $sz);
        $this->drawKV($c, 330, $y, 'Dominio:', (string) ($data['distribuidor_patente'] ?? ''), $lF, $vF, $sz);
        $y -= 15;

        $this->drawKV($c, 50, $y, 'Cliente:', (string) ($data['cliente'] ?? ''), $lF, $vF, $sz);
        $this->drawKV($c, 330, $y, 'CUIT:', (string) ($data['distribuidor_cuit'] ?? ''), $lF, $vF, $sz);
        $y -= 15;

        $this->drawKV($c, 50, $y, 'Período:', (string) ($data['periodo'] ?? ''), $lF, $vF, $sz);
        $this->drawKV($c, 330, $y, 'Generado:', (string) ($data['fecha_generacion'] ?? ''), $lF, $vF, $sz);
        $y -= 12;

        // Separador
        $c[] = '0.4 0.4 0.4 RG';
        $c[] = sprintf('50 %d m 560 %d l S', $y, $y);
        $c[] = '0 0 0 RG';
        $y -= 14;

        // ── Cabecera de tabla ─────────────────────────────────────────────────
        $c[] = '0.88 0.88 0.88 rg';
        $c[] = sprintf('50 %.2f 510 16 re f', $y);
        $c[] = '0 0 0 rg';

        $hY = $y + 4;
        $this->drawText($c, 55,  $hY, 'Fecha',          'F2', 8);
        $this->drawText($c, 115, $hY, 'Dominio',        'F2', 8);
        $this->drawText($c, 175, $hY, 'Concepto',       'F2', 8);
        $this->drawTextRight($c, 390, $hY, 'Val. Cliente', 'F2', 8);
        $this->drawTextRight($c, 480, $hY, 'Tarifa Dist.', 'F2', 8);
        $this->drawTextRight($c, 560, $hY, 'Diferencia',   'F2', 8);
        $y -= 20;

        // ── Filas ─────────────────────────────────────────────────────────────
        foreach ($rows as $i => $row) {
            // Fondo alternado claro
            if ($i % 2 === 0) {
                $c[] = '0.97 0.97 0.97 rg';
                $c[] = sprintf('50 %.2f 510 13 re f', $y - 2);
                $c[] = '0 0 0 rg';
            }

            $this->drawText($c, 55,  $y, (string) ($row['fecha']         ?? ''), 'F3', 8);
            $this->drawText($c, 115, $y, (string) ($row['dominio']       ?? ''), 'F3', 8);
            $this->drawText($c, 175, $y, $this->truncate((string) ($row['concepto'] ?? ''), 28), 'F3', 8);
            $this->drawTextRight($c, 390, $y, (string) ($row['valor_cliente'] ?? ''), 'F3', 8);
            $this->drawTextRight($c, 480, $y, (string) ($row['tarifa_dist']   ?? ''), 'F3', 8);

            // Diferencia: rojo si negativa, verde si positiva
            $difStr = (string) ($row['diferencia'] ?? '');
            $this->drawTextRight($c, 560, $y, $difStr, 'F3', 8);

            $y -= 13;
            if ($y < 140) {
                break;
            }
        }

        // ── Totales (solo última página) ──────────────────────────────────────
        if ($pageIndex === $pageCount - 1) {
            $totals = is_array($data['totals'] ?? null) ? $data['totals'] : [];

            // Línea separadora
            $c[] = '0 0 0 RG';
            $c[] = sprintf('280 %d m 560 %d l S', 130, 130);

            $tY = 115;
            $this->drawText($c, 285, $tY, 'SubTotal',              'F1', 9);
            $this->drawTextRight($c, 560, $tY, (string) ($totals['subtotal']    ?? ''), 'F1', 9);

            $tY -= 14;
            $this->drawText($c, 285, $tY, 'Gastos Administrativos', 'F1', 9);
            $this->drawTextRight($c, 560, $tY, (string) ($totals['gastos_admin'] ?? ''), 'F1', 9);

            // Línea antes del total
            $tY -= 6;
            $c[] = sprintf('280 %d m 560 %d l S', $tY, $tY);
            $tY -= 12;

            $this->drawText($c, 285, $tY, 'TOTAL A PAGAR',          'F2', 10);
            $this->drawTextRight($c, 560, $tY, (string) ($totals['total']        ?? ''), 'F2', 10);
        }

        return $c;
    }

    // ─── Helpers de dibujo ────────────────────────────────────────────────────

    /** @param list<string> $c */
    private function drawKV(array &$c, float $x, float $y, string $label, string $value, string $lF, string $vF, int $sz): void
    {
        $this->drawText($c, $x, $y, $label, $lF, $sz);
        $this->drawText($c, $x + 95, $y, $value, $vF, $sz);
    }

    /** @param list<string> $c */
    private function drawCenteredText(array &$c, float $y, string $text, string $font, int $size): void
    {
        $x = (595 - $this->estimateWidth($text, $font, $size)) / 2;
        $this->drawText($c, $x, $y, $text, $font, $size);
    }

    /** @param list<string> $c */
    private function drawTextRight(array &$c, float $rightX, float $y, string $text, string $font, int $size): void
    {
        $x = max(40, $rightX - $this->estimateWidth($text, $font, $size));
        $this->drawText($c, $x, $y, $text, $font, $size);
    }

    /** @param list<string> $c */
    private function drawText(array &$c, float $x, float $y, string $text, string $font, int $size): void
    {
        $text = $this->escapePdf($text);
        $c[] = 'BT';
        $c[] = sprintf('/%s %d Tf', $font, $size);
        $c[] = sprintf('1 0 0 1 %.2f %.2f Tm', $x, $y);
        $c[] = sprintf('(%s) Tj', $text);
        $c[] = 'ET';
    }

    private function estimateWidth(string $text, string $font, int $size): float
    {
        $factor = $font === 'F3' ? 0.60 : ($font === 'F2' ? 0.58 : 0.55);

        return strlen($text) * $size * $factor;
    }

    private function escapePdf(string $v): string
    {
        $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $v) ?? $v;
        $v = str_replace('\\', '\\\\', $v);
        $v = str_replace('(', '\(', $v);
        $v = str_replace(')', '\)', $v);

        return $v;
    }

    private function truncate(string $text, int $max): string
    {
        return mb_strlen($text) > $max ? mb_substr($text, 0, $max - 1) . '…' : $text;
    }

    // ─── PDF builder ──────────────────────────────────────────────────────────

    /** @param list<list<string>> $pages */
    private function buildPdf(array $pages): string
    {
        $pageCount = count($pages);

        $objects   = [];
        $objects[] = '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj';

        $kids = [];
        for ($i = 0; $i < $pageCount; $i++) {
            $kids[] = (3 + $i) . ' 0 R';
        }
        $objects[] = '2 0 obj << /Type /Pages /Count ' . $pageCount . ' /Kids [' . implode(' ', $kids) . '] >> endobj';

        $pageObjStart = 3;
        $fontsStart   = $pageObjStart + $pageCount;
        $contentStart = $fontsStart + 3;

        for ($i = 0; $i < $pageCount; $i++) {
            $objects[] = sprintf(
                '%d 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 %d 0 R /F2 %d 0 R /F3 %d 0 R >> >> /Contents %d 0 R >> endobj',
                $pageObjStart + $i,
                $fontsStart,
                $fontsStart + 1,
                $fontsStart + 2,
                $contentStart + $i
            );
        }

        $objects[] = sprintf('%d 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',      $fontsStart);
        $objects[] = sprintf('%d 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj', $fontsStart + 1);
        $objects[] = sprintf('%d 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj',        $fontsStart + 2);

        for ($i = 0; $i < $pageCount; $i++) {
            $content   = implode("\n", $pages[$i]);
            $objects[] = sprintf(
                "%d 0 obj << /Length %d >> stream\n%s\nendstream endobj",
                $contentStart + $i,
                strlen($content),
                $content
            );
        }

        $pdf     = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $obj) {
            $offsets[] = strlen($pdf);
            $pdf .= $obj . "\n";
        }

        $xrefOffset = strlen($pdf);
        $count      = count($objects);
        $pdf .= "xref\n0 " . ($count + 1) . "\n";
        $pdf .= "0000000000 65535 f \n";
        foreach ($offsets as $off) {
            $pdf .= sprintf("%010d 00000 n \n", $off);
        }
        $pdf .= "trailer << /Size " . ($count + 1) . " /Root 1 0 R >>\n";
        $pdf .= "startxref\n{$xrefOffset}\n%%EOF";

        return $pdf;
    }
}

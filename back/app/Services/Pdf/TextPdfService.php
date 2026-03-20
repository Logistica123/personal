<?php

namespace App\Services\Pdf;

class TextPdfService
{
    public function fromText(string $text): string
    {
        $rawLines = $this->splitLines($text);
        $title = '';
        $bodyLines = $rawLines;
        if (!empty($rawLines)) {
            $title = (string) array_shift($bodyLines);
        }

        $pages = $this->paginateLines($bodyLines, 54);

        $contentPages = array_map(function (array $pageLines, int $pageIndex) use ($title): array {
            $content = [];
            $content[] = 'BT';
            $content[] = '1 0 0 1 50 805 Tm';

            if ($pageIndex === 0 && $title !== '') {
                $content[] = '/F2 14 Tf';
                $content[] = '18 TL';
                $content[] = '(' . $this->escapePdfText($title) . ') Tj';
                $content[] = 'T*';
                $content[] = 'T*';
            }

            $content[] = '/F1 10 Tf';
            $content[] = '13 TL';
            foreach ($pageLines as $line) {
                $content[] = '(' . $this->escapePdfText($line) . ') Tj';
                $content[] = 'T*';
            }

            $content[] = 'ET';
            return $content;
        }, $pages, array_keys($pages));

        return $this->buildPdf($contentPages);
    }

    /**
     * @return list<string>
     */
    private function splitLines(string $text): array
    {
        $normalized = str_replace(["\r\n", "\r"], "\n", $text);
        $rawLines = explode("\n", $normalized);

        $lines = [];
        foreach ($rawLines as $line) {
            $line = rtrim($line, "\t ");
            if ($line === '') {
                $lines[] = '';
                continue;
            }
            foreach ($this->wrapLine($line, 120) as $wrapped) {
                $lines[] = $wrapped;
            }
        }

        return $lines;
    }

    /**
     * @return list<string>
     */
    private function wrapLine(string $line, int $maxChars): array
    {
        if ($maxChars <= 0) {
            return [$line];
        }

        $length = $this->strLength($line);
        if ($length <= $maxChars) {
            return [$line];
        }

        $words = preg_split('/\s+/', $line) ?: [];
        $current = '';
        $wrapped = [];

        foreach ($words as $word) {
            $candidate = $current === '' ? $word : ($current . ' ' . $word);
            if ($this->strLength($candidate) <= $maxChars) {
                $current = $candidate;
                continue;
            }

            if ($current !== '') {
                $wrapped[] = $current;
                $current = $word;
                continue;
            }

            $start = 0;
            $wordLength = $this->strLength($word);
            while ($start < $wordLength) {
                $wrapped[] = $this->strSlice($word, $start, $maxChars);
                $start += $maxChars;
            }
            $current = '';
        }

        if ($current !== '') {
            $wrapped[] = $current;
        }

        return $wrapped;
    }

    private function strLength(string $value): int
    {
        if (function_exists('mb_strlen')) {
            return (int) mb_strlen($value, 'UTF-8');
        }

        return strlen($value);
    }

    private function strSlice(string $value, int $start, int $length): string
    {
        if (function_exists('mb_substr')) {
            return (string) mb_substr($value, $start, $length, 'UTF-8');
        }

        return substr($value, $start, $length);
    }

    /**
     * @param list<string> $lines
     * @return list<list<string>>
     */
    private function paginateLines(array $lines, int $maxLinesPerPage): array
    {
        if ($maxLinesPerPage <= 0) {
            return [$lines];
        }

        $pages = [];
        $page = [];

        foreach ($lines as $line) {
            $page[] = $line;
            if (count($page) >= $maxLinesPerPage) {
                $pages[] = $page;
                $page = [];
            }
        }

        if (! empty($page) || empty($pages)) {
            $pages[] = $page;
        }

        return $pages;
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
        $contentStart = $fontsStart + 2;

        for ($i = 0; $i < $pageCount; $i += 1) {
            $contentRef = ($contentStart + $i) . ' 0 R';
            $objects[] = sprintf(
                '%d 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 %d 0 R /F2 %d 0 R >> >> /Contents %s >> endobj',
                $pageObjectsStart + $i,
                $fontsStart,
                $fontsStart + 1,
                $contentRef
            );
        }

        $objects[] = sprintf('%d 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj', $fontsStart);
        $objects[] = sprintf('%d 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj', $fontsStart + 1);

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

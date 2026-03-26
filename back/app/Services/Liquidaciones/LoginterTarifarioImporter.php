<?php

namespace App\Services\Liquidaciones;

use DOMDocument;
use DOMElement;
use DOMXPath;
use ZipArchive;

class LoginterTarifarioImporter
{
    private const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    private const NS_OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    private const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

    public function importFromXlsx(string $path, ?string $sheetName = null): array
    {
        if (!is_file($path)) {
            throw new \RuntimeException('Archivo no encontrado: ' . $path);
        }

        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            throw new \RuntimeException('No se pudo abrir el XLSX: ' . $path);
        }

        try {
            $sharedStrings = $this->readSharedStrings($zip);
            [$sheetTarget, $resolvedSheetName] = $this->resolveSheetTarget($zip, $sheetName);
            $rows = $this->readSheetRows($zip, $sheetTarget, $sharedStrings);
            $matrix = $this->buildMatrixFromRows($rows);

            return [
                'source_file' => basename($path),
                'sheet_name' => $resolvedSheetName,
                'imported_at' => date('c'),
                'row_count' => count($rows),
                'sucursal_count' => count($matrix),
                'matrix' => $matrix,
            ];
        } finally {
            $zip->close();
        }
    }

    private function readSharedStrings(ZipArchive $zip): array
    {
        $xml = $zip->getFromName('xl/sharedStrings.xml');
        if (!is_string($xml) || $xml === '') {
            return [];
        }

        $xpath = $this->makeXPath($xml, ['a' => self::NS_MAIN]);
        $nodes = $xpath->query('//a:si');
        if (!$nodes) {
            return [];
        }

        $result = [];
        foreach ($nodes as $si) {
            if (!$si instanceof DOMElement) {
                continue;
            }
            $texts = $xpath->query('.//a:t', $si);
            $value = '';
            if ($texts) {
                foreach ($texts as $t) {
                    $value .= $t->nodeValue ?? '';
                }
            }
            $result[] = $value;
        }

        return $result;
    }

    private function resolveSheetTarget(ZipArchive $zip, ?string $sheetName = null): array
    {
        $workbookXml = $zip->getFromName('xl/workbook.xml');
        $relsXml = $zip->getFromName('xl/_rels/workbook.xml.rels');
        if (!is_string($workbookXml) || $workbookXml === '' || !is_string($relsXml) || $relsXml === '') {
            throw new \RuntimeException('XLSX inválido: falta workbook.xml o workbook.xml.rels.');
        }

        $wbXpath = $this->makeXPath($workbookXml, [
            'a' => self::NS_MAIN,
            'r' => self::NS_OFFICE_REL,
        ]);
        $relsXpath = $this->makeXPath($relsXml, [
            'p' => self::NS_PKG_REL,
        ]);

        $rels = [];
        $relNodes = $relsXpath->query('//p:Relationship');
        if ($relNodes) {
            foreach ($relNodes as $rel) {
                if (!$rel instanceof DOMElement) {
                    continue;
                }
                $id = $rel->getAttribute('Id');
                $target = $rel->getAttribute('Target');
                if ($id !== '' && $target !== '') {
                    $rels[$id] = $target;
                }
            }
        }

        $sheetNodes = $wbXpath->query('//a:sheets/a:sheet');
        if (!$sheetNodes || $sheetNodes->length === 0) {
            throw new \RuntimeException('XLSX inválido: no se encontraron sheets.');
        }

        $pickedRid = null;
        $pickedName = null;

        foreach ($sheetNodes as $sheet) {
            if (!$sheet instanceof DOMElement) {
                continue;
            }
            $name = $sheet->getAttribute('name');
            $rid = $sheet->getAttributeNS(self::NS_OFFICE_REL, 'id');
            if ($rid === '') {
                continue;
            }
            if ($sheetName !== null && trim($sheetName) !== '') {
                if (strcasecmp(trim($name), trim($sheetName)) !== 0) {
                    continue;
                }
            }
            $pickedRid = $rid;
            $pickedName = $name !== '' ? $name : $sheetName;
            break;
        }

        if ($pickedRid === null) {
            $first = $sheetNodes->item(0);
            if (!$first instanceof DOMElement) {
                throw new \RuntimeException('No se pudo resolver la hoja del XLSX.');
            }
            $pickedRid = $first->getAttributeNS(self::NS_OFFICE_REL, 'id');
            $pickedName = $first->getAttribute('name') ?: null;
        }

        $target = $rels[$pickedRid] ?? null;
        if (!is_string($target) || $target === '') {
            throw new \RuntimeException('No se pudo resolver el target de la hoja (rId).');
        }

        return [$target, $pickedName ?? $sheetName ?? ''];
    }

    private function readSheetRows(ZipArchive $zip, string $sheetTarget, array $sharedStrings): array
    {
        $sheetXml = $zip->getFromName('xl/' . ltrim($sheetTarget, '/'));
        if (!is_string($sheetXml) || $sheetXml === '') {
            throw new \RuntimeException('No se pudo leer la hoja: ' . $sheetTarget);
        }

        $xpath = $this->makeXPath($sheetXml, ['a' => self::NS_MAIN]);
        $rowNodes = $xpath->query('//a:sheetData/a:row');
        if (!$rowNodes) {
            return [];
        }

        $rows = [];
        foreach ($rowNodes as $rowNode) {
            if (!$rowNode instanceof DOMElement) {
                continue;
            }
            $rowIndexRaw = $rowNode->getAttribute('r');
            $rowIndex = is_numeric($rowIndexRaw) ? (int) $rowIndexRaw : null;
            $cells = [
                'A' => null,
                'B' => null,
                'C' => null,
                'D' => null,
                'E' => null,
            ];

            foreach ($rowNode->getElementsByTagNameNS(self::NS_MAIN, 'c') as $cellNode) {
                if (!$cellNode instanceof DOMElement) {
                    continue;
                }
                $ref = $cellNode->getAttribute('r');
                if ($ref === '' || !preg_match('/^([A-Z]+)(\\d+)$/', $ref, $m)) {
                    continue;
                }
                $col = strtoupper($m[1]);
                if (!array_key_exists($col, $cells)) {
                    continue;
                }

                $valueNode = null;
                foreach ($cellNode->getElementsByTagNameNS(self::NS_MAIN, 'v') as $v) {
                    $valueNode = $v;
                    break;
                }

                $value = $valueNode ? (string) ($valueNode->nodeValue ?? '') : '';
                $type = $cellNode->getAttribute('t');
                if ($type === 's') {
                    $idx = is_numeric($value) ? (int) $value : null;
                    if ($idx !== null && isset($sharedStrings[$idx])) {
                        $value = $sharedStrings[$idx];
                    }
                }

                $cells[$col] = $this->normalizeCellValue($value);
            }

            if ($this->isRowEmpty($cells)) {
                continue;
            }

            if ($rowIndex === 1 || (is_string($cells['A']) && strcasecmp($cells['A'], 'SUCURSAL') === 0)) {
                continue;
            }

            $rows[] = [
                'row' => $rowIndex,
                'sucursal' => $cells['A'],
                'concepto' => $cells['B'],
                'importe' => $cells['C'],
                'porcentaje' => $cells['D'],
                'importe_la' => $cells['E'],
            ];
        }

        return $rows;
    }

    private function buildMatrixFromRows(array $rows): array
    {
        $matrix = [];
        $currentSucursalLabel = null;

        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $sucursalLabel = is_string($row['sucursal'] ?? null) ? trim($row['sucursal']) : '';
            if ($sucursalLabel !== '') {
                $currentSucursalLabel = $sucursalLabel;
            }

            if (!is_string($currentSucursalLabel) || trim($currentSucursalLabel) === '') {
                continue;
            }

            $conceptoLabel = is_string($row['concepto'] ?? null) ? trim($row['concepto']) : '';
            if ($conceptoLabel === '') {
                continue;
            }

            $importe = $this->parseFloatOrNull($row['importe'] ?? null);
            $porcentaje = $this->parseFloatOrNull($row['porcentaje'] ?? null);
            $importeLa = $this->parseFloatOrNull($row['importe_la'] ?? null);

            $sucursalKey = $this->normalizeKey($currentSucursalLabel);
            $conceptoKey = $this->normalizeKey($conceptoLabel);
            if ($sucursalKey === '' || $conceptoKey === '') {
                continue;
            }

            if (!isset($matrix[$sucursalKey])) {
                $matrix[$sucursalKey] = [
                    'label' => $currentSucursalLabel,
                    'concepts' => [],
                ];
            }

            $factor = null;
            if ($porcentaje !== null) {
                $factor = round((100.0 - (float) $porcentaje) / 100.0, 6);
            }

            $matrix[$sucursalKey]['concepts'][$conceptoKey] = [
                'label' => $conceptoLabel,
                'original' => $importe !== null ? round((float) $importe, 6) : null,
                'percent' => $porcentaje !== null ? round((float) $porcentaje, 6) : null,
                'factor' => $factor,
                'la' => $importeLa !== null ? round((float) $importeLa, 6) : null,
            ];
        }

        return $matrix;
    }

    private function makeXPath(string $xml, array $namespaces): DOMXPath
    {
        $doc = new DOMDocument();
        $doc->preserveWhiteSpace = false;
        $doc->loadXML($xml);

        $xpath = new DOMXPath($doc);
        foreach ($namespaces as $prefix => $uri) {
            $xpath->registerNamespace($prefix, $uri);
        }
        return $xpath;
    }

    private function normalizeCellValue(string $value): ?string
    {
        $trimmed = trim($value);
        return $trimmed === '' ? null : $trimmed;
    }

    private function isRowEmpty(array $cells): bool
    {
        foreach ($cells as $value) {
            if (is_string($value) && trim($value) !== '') {
                return false;
            }
        }
        return true;
    }

    private function normalizeKey(string $value): string
    {
        $normalized = strtolower(trim($value));
        $normalized = strtr($normalized, [
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' => 'u',
            'ü' => 'u',
            'ñ' => 'n',
        ]);
        $normalized = preg_replace('/[^a-z0-9]+/u', ' ', $normalized);
        return trim((string) $normalized);
    }

    private function parseFloatOrNull(mixed $value): ?float
    {
        if ($value === null) {
            return null;
        }

        if (is_float($value) || is_int($value)) {
            return (float) $value;
        }

        $string = trim((string) $value);
        if ($string === '') {
            return null;
        }

        $string = str_replace(' ', '', $string);
        $hasComma = str_contains($string, ',');
        $hasDot = str_contains($string, '.');
        if ($hasComma && $hasDot) {
            $string = str_replace('.', '', $string);
            $string = str_replace(',', '.', $string);
        } elseif ($hasComma) {
            $string = str_replace(',', '.', $string);
        }

        if (!is_numeric($string)) {
            return null;
        }

        return (float) $string;
    }
}

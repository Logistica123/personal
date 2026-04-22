<?php

namespace App\Services\Liq;

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Genera dinámicamente el xlsx plantilla para el importador de tarifas.
 *
 * 4 hojas:
 *   Instrucciones — descripción de columnas, ejemplos, convenciones.
 *   Tarifas — header + 4 filas de ejemplo (1 BASE + 3 OVERRIDES).
 *   Motivos — header + 3 filas de ejemplo.
 *   Materiales — header + 3 filas de ejemplo.
 *
 * Devuelve la ruta al archivo temporal. El caller es responsable de enviar y borrar.
 */
class LiqPlantillaImportBuilder
{
    public function build(string $clienteCodigo = 'OCASA'): string
    {
        $sheet = new Spreadsheet();
        $sheet->removeSheetByIndex(0); // sacar la default

        $this->buildInstrucciones($sheet);
        $this->buildTarifas($sheet);
        $this->buildMotivos($sheet, $clienteCodigo);
        $this->buildMateriales($sheet, $clienteCodigo);

        $sheet->setActiveSheetIndexByName('Tarifas');

        $tmpPath = tempnam(sys_get_temp_dir(), 'plantilla_tarifas_') . '.xlsx';
        (new Xlsx($sheet))->save($tmpPath);
        return $tmpPath;
    }

    private function buildInstrucciones(Spreadsheet $book): void
    {
        $s = $book->createSheet();
        $s->setTitle('Instrucciones');

        $lines = [
            ['PLANTILLA DE IMPORTADOR DE TARIFAS', 'header'],
            ['Logística Argentina SRL — Módulo de Liquidaciones', 'sub'],
            ['', ''],
            ['Hojas de este archivo:', 'h2'],
            ['  • Tarifas — BASE + OVERRIDES (obligatoria)', ''],
            ['  • Motivos — códigos YCC exitosos/no-exitosos por cliente (opcional)', ''],
            ['  • Materiales — mapeo código YCC → material tarifario (opcional)', ''],
            ['', ''],
            ['Reglas clave:', 'h2'],
            ['1. es_tarifa_base = 1 → tarifa BASE (aplica a toda la ruta+capacidad).', ''],
            ['2. es_tarifa_base = 0 → OVERRIDE, requiere distribuidor_nombre O patente_match.', ''],
            ['3. Se permite coexistir BASE + OVERRIDES para la misma ruta+capacidad.', ''],
            ['4. modelo_tarifa: Jornada, Jornada_KM o Productividad.', ''],
            ['5. porcentaje_agencia: 0 a 100 (% que retiene la agencia).', ''],
            ['6. factor_km, factor_prod_distrib, factor_cant_distrib: decimales (ej 0,8147).', ''],
            ['7. Filas duplicadas en el archivo generan error — corregir antes de reintentar.', ''],
            ['', ''],
            ['Flujo recomendado:', 'h2'],
            ['  1) Completar hoja Tarifas (una fila por ruta+cap+distribuidor).', ''],
            ['  2) Si aplica: completar Motivos y/o Materiales.', ''],
            ['  3) Subir el archivo desde "Esquema Tarifario > Importar tarifa".', ''],
            ['  4) Revisar el preview. Si hay errores, corregir y reintentar.', ''],
            ['  5) Confirmar e importar.', ''],
            ['', ''],
            ['Preguntas frecuentes:', 'h2'],
            ['  • ¿Qué pasa si ya existe una tarifa con la misma ruta+cap+distribuidor?', ''],
            ['    → Se ACTUALIZA (no se duplica).', ''],
            ['  • ¿Puedo cargar una BASE y después un OVERRIDE de la misma ruta?', ''],
            ['    → Sí, son registros distintos que conviven.', ''],
            ['  • ¿Qué hago si el preview me marca un warning?', ''],
            ['    → Los warnings no bloquean. Revisalos y confirmá si aceptás la discrepancia.', ''],
            ['', ''],
            ['Soporte: Área Sistemas · Logística Argentina SRL', 'sub'],
        ];

        $rowNum = 1;
        foreach ($lines as [$text, $kind]) {
            $cell = $s->getCell([1, $rowNum]);
            $cell->setValue($text);
            if ($kind === 'header') {
                $s->getStyle([1, $rowNum])->getFont()->setBold(true)->setSize(14);
            } elseif ($kind === 'sub') {
                $s->getStyle([1, $rowNum])->getFont()->setItalic(true)->setSize(10);
            } elseif ($kind === 'h2') {
                $s->getStyle([1, $rowNum])->getFont()->setBold(true)->setSize(11);
            }
            $rowNum++;
        }
        $s->getColumnDimension('A')->setWidth(95);
    }

    private function buildTarifas(Spreadsheet $book): void
    {
        $s = $book->createSheet();
        $s->setTitle('Tarifas');

        $headers = [
            'ruta', 'capacidad_vehiculo', 'modelo_tarifa',
            'precio_original', 'porcentaje_agencia', 'precio_distribuidor',
            'es_tarifa_base', 'distribuidor_nombre', 'patente_match',
            'factor_km_distrib', 'factor_prod_distrib', 'factor_cant_distrib',
            'km_tarifa_la', 'costo_fijo_base',
            'vigencia_desde', 'vigencia_hasta', 'motivo',
        ];
        $this->escribirHeaders($s, $headers);

        $rows = [
            // BASE PSS206
            ['PSS206', 7500, 'Jornada',    212579.64, 15, 180692.69, 1, '', '',                    null,   null, null, null, 'Posadas 7500', '2026-02-01', '', 'BASE Posadas 7500'],
            // OVERRIDE PSS206 Walter
            ['PSS206', 7500, 'Jornada_KM', 212579.64, 19, 172087.60, 0, 'Wahnish Walter Alejandro', 'PAL831', 0.8147, null, null, null, '',               '2026-02-01', '', 'OVERRIDE Walter'],
            // OVERRIDE ROHS07 Benítez
            ['ROHS07', 10000, 'Jornada_KM', 317569.18, 17, 263582.41, 0, 'Benítez Germán', 'OMU364', null, null, null, 726.98, '',      '2026-02-01', '', 'OVERRIDE Benítez'],
            // OVERRIDE RES005 AUCAR (sin patente, solo nombre)
            ['RES005', 2500, 'Jornada',    116403.53,  9, 105929.94, 0, 'AUCAR',                   '',       null, null, null, 436.33, '',      '2026-02-01', '', 'OVERRIDE AUCAR'],
        ];

        $r = 2;
        foreach ($rows as $row) {
            foreach ($row as $c => $val) {
                $s->getCell([$c + 1, $r])->setValue($val);
            }
            $r++;
        }

        $this->autosizeAll($s, count($headers));
    }

    private function buildMotivos(Spreadsheet $book, string $clienteCodigo): void
    {
        $s = $book->createSheet();
        $s->setTitle('Motivos');

        $headers = ['cliente_codigo', 'codigo', 'es_exitoso', 'descripcion'];
        $this->escribirHeaders($s, $headers);

        $rows = [
            [$clienteCodigo, 'Z4', 1, 'Entrega en domicilio'],
            [$clienteCodigo, 'Z1', 1, 'Entrega en oficina'],
            [$clienteCodigo, '5',  0, 'Ausente en domicilio'],
        ];
        $r = 2;
        foreach ($rows as $row) {
            foreach ($row as $c => $val) {
                $s->getCell([$c + 1, $r])->setValue($val);
            }
            $r++;
        }
        $this->autosizeAll($s, count($headers));
    }

    private function buildMateriales(Spreadsheet $book, string $clienteCodigo): void
    {
        $s = $book->createSheet();
        $s->setTitle('Materiales');

        $headers = ['cliente_codigo', 'codigo_ycc', 'material_tarifario', 'descripcion'];
        $this->escribirHeaders($s, $headers);

        $rows = [
            [$clienteCodigo, 'PA', 'Paquetería',   'Paquete estándar'],
            [$clienteCodigo, 'SO', 'Sobre',        'Sobre postal'],
            [$clienteCodigo, 'BI', 'Courier',      'Courier internacional'],
        ];
        $r = 2;
        foreach ($rows as $row) {
            foreach ($row as $c => $val) {
                $s->getCell([$c + 1, $r])->setValue($val);
            }
            $r++;
        }
        $this->autosizeAll($s, count($headers));
    }

    private function escribirHeaders($sheet, array $headers): void
    {
        foreach ($headers as $i => $h) {
            $sheet->getCell([$i + 1, 1])->setValue($h);
        }
        $sheet->getStyle([1, 1, count($headers), 1])
            ->getFont()->setBold(true);
        $sheet->getStyle([1, 1, count($headers), 1])
            ->getFill()->setFillType(Fill::FILL_SOLID)
            ->getStartColor()->setRGB('1E40AF');
        $sheet->getStyle([1, 1, count($headers), 1])
            ->getFont()->getColor()->setRGB('FFFFFF');
        $sheet->getStyle([1, 1, count($headers), 1])
            ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->freezePane('A2');
    }

    private function autosizeAll($sheet, int $cols): void
    {
        for ($i = 1; $i <= $cols; $i++) {
            $col = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($i);
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }
    }
}

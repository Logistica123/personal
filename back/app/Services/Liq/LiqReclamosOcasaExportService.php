<?php

namespace App\Services\Liq;

use App\Models\LiqLiquidacionCliente;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * SPEC v4.3 · Export Excel de reclamos OCASA por sucursal.
 *
 * Genera un .xlsx con:
 *   - Hoja 1 "Resumen": totales por sucursal y por motivo, listo para presentar
 *   - Hoja N: una por sucursal con todos los reclamos (op, fecha, transporte, ruta,
 *     conductor, capacidad, concepto, OCASA pagó, esperado, diferencia, motivo, etc.)
 *
 * Pensado para que Liquidaciones lo envíe directo a OCASA sin tocar manualmente.
 */
class LiqReclamosOcasaExportService
{
    private const COLOR_HEADER_BG = 'FF1E40AF';   // azul LA
    private const COLOR_HEADER_FG = 'FFFFFFFF';
    private const COLOR_SUBHEADER_BG = 'FFE0E7FF';
    private const COLOR_TOTAL_BG = 'FFFEF3C7';

    public function generar(
        LiqLiquidacionCliente $liqCliente,
        ?string $estadoFiltro = null,
        ?string $tipoFiltro = null,
        ?string $categoriaFiltro = null
    ): string {
        $reclamos = $this->cargarReclamos($liqCliente, $estadoFiltro, $tipoFiltro, $categoriaFiltro);

        $spreadsheet = new Spreadsheet();
        $spreadsheet->getProperties()
            ->setTitle("Reclamos OCASA {$liqCliente->periodo_desde?->format('Y-m')}")
            ->setCreator('Logística Argentina SRL');

        // Hoja 1: Resumen
        $this->renderHojaResumen($spreadsheet, $liqCliente, $reclamos);

        // Hojas siguientes: una por sucursal
        $porSucursal = $reclamos->groupBy(fn ($r) => $r->sucursal ?? 'SIN SUCURSAL');
        foreach ($porSucursal as $sucursal => $grupo) {
            $this->renderHojaSucursal($spreadsheet, (string) $sucursal, $grupo);
        }

        $spreadsheet->setActiveSheetIndex(0);

        $writer = new Xlsx($spreadsheet);
        ob_start();
        $writer->save('php://output');
        return (string) ob_get_clean();
    }

    private function cargarReclamos(
        LiqLiquidacionCliente $liqCliente,
        ?string $estadoFiltro,
        ?string $tipoFiltro,
        ?string $categoriaFiltro
    ) {
        $q = DB::table('liq_reclamos_ocasa as r')
            ->join('liq_operaciones as o', 'o.id', '=', 'r.op_id')
            ->leftJoin('liq_tarifas_contrato_cliente as tc', 'tc.id', '=', 'r.tarifa_contrato_id')
            ->leftJoin('personas as p', 'p.id', '=', 'o.distribuidor_id')
            ->where('o.liquidacion_cliente_id', $liqCliente->id)
            ->select([
                'r.id', 'r.op_id', 'r.parada_num',
                'o.dominio as patente',
                'o.sucursal_tarifa as sucursal',
                'o.concepto as ruta',
                'o.distancia_km',
                'o.capacidad_vehiculo_kg',
                'o.modelo_calculo',
                'tc.concepto as concepto_contrato',
                'r.importe_tms', 'r.importe_esperado', 'r.diferencia',
                'r.estado',
                'r.motivo_detectado', 'r.motivo_categoria',
                'r.creado_at', 'r.reclamado_at', 'r.resuelto_at',
                DB::raw("CONCAT(COALESCE(p.apellidos,''),' ',COALESCE(p.nombres,'')) AS distribuidor"),
            ]);

        if ($estadoFiltro && $estadoFiltro !== 'todos') {
            $q->where('r.estado', $estadoFiltro);
        }
        if ($tipoFiltro === 'productividad') {
            $q->where('o.modelo_calculo', 'PRODUCTIVIDAD');
        } elseif ($tipoFiltro === 'jornada') {
            $q->where(function ($w) {
                $w->whereNull('o.modelo_calculo')->orWhere('o.modelo_calculo', '!=', 'PRODUCTIVIDAD');
            });
        }
        if ($categoriaFiltro && $categoriaFiltro !== 'todas') {
            $q->where('r.motivo_categoria', $categoriaFiltro);
        }

        return $q->orderBy('o.sucursal_tarifa')->orderByDesc('r.diferencia')->get();
    }

    private function renderHojaResumen(Spreadsheet $sp, LiqLiquidacionCliente $liq, $reclamos): void
    {
        $sheet = $sp->getActiveSheet();
        $sheet->setTitle('Resumen');

        // Cabecera
        $sheet->setCellValue('A1', 'Reclamos OCASA · ' . ($liq->periodo_desde?->format('F Y') ?? '—'));
        $sheet->mergeCells('A1:F1');
        $sheet->getStyle('A1')->applyFromArray([
            'font'      => ['bold' => true, 'size' => 14, 'color' => ['argb' => self::COLOR_HEADER_FG]],
            'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_HEADER_BG]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(28);

        $sheet->setCellValue('A2', 'Cliente: Logística Argentina SRL → OCASA');
        $sheet->setCellValue('A3', 'Generado: ' . now()->format('d/m/Y H:i'));
        $sheet->setCellValue('A4', "Total reclamos: {$reclamos->count()} · Diferencia neta: " . $this->fmtMoney($reclamos->sum('diferencia')));
        $sheet->getStyle('A2:A4')->getFont()->setSize(10);

        // Tabla 1: Resumen por sucursal
        $row = 6;
        $sheet->setCellValue("A{$row}", 'POR SUCURSAL');
        $sheet->mergeCells("A{$row}:F{$row}");
        $sheet->getStyle("A{$row}")->applyFromArray([
            'font' => ['bold' => true, 'size' => 11],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_SUBHEADER_BG]],
        ]);
        $row++;

        $headers = ['Sucursal', 'Cant. reclamos', 'Importe pagado OCASA', 'Importe esperado', 'Diferencia', '% sobre esperado'];
        foreach ($headers as $i => $h) {
            $col = chr(ord('A') + $i);
            $sheet->setCellValue("{$col}{$row}", $h);
        }
        $sheet->getStyle("A{$row}:F{$row}")->applyFromArray([
            'font' => ['bold' => true, 'color' => ['argb' => self::COLOR_HEADER_FG]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_HEADER_BG]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);
        $row++;

        $porSucursal = $reclamos->groupBy(fn ($r) => $r->sucursal ?? 'SIN SUCURSAL');
        foreach ($porSucursal as $sucursal => $grupo) {
            $pagado = (float) $grupo->sum('importe_tms');
            $esperado = (float) $grupo->sum('importe_esperado');
            $dif = (float) $grupo->sum('diferencia');
            $pct = $esperado > 0 ? $dif / $esperado : 0;

            $sheet->setCellValue("A{$row}", (string) $sucursal);
            $sheet->setCellValue("B{$row}", $grupo->count());
            $sheet->setCellValue("C{$row}", $pagado);
            $sheet->setCellValue("D{$row}", $esperado);
            $sheet->setCellValue("E{$row}", $dif);
            $sheet->setCellValue("F{$row}", $pct);
            $row++;
        }

        // Total fila
        $totalPagado = (float) $reclamos->sum('importe_tms');
        $totalEsperado = (float) $reclamos->sum('importe_esperado');
        $totalDif = (float) $reclamos->sum('diferencia');
        $totalPct = $totalEsperado > 0 ? $totalDif / $totalEsperado : 0;
        $sheet->setCellValue("A{$row}", 'TOTAL');
        $sheet->setCellValue("B{$row}", $reclamos->count());
        $sheet->setCellValue("C{$row}", $totalPagado);
        $sheet->setCellValue("D{$row}", $totalEsperado);
        $sheet->setCellValue("E{$row}", $totalDif);
        $sheet->setCellValue("F{$row}", $totalPct);
        $sheet->getStyle("A{$row}:F{$row}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_TOTAL_BG]],
        ]);
        $rowTotal = $row;

        $sheet->getStyle("C8:E{$rowTotal}")->getNumberFormat()
            ->setFormatCode('"$ "#,##0.00');
        $sheet->getStyle("F8:F{$rowTotal}")->getNumberFormat()->setFormatCode('0.00%');

        // Tabla 2: Resumen por motivo (categoría)
        $row += 2;
        $sheet->setCellValue("A{$row}", 'POR MOTIVO DETECTADO');
        $sheet->mergeCells("A{$row}:F{$row}");
        $sheet->getStyle("A{$row}")->applyFromArray([
            'font' => ['bold' => true, 'size' => 11],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_SUBHEADER_BG]],
        ]);
        $row++;

        $headers2 = ['Motivo', 'Cant.', 'Diferencia total', '% del total'];
        foreach ($headers2 as $i => $h) {
            $col = chr(ord('A') + $i);
            $sheet->setCellValue("{$col}{$row}", $h);
        }
        $sheet->getStyle("A{$row}:D{$row}")->applyFromArray([
            'font' => ['bold' => true, 'color' => ['argb' => self::COLOR_HEADER_FG]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_HEADER_BG]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);
        $row++;

        $porCategoria = $reclamos->groupBy(fn ($r) => $r->motivo_categoria ?? 'otra');
        $rowMotivoStart = $row;
        foreach ($porCategoria->sortByDesc(fn ($g) => $g->sum('diferencia')) as $cat => $grupo) {
            $dif = (float) $grupo->sum('diferencia');
            $pct = $totalDif > 0 ? $dif / $totalDif : 0;
            $sheet->setCellValue("A{$row}", $this->labelCategoria((string) $cat));
            $sheet->setCellValue("B{$row}", $grupo->count());
            $sheet->setCellValue("C{$row}", $dif);
            $sheet->setCellValue("D{$row}", $pct);
            $row++;
        }
        $sheet->getStyle("C{$rowMotivoStart}:C" . ($row - 1))->getNumberFormat()->setFormatCode('"$ "#,##0.00');
        $sheet->getStyle("D{$rowMotivoStart}:D" . ($row - 1))->getNumberFormat()->setFormatCode('0.00%');

        // Anchos de columna
        $sheet->getColumnDimension('A')->setWidth(28);
        $sheet->getColumnDimension('B')->setWidth(14);
        $sheet->getColumnDimension('C')->setWidth(20);
        $sheet->getColumnDimension('D')->setWidth(20);
        $sheet->getColumnDimension('E')->setWidth(18);
        $sheet->getColumnDimension('F')->setWidth(16);
    }

    private function renderHojaSucursal(Spreadsheet $sp, string $sucursal, $grupo): void
    {
        $sheetName = mb_substr(preg_replace('/[\\\\\\/\\?\\*\\[\\]:]/', '', $sucursal), 0, 31);
        $sheet = $sp->createSheet();
        $sheet->setTitle($sheetName ?: 'Sucursal');

        // Cabecera
        $sheet->setCellValue('A1', "Reclamos · {$sucursal}");
        $sheet->mergeCells('A1:N1');
        $sheet->getStyle('A1')->applyFromArray([
            'font'      => ['bold' => true, 'size' => 13, 'color' => ['argb' => self::COLOR_HEADER_FG]],
            'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_HEADER_BG]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(24);

        $sheet->setCellValue('A2', "{$grupo->count()} reclamos · diferencia total: " . $this->fmtMoney($grupo->sum('diferencia')));
        $sheet->getStyle('A2')->getFont()->setSize(10)->setItalic(true);

        // Header tabla
        $headers = [
            'Op',
            'Parada',
            'Patente',
            'Distribuidor',
            'Ruta',
            'Tipo',
            'Concepto',
            'Cap. (kg)',
            'OCASA pagó',
            'Esperado',
            'Diferencia',
            'Motivo',
            'Descripción detallada',
            'Estado',
        ];
        $row = 4;
        foreach ($headers as $i => $h) {
            $col = $this->colLetter($i);
            $sheet->setCellValue("{$col}{$row}", $h);
        }
        $sheet->getStyle("A{$row}:N{$row}")->applyFromArray([
            'font'      => ['bold' => true, 'color' => ['argb' => self::COLOR_HEADER_FG], 'size' => 10],
            'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_HEADER_BG]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
        ]);
        $sheet->getRowDimension($row)->setRowHeight(30);

        // Filas
        $row++;
        $rowDataStart = $row;
        foreach ($grupo as $r) {
            $esProd = $r->modelo_calculo === 'PRODUCTIVIDAD';
            $sheet->setCellValue("A{$row}", $r->op_id);
            $sheet->setCellValue("B{$row}", $r->parada_num);
            $sheet->setCellValue("C{$row}", $r->patente);
            $sheet->setCellValue("D{$row}", trim((string) $r->distribuidor));
            $sheet->setCellValue("E{$row}", $r->ruta);
            $sheet->setCellValue("F{$row}", $esProd ? 'Productividad' : 'Jornada');
            $sheet->setCellValue("G{$row}", $r->concepto_contrato);
            $sheet->setCellValue("H{$row}", $r->capacidad_vehiculo_kg);
            $sheet->setCellValue("I{$row}", (float) $r->importe_tms);
            $sheet->setCellValue("J{$row}", (float) $r->importe_esperado);
            $sheet->setCellValue("K{$row}", (float) $r->diferencia);
            $sheet->setCellValue("L{$row}", $this->labelCategoria((string) ($r->motivo_categoria ?? 'otra')));
            $sheet->setCellValue("M{$row}", (string) ($r->motivo_detectado ?? ''));
            $sheet->setCellValue("N{$row}", $this->labelEstado((string) $r->estado));
            $row++;
        }

        // Total
        if ($row > $rowDataStart) {
            $sheet->setCellValue("A{$row}", 'TOTAL');
            $sheet->mergeCells("A{$row}:H{$row}");
            $sheet->setCellValue("I{$row}", "=SUM(I{$rowDataStart}:I" . ($row - 1) . ")");
            $sheet->setCellValue("J{$row}", "=SUM(J{$rowDataStart}:J" . ($row - 1) . ")");
            $sheet->setCellValue("K{$row}", "=SUM(K{$rowDataStart}:K" . ($row - 1) . ")");
            $sheet->getStyle("A{$row}:N{$row}")->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_TOTAL_BG]],
            ]);
            $sheet->getStyle("A{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        }

        // Formato monetario columnas I, J, K
        $sheet->getStyle("I{$rowDataStart}:K{$row}")->getNumberFormat()->setFormatCode('"$ "#,##0.00');

        // Bordes finos a toda la tabla
        $sheet->getStyle("A4:N{$row}")->applyFromArray([
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFCBD5E1']],
            ],
        ]);

        // Anchos de columna
        $widths = [10, 10, 12, 28, 12, 14, 18, 12, 16, 16, 16, 24, 50, 14];
        foreach ($widths as $i => $w) {
            $sheet->getColumnDimension($this->colLetter($i))->setWidth($w);
        }
    }

    private function colLetter(int $idx): string
    {
        // 0→A, 1→B, ..., 25→Z, 26→AA
        if ($idx < 26) return chr(ord('A') + $idx);
        return chr(ord('A') + intdiv($idx, 26) - 1) . chr(ord('A') + ($idx % 26));
    }

    private function fmtMoney(float $n): string
    {
        return '$ ' . number_format($n, 2, ',', '.');
    }

    private function labelCategoria(string $c): string
    {
        return match ($c) {
            'sin_tarifa_contrato'       => 'Sin tarifa contrato',
            'tarifa_capacidad_inferior' => 'Capacidad inferior',
            'tarifa_desactualizada'     => 'Tarifa anterior (factor sistemático)',
            'concepto_mal_clasificado'  => 'Concepto mal clasificado',
            'motivo_mal_etiquetado'     => 'Motivo mal etiquetado',
            'material_mal_clasificado'  => 'Material mal clasificado',
            'zona_mal_asignada'         => 'Zona mal asignada',
            'multibulto_no_aplicado'    => 'Multibulto no aplicado',
            'bajo_tolerancia'           => 'Bajo tolerancia (<5%)',
            'otra'                      => 'Otra (revisar)',
            default                     => $c,
        };
    }

    private function labelEstado(string $e): string
    {
        return match ($e) {
            'pendiente_reclamo' => 'Pendiente',
            'reclamado'         => 'Reclamado',
            'ajustado'          => 'Ajustado',
            'cerrado'           => 'Cerrado',
            default             => $e,
        };
    }
}

<?php

namespace App\Console\Commands;

use App\Models\LiqCliente;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqOperacion;
use App\Services\Liq\LiqCalculoOcasaService;
use App\Services\Liq\LiqEficienciaService;
use Illuminate\Console\Command;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * SPEC INTEGRAL Fase B — Reporte comparativo post-recálculo.
 *
 * Genera un Excel con una fila por operación mostrando:
 *   - importe_anterior (valor_tarifa_distribuidor actual en BD)
 *   - importe_nuevo (simulado con el motor OCASA v5)
 *   - delta absoluto y %
 *   - tipo de match (override_distribuidor / override_patente / base / sin_match)
 *   - eficiencia_pct (desde las columnas persistidas)
 *   - flags (requiere_override_manual, penalidades_tms)
 *
 * NO persiste nada — es solo lectura + Excel output.
 *
 *   php artisan liq:reporte-comparativo --cliente=OCASA --periodo=2026-03
 *   php artisan liq:reporte-comparativo --cliente=OCASA --periodo=2026-03 --salida=/tmp/rep.xlsx
 */
class ReporteComparativoLiq extends Command
{
    protected $signature = 'liq:reporte-comparativo
                            {--cliente=OCASA}
                            {--periodo= : YYYY-MM}
                            {--salida= : path xlsx destino (default storage/app/reportes/...)}';

    protected $description = 'SPEC Fase B: reporte xlsx comparativo anterior vs nuevo del motor de cálculo.';

    public function handle(LiqCalculoOcasaService $calc, LiqEficienciaService $efi): int
    {
        $cli = (string) $this->option('cliente');
        $per = (string) $this->option('periodo');
        if (!preg_match('/^(\d{4})-(\d{2})$/', $per, $m)) {
            $this->error('--periodo requerido YYYY-MM');
            return 1;
        }
        $from = sprintf('%04d-%02d-01', (int) $m[1], (int) $m[2]);
        $to   = date('Y-m-t', strtotime($from));

        $cliente = LiqCliente::where('nombre_corto', $cli)->orWhere('razon_social', 'like', "%{$cli}%")->first();
        if (!$cliente) { $this->error("Cliente '{$cli}' no existe"); return 1; }

        $esquema = LiqEsquemaTarifario::where('cliente_id', $cliente->id)->where('activo', true)->latest()->first();
        if (!$esquema) { $this->error('Sin esquema tarifario activo'); return 1; }

        $liqIds = LiqLiquidacionCliente::where('cliente_id', $cliente->id)
            ->whereBetween('periodo_desde', [$from, $to])->pluck('id');

        $ops = LiqOperacion::whereIn('liquidacion_cliente_id', $liqIds)
            ->where('excluida', false)
            ->with('distribuidor:id,apellidos,nombres,patente')
            ->get();

        if ($ops->isEmpty()) { $this->warn('Sin operaciones'); return 0; }
        $this->info("Procesando {$ops->count()} ops de {$cliente->nombre_corto} {$per}");

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle("Comparativo {$per}");

        $headers = [
            'Op ID', 'Distribuidor', 'Patente', 'Ruta', 'Capacidad kg',
            'Fracción', 'CostoKm TMS', 'Penalidades TMS',
            'Importe ANTERIOR', 'Importe NUEVO', 'Δ Abs', 'Δ %',
            'Match', 'Línea tarifa',
            'Paradas total', 'Paradas c/motivo', 'Paradas exitosas', 'Eficiencia %',
            'Req. override', 'Warnings',
        ];
        $sheet->fromArray([$headers], null, 'A1');
        $sheet->getStyle('A1:T1')->getFont()->setBold(true);
        $sheet->getStyle('A1:T1')->getFill()->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
            ->getStartColor()->setRGB('1F3864');
        $sheet->getStyle('A1:T1')->getFont()->getColor()->setRGB('FFFFFF');

        $rowNum = 2;
        $totAnterior = 0; $totNuevo = 0; $countSinMatch = 0; $countReqOverride = 0;

        foreach ($ops as $op) {
            $anterior = (float) ($op->valor_tarifa_distribuidor ?? 0);
            $res = $calc->calcularOperacion($op, $esquema);
            $nuevo = $res['importe'];
            $delta = $nuevo !== null ? round($nuevo - $anterior, 2) : null;
            $deltaPct = ($nuevo !== null && $anterior > 0) ? round(100 * $delta / $anterior, 2) : null;
            $match = $res['match_tipo'] ?? 'sin_match';
            if ($match === 'sin_match' || $nuevo === null) $countSinMatch++;
            if (!empty($res['requiere_override_manual'])) $countReqOverride++;

            $distribNombre = $op->distribuidor
                ? trim(($op->distribuidor->apellidos ?? '') . ' ' . ($op->distribuidor->nombres ?? ''))
                : '';

            $sheet->fromArray([[
                $op->id,
                $distribNombre,
                $op->dominio,
                $op->concepto,
                $op->capacidad_vehiculo_kg,
                (float) ($op->fraccion_jornada ?? 1),
                (float) ($op->costo_km ?? 0),
                (float) ($op->penalidades_tms ?? 0),
                $anterior,
                $nuevo,
                $delta,
                $deltaPct,
                $match,
                $res['linea_tarifa_id'] ?? null,
                $op->paradas_ycc_total,
                $op->paradas_con_motivo,
                $op->paradas_exitosas,
                $op->eficiencia_pct !== null ? (float) $op->eficiencia_pct : null,
                !empty($res['requiere_override_manual']) ? 'SI' : '',
                !empty($res['warnings']) ? implode('; ', $res['warnings']) : '',
            ]], null, "A{$rowNum}");

            $totAnterior += $anterior;
            if ($nuevo !== null) $totNuevo += $nuevo;

            // Resaltar filas problemáticas
            if ($match === 'sin_match' || $nuevo === null) {
                $sheet->getStyle("A{$rowNum}:T{$rowNum}")->getFill()
                    ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                    ->getStartColor()->setRGB('FEE2E2');
            } elseif (abs($deltaPct ?? 0) > 30) {
                $sheet->getStyle("A{$rowNum}:T{$rowNum}")->getFill()
                    ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                    ->getStartColor()->setRGB('FEF3C7');
            }
            $rowNum++;
        }

        // Fila totales
        $sheet->setCellValue("A{$rowNum}", 'TOTAL');
        $sheet->setCellValue("I{$rowNum}", $totAnterior);
        $sheet->setCellValue("J{$rowNum}", $totNuevo);
        $sheet->setCellValue("K{$rowNum}", round($totNuevo - $totAnterior, 2));
        $sheet->getStyle("A{$rowNum}:T{$rowNum}")->getFont()->setBold(true);
        $sheet->getStyle("A{$rowNum}:T{$rowNum}")->getFill()
            ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
            ->getStartColor()->setRGB('E0E7FF');

        // Formato números
        $sheet->getStyle("I2:K{$rowNum}")->getNumberFormat()->setFormatCode('#,##0.00');
        $sheet->getStyle("L2:L{$rowNum}")->getNumberFormat()->setFormatCode('0.00');
        $sheet->getStyle("R2:R{$rowNum}")->getNumberFormat()->setFormatCode('0.00');

        foreach (range('A', 'T') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        // Guardar
        $salida = $this->option('salida')
            ?: storage_path("app/reportes/liq_comparativo_{$cli}_{$per}_" . now()->format('Ymd_His') . '.xlsx');
        if (!is_dir(dirname($salida))) mkdir(dirname($salida), 0755, true);

        (new Xlsx($spreadsheet))->save($salida);

        $this->newLine();
        $this->info("✓ Reporte generado: {$salida}");
        $this->line("  Ops: {$ops->count()}  |  Sin match: {$countSinMatch}  |  Req override: {$countReqOverride}");
        $this->line('  Total anterior: $' . number_format($totAnterior, 2, ',', '.'));
        $this->line('  Total nuevo:    $' . number_format($totNuevo, 2, ',', '.'));
        $this->line('  Δ:              $' . number_format($totNuevo - $totAnterior, 2, ',', '.'));

        return 0;
    }
}

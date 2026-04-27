<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqCliente;
use App\Models\LiqTarifaContratoCliente;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * SPEC v4.4 · CRUD Tarifas Contrato Cliente (cliente → LA).
 *
 *   GET    /api/liq/tarifas-contrato-cliente
 *          ?cliente_id=&sucursal=&capacidad=&vigentes=1
 *   POST   /api/liq/tarifas-contrato-cliente
 *   PUT    /api/liq/tarifas-contrato-cliente/{id}
 *   DELETE /api/liq/tarifas-contrato-cliente/{id}     (soft: vigencia_hasta=today)
 *   POST   /api/liq/tarifas-contrato-cliente/import-excel
 *   GET    /api/liq/tarifas-contrato-cliente/export-excel
 *
 * Audit: cada cambio se loggea en liq_historial_auditoria con user + accion + diff.
 */
class LiqTarifaContratoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = LiqTarifaContratoCliente::query()->with('cliente:id,nombre_corto,razon_social');

        if ($cliente = $request->query('cliente_id')) $q->where('cliente_id', (int) $cliente);
        if ($sucursal = $request->query('sucursal')) $q->where('sucursal', $sucursal);
        if ($cap = $request->query('capacidad')) $q->where('capacidad_vehiculo', (int) $cap);
        if ($request->boolean('vigentes')) $q->vigentes();

        $tarifas = $q->orderBy('cliente_id')
            ->orderBy('sucursal')
            ->orderBy('capacidad_vehiculo')
            ->orderBy('concepto')
            ->get();

        // Catálogos para dropdowns en la UI
        $clientes = LiqCliente::query()
            ->where('activo', true)
            ->orderBy('nombre_corto')
            ->get(['id', 'nombre_corto', 'razon_social']);

        return response()->json([
            'data' => [
                'tarifas' => $tarifas,
                'totales' => [
                    'cantidad' => $tarifas->count(),
                    'sucursales' => $tarifas->pluck('sucursal')->unique()->values(),
                ],
                'catalogos' => [
                    'clientes'  => $clientes,
                    'capacidades' => [100, 700, 1500, 2500, 5000, 7500, 10000],
                    'conceptos' => $this->conceptosDisponibles(),
                ],
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validar($request, true);

        // Validación: no duplicar (cliente, sucursal, cap, concepto, vigencia_desde)
        $existe = LiqTarifaContratoCliente::query()
            ->where('cliente_id', $data['cliente_id'])
            ->where('sucursal', $data['sucursal'])
            ->where('capacidad_vehiculo', $data['capacidad_vehiculo'])
            ->where('concepto', $data['concepto'])
            ->where('vigencia_desde', $data['vigencia_desde'])
            ->exists();
        if ($existe) {
            return response()->json([
                'error' => 'Ya existe una tarifa con esa combinación. Use editar o cambiar la fecha de vigencia.',
            ], 422);
        }

        // Si hay tarifa anterior para misma combinación SIN vigencia_hasta, cerrarla
        $previa = LiqTarifaContratoCliente::query()
            ->where('cliente_id', $data['cliente_id'])
            ->where('sucursal', $data['sucursal'])
            ->where('capacidad_vehiculo', $data['capacidad_vehiculo'])
            ->where('concepto', $data['concepto'])
            ->whereNull('vigencia_hasta')
            ->where('vigencia_desde', '<', $data['vigencia_desde'])
            ->first();
        if ($previa) {
            $cierre = (clone $data['vigencia_desde'])->subDay();
            $previa->vigencia_hasta = $cierre;
            $previa->save();
        }

        $tarifa = LiqTarifaContratoCliente::create($data);
        $this->auditar('crear', $tarifa, null, $request);

        return response()->json([
            'data' => $tarifa->fresh('cliente'),
            'message' => 'Tarifa creada',
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $tarifa = LiqTarifaContratoCliente::findOrFail($id);
        $data = $this->validar($request, false);

        $antes = $tarifa->toArray();
        $tarifa->fill($data)->save();
        $this->auditar('editar', $tarifa, $antes, $request);

        return response()->json([
            'data' => $tarifa->fresh('cliente'),
            'message' => 'Tarifa actualizada',
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $tarifa = LiqTarifaContratoCliente::findOrFail($id);
        $antes = $tarifa->toArray();
        $tarifa->vigencia_hasta = now()->toDateString();
        $tarifa->save();
        $this->auditar('desactivar', $tarifa, $antes, $request);

        return response()->json([
            'data' => $tarifa->fresh('cliente'),
            'message' => 'Tarifa dada de baja (vigencia_hasta=today)',
        ]);
    }

    /** POST /import-excel — bulk insert desde XLSX. */
    public function importExcel(Request $request): JsonResponse
    {
        $request->validate([
            'archivo'    => 'required|file|mimes:xlsx,xls',
            'cliente_id' => 'required|integer|exists:liq_clientes,id',
        ]);

        $clienteId = (int) $request->input('cliente_id');
        $path = $request->file('archivo')->getRealPath();

        $reader = IOFactory::createReaderForFile($path);
        $reader->setReadDataOnly(true);
        $sheet = $reader->load($path)->getActiveSheet();
        $rows = $sheet->toArray(null, true, true, false);

        if (empty($rows) || count($rows) < 2) {
            return response()->json(['error' => 'Excel vacío o sin filas de datos'], 422);
        }

        // Headers esperados (case-insensitive, primera fila): sucursal, capacidad, concepto, importe, vigencia_desde, [vigencia_hasta], [notas]
        $headers = array_map(fn ($h) => strtolower(trim((string) $h)), $rows[0]);
        $idx = [
            'sucursal'        => array_search('sucursal', $headers),
            'capacidad'       => array_search('capacidad', $headers) ?: array_search('capacidad_vehiculo', $headers),
            'concepto'        => array_search('concepto', $headers),
            'importe'         => array_search('importe', $headers) ?: array_search('importe_contrato', $headers),
            'vigencia_desde'  => array_search('vigencia_desde', $headers) ?: array_search('vigencia desde', $headers),
            'vigencia_hasta'  => array_search('vigencia_hasta', $headers) ?: array_search('vigencia hasta', $headers),
            'notas'           => array_search('notas', $headers),
        ];

        if ($idx['sucursal'] === false || $idx['capacidad'] === false || $idx['concepto'] === false || $idx['importe'] === false || $idx['vigencia_desde'] === false) {
            return response()->json([
                'error' => 'Faltan columnas requeridas (sucursal, capacidad, concepto, importe, vigencia_desde). Headers detectados: ' . implode(', ', $headers),
            ], 422);
        }

        $stats = ['ok' => 0, 'error' => 0, 'skipped' => 0];
        $errores = [];

        DB::transaction(function () use ($rows, $idx, $clienteId, &$stats, &$errores, $request) {
            for ($i = 1; $i < count($rows); $i++) {
                $row = $rows[$i];
                if (empty(array_filter($row))) continue;

                try {
                    $sucursal = trim((string) $row[$idx['sucursal']]);
                    if ($sucursal === '') { $stats['skipped']++; continue; }

                    $payload = [
                        'cliente_id'         => $clienteId,
                        'sucursal'           => $sucursal,
                        'capacidad_vehiculo' => (int) $row[$idx['capacidad']],
                        'concepto'           => trim((string) $row[$idx['concepto']]),
                        'importe_contrato'   => (float) $this->parseNumber($row[$idx['importe']]),
                        'vigencia_desde'     => $this->parseDate($row[$idx['vigencia_desde']]),
                        'vigencia_hasta'     => $idx['vigencia_hasta'] !== false ? $this->parseDate($row[$idx['vigencia_hasta']]) : null,
                        'notas'              => $idx['notas'] !== false ? trim((string) ($row[$idx['notas']] ?? '')) : null,
                    ];

                    // Upsert: si ya existe combinación + vigencia_desde, actualiza importe; sino crea
                    $existente = LiqTarifaContratoCliente::query()
                        ->where('cliente_id', $payload['cliente_id'])
                        ->where('sucursal', $payload['sucursal'])
                        ->where('capacidad_vehiculo', $payload['capacidad_vehiculo'])
                        ->where('concepto', $payload['concepto'])
                        ->where('vigencia_desde', $payload['vigencia_desde'])
                        ->first();

                    if ($existente) {
                        $antes = $existente->toArray();
                        $existente->fill($payload)->save();
                        $this->auditar('editar', $existente, $antes, $request);
                    } else {
                        $tarifa = LiqTarifaContratoCliente::create($payload);
                        $this->auditar('crear', $tarifa, null, $request);
                    }
                    $stats['ok']++;
                } catch (\Throwable $e) {
                    $stats['error']++;
                    $errores[] = "Fila " . ($i + 1) . ": " . $e->getMessage();
                }
            }
        });

        return response()->json([
            'data' => $stats,
            'errores' => array_slice($errores, 0, 20),
            'message' => "Importadas: {$stats['ok']} · Errores: {$stats['error']} · Saltadas: {$stats['skipped']}",
        ]);
    }

    /** GET /export-excel — descarga XLSX con los filtros aplicados. */
    public function exportExcel(Request $request): StreamedResponse
    {
        $q = LiqTarifaContratoCliente::query()->with('cliente:id,nombre_corto');
        if ($cliente = $request->query('cliente_id')) $q->where('cliente_id', (int) $cliente);
        if ($sucursal = $request->query('sucursal')) $q->where('sucursal', $sucursal);
        if ($cap = $request->query('capacidad')) $q->where('capacidad_vehiculo', (int) $cap);
        if ($request->boolean('vigentes')) $q->vigentes();

        $tarifas = $q->orderBy('cliente_id')->orderBy('sucursal')
            ->orderBy('capacidad_vehiculo')->orderBy('concepto')->get();

        $sp = new Spreadsheet();
        $sheet = $sp->getActiveSheet();
        $sheet->setTitle('Tarifas Contrato');

        $headers = ['Cliente', 'Sucursal', 'Capacidad', 'Concepto', 'Importe', 'Vigencia desde', 'Vigencia hasta', 'Notas'];
        foreach ($headers as $i => $h) {
            $col = chr(ord('A') + $i);
            $sheet->setCellValue("{$col}1", $h);
        }
        $sheet->getStyle('A1:H1')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1E40AF']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        $row = 2;
        foreach ($tarifas as $t) {
            $sheet->setCellValue("A{$row}", $t->cliente?->nombre_corto ?? '');
            $sheet->setCellValue("B{$row}", $t->sucursal);
            $sheet->setCellValue("C{$row}", $t->capacidad_vehiculo);
            $sheet->setCellValue("D{$row}", $t->concepto);
            $sheet->setCellValue("E{$row}", (float) $t->importe_contrato);
            $sheet->setCellValue("F{$row}", $t->vigencia_desde?->format('Y-m-d'));
            $sheet->setCellValue("G{$row}", $t->vigencia_hasta?->format('Y-m-d'));
            $sheet->setCellValue("H{$row}", $t->notas);
            $row++;
        }
        $sheet->getStyle("E2:E" . ($row - 1))->getNumberFormat()->setFormatCode('"$ "#,##0.00');

        foreach (['A' => 16, 'B' => 22, 'C' => 12, 'D' => 22, 'E' => 16, 'F' => 14, 'G' => 14, 'H' => 30] as $c => $w) {
            $sheet->getColumnDimension($c)->setWidth($w);
        }

        $writer = new Xlsx($sp);
        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, 'Tarifas_Contrato_Cliente.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    private function validar(Request $request, bool $crear): array
    {
        $rules = [
            'cliente_id'         => ($crear ? 'required' : 'sometimes') . '|integer|exists:liq_clientes,id',
            'sucursal'           => ($crear ? 'required' : 'sometimes') . '|string|max:60',
            'capacidad_vehiculo' => ($crear ? 'required' : 'sometimes') . '|integer|min:1',
            'concepto'           => ($crear ? 'required' : 'sometimes') . '|string|max:40',
            'importe_contrato'   => ($crear ? 'required' : 'sometimes') . '|numeric|min:0',
            'vigencia_desde'     => ($crear ? 'required' : 'sometimes') . '|date',
            'vigencia_hasta'     => 'nullable|date|after_or_equal:vigencia_desde',
            'notas'              => 'nullable|string|max:500',
        ];
        return $request->validate($rules);
    }

    private function auditar(string $accion, LiqTarifaContratoCliente $tarifa, ?array $antes, Request $request): void
    {
        try {
            $user = $request->user();
            DB::table('liq_historial_auditoria')->insert([
                'entidad_tipo'       => 'liq_tarifas_contrato_cliente',
                'entidad_id'         => (int) $tarifa->id,
                'accion'             => $accion,
                'valores_anteriores' => $antes ? json_encode($antes, JSON_UNESCAPED_UNICODE) : null,
                'valores_nuevos'     => json_encode($tarifa->toArray(), JSON_UNESCAPED_UNICODE),
                'motivo'             => $request->input('motivo'),
                'usuario_id'         => optional($user)->id,
                'usuario_nombre'     => optional($user)->name ?? optional($user)->email,
                'ip_address'         => $request->ip(),
                'created_at'         => now(),
            ]);
        } catch (\Throwable $e) {
            \Log::warning('No se pudo auditar tarifa contrato', ['error' => $e->getMessage()]);
        }
    }

    private function conceptosDisponibles(): array
    {
        return [
            'hasta_120', '121_240', 'mas_240', 'valor_km_240',
            '2da_3ra_vuelta', '2da_vuelta_120', '2da_vuelta_mas_120',
            'jornada_1500', 'km_1500',
            'jornada_2500', 'km_2500',
            'jornada_5000', 'km_5000',
            'jornada_7500', 'km_7500',
            'jornada_10000', 'km_10000',
            'motos',
        ];
    }

    private function parseNumber($v): float
    {
        if ($v === null || $v === '') return 0;
        if (is_numeric($v)) return (float) $v;
        $s = trim((string) $v);
        $s = str_replace(['$', ' '], '', $s);
        // Argentino: 1.234.567,89 → 1234567.89
        if (str_contains($s, ',') && str_contains($s, '.')) {
            $s = str_replace('.', '', $s);
            $s = str_replace(',', '.', $s);
        } elseif (str_contains($s, ',')) {
            $s = str_replace(',', '.', $s);
        }
        return (float) $s;
    }

    private function parseDate($v): ?\Carbon\Carbon
    {
        if ($v === null || $v === '') return null;
        try {
            if (is_numeric($v)) {
                // Excel serial date
                return \Carbon\Carbon::instance(\PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $v));
            }
            return \Carbon\Carbon::parse($v);
        } catch (\Throwable) {
            return null;
        }
    }
}

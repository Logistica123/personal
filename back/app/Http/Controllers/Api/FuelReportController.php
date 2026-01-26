<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Archivo;
use App\Models\Distributor;
use App\Models\FileType;
use App\Models\FuelAdjustment;
use App\Models\FuelMovement;
use App\Models\FuelReport;
use App\Models\FuelReportItem;
use App\Models\Persona;
use App\Models\PersonalNotification;
use App\Services\AuditLogger;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class FuelReportController extends Controller
{
    public function draft(Request $request)
    {
        $validated = $request->validate([
            'distributor_id' => ['nullable', 'integer', 'exists:distributors,id'],
            'date_from' => ['nullable', 'string', 'max:20'],
            'date_to' => ['nullable', 'string', 'max:20'],
            'domain_norm' => ['nullable', 'string', 'max:50'],
        ]);

        return DB::transaction(function () use ($validated, $request) {
            if (empty($validated['distributor_id']) && empty($validated['domain_norm'])) {
                return response()->json(['message' => 'Seleccioná un distribuidor o ingresá un dominio.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            if (empty($validated['distributor_id'])) {
                $normalizedDomain = strtoupper(trim($validated['domain_norm'] ?? ''));
                $normalizedDomain = preg_replace('/[\s\.\-]+/', '', $normalizedDomain);
                if ($normalizedDomain === '') {
                    return response()->json(['message' => 'Ingresá un dominio válido.'], Response::HTTP_UNPROCESSABLE_ENTITY);
                }

                $domainDistributorIds = FuelMovement::query()
                    ->where('domain_norm', $normalizedDomain)
                    ->whereNotNull('distributor_id')
                    ->distinct()
                    ->pluck('distributor_id')
                    ->filter()
                    ->values();

                if ($domainDistributorIds->count() > 1) {
                    $options = Distributor::query()
                        ->whereIn('id', $domainDistributorIds)
                        ->orderBy('name')
                        ->get(['id', 'name', 'code']);

                    return response()->json([
                        'message' => 'El dominio está asociado a más de un distribuidor. Seleccioná uno.',
                        'options' => $options,
                    ], Response::HTTP_CONFLICT);
                }

                $resolvedId = $domainDistributorIds->first();
                if (! $resolvedId) {
                    return response()->json(['message' => 'No hay distribuidor asociado al dominio.'], Response::HTTP_UNPROCESSABLE_ENTITY);
                }

                $validated['distributor_id'] = $resolvedId;
                $validated['domain_norm'] = $normalizedDomain;
            }

            $baseQuery = FuelMovement::query()
                ->where('distributor_id', $validated['distributor_id'])
                ->where('discounted', false)
                ->whereNotIn('status', ['DUPLICATE']);

            if (!empty($validated['domain_norm'])) {
                $normalized = strtoupper(trim($validated['domain_norm']));
                $normalized = preg_replace('/[\s\.\-]+/', '', $normalized);
                $baseQuery->where('domain_norm', $normalized);
            }

            if (!empty($validated['date_from'])) {
                $baseQuery->whereDate('occurred_at', '>=', $validated['date_from']);
            }

            if (!empty($validated['date_to'])) {
                $baseQuery->whereDate('occurred_at', '<=', $validated['date_to']);
            }

            $discountableQuery = (clone $baseQuery)
                ->where(function ($inner) {
                    $inner->whereNull('late_charge')->orWhere('late_charge', false);
                })
                ->whereIn('status', ['IMPUTED']);

            $movements = $discountableQuery->orderBy('occurred_at')->get();
            if ($movements->isEmpty()) {
                return response()->json(['message' => 'No hay movimientos imputados para el rango.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $extras = (clone $baseQuery)
                ->where(function ($inner) {
                    $inner->whereNotIn('status', ['IMPUTED'])
                        ->orWhere(function ($late) {
                            $late->whereNotNull('late_charge')->where('late_charge', true);
                        });
                })
                ->orderBy('occurred_at')
                ->get();

            $report = FuelReport::query()->create([
                'distributor_id' => $validated['distributor_id'],
                'period_from' => $validated['date_from'] ?? null,
                'period_to' => $validated['date_to'] ?? null,
                'status' => 'DRAFT',
                'created_by' => $request->user()?->id,
            ]);

            $itemsPayload = [];
            $totalAmount = 0;
            foreach ($movements as $movement) {
                $itemsPayload[] = [
                    'fuel_report_id' => $report->id,
                    'fuel_movement_id' => $movement->id,
                    'liters' => $movement->liters,
                    'amount' => $movement->amount,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
                $totalAmount += (float) ($movement->amount ?? 0);
            }

            FuelReportItem::query()->insert($itemsPayload);

            $report->update([
                'total_amount' => $totalAmount,
                'adjustments_total' => 0,
                'total_to_bill' => $totalAmount,
            ]);

            AuditLogger::log($request, 'fuel.report.draft', 'fuel_report', $report->id, [
                'distributor_id' => $validated['distributor_id'],
                'domain_norm' => $validated['domain_norm'] ?? null,
                'period_from' => $validated['date_from'] ?? null,
                'period_to' => $validated['date_to'] ?? null,
                'items' => $movements->count(),
                'total_amount' => $totalAmount,
            ]);

            return response()->json($this->serializeReport($report->fresh(), $movements, $extras));
        });
    }

    public function show(FuelReport $report)
    {
        $movements = FuelMovement::query()
            ->whereIn('id', $report->items()->pluck('fuel_movement_id'))
            ->get();

        return response()->json($this->serializeReport($report, $movements));
    }

    public function addAdjustment(Request $request, FuelReport $report)
    {
        $validated = $request->validate([
            'type' => ['required', 'in:credito,debito,ajuste_favor,cuota_combustible,pendiente,adelantos_prestamos'],
            'amount' => ['required', 'numeric'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $adjustment = FuelAdjustment::query()->create([
            'fuel_report_id' => $report->id,
            'type' => $validated['type'],
            'amount' => $validated['amount'],
            'note' => $validated['note'] ?? null,
            'created_by' => $request->user()?->id,
        ]);

        $this->recalculateTotals($report);

        AuditLogger::log($request, 'fuel.report.adjustment.add', 'fuel_report', $report->id, [
            'adjustment_id' => $adjustment->id,
            'type' => $adjustment->type,
            'amount' => $adjustment->amount,
            'note' => $adjustment->note,
        ]);

        return response()->json([
            'data' => $adjustment,
            'report' => $report->fresh(),
        ]);
    }

    public function apply(Request $request, FuelReport $report)
    {
        if ($report->status === 'APPLIED') {
            return response()->json(['message' => 'El informe ya está aplicado.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ((float) $report->total_to_bill <= 0) {
            return response()->json(['message' => 'El total a facturar debe ser mayor a cero.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $validated = $request->validate([
            'liquidacion_id' => ['nullable', 'integer'],
        ]);

        return DB::transaction(function () use ($report, $validated, $request) {
            $previousStatus = $report->status;
            $movementIds = $report->items()->pluck('fuel_movement_id');

            FuelMovement::query()
                ->whereIn('id', $movementIds)
                ->update([
                    'discounted' => true,
                    'status' => 'DISCOUNTED',
                    'fuel_report_id' => $report->id,
                ]);

            $liquidacionId = $validated['liquidacion_id'] ?? $report->liquidacion_id;
            $report->update([
                'status' => 'APPLIED',
                'applied_by' => $request->user()?->id,
                'applied_at' => now(),
                'liquidacion_id' => $liquidacionId,
            ]);

            if ($liquidacionId) {
                $this->attachFuelDiscountToLiquidacion($liquidacionId, $report);
            }

            AuditLogger::log($request, 'fuel.report.apply', 'fuel_report', $report->id, [
                'from_status' => $previousStatus,
                'to_status' => 'APPLIED',
                'liquidacion_id' => $liquidacionId,
                'movements' => $movementIds->count(),
                'total_amount' => (float) $report->total_amount,
                'adjustments_total' => (float) $report->adjustments_total,
                'total_to_bill' => (float) $report->total_to_bill,
            ]);

            $this->notifyPersonalReportApplied($report, $movementIds->toArray());

            return response()->json([
                'data' => $report->fresh(),
            ]);
        });
    }

    public function markReady(FuelReport $report)
    {
        if ($report->status === 'APPLIED') {
            return response()->json(['message' => 'El informe ya está aplicado.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $previousStatus = $report->status;
        $report->update([
            'status' => 'READY',
        ]);

        AuditLogger::log(request(), 'fuel.report.ready', 'fuel_report', $report->id, [
            'from_status' => $previousStatus,
            'to_status' => 'READY',
        ]);

        return response()->json([
            'data' => $report->fresh(),
        ]);
    }

    public function saveDraft(FuelReport $report)
    {
        if ($report->status === 'APPLIED') {
            return response()->json(['message' => 'El informe ya está aplicado.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $previousStatus = $report->status;
        $report->update([
            'status' => 'DRAFT',
        ]);

        AuditLogger::log(request(), 'fuel.report.draft.save', 'fuel_report', $report->id, [
            'from_status' => $previousStatus,
            'to_status' => 'DRAFT',
        ]);

        return response()->json([
            'data' => $report->fresh(),
        ]);
    }

    public function closePeriod(Request $request)
    {
        $validated = $request->validate([
            'year' => ['required', 'integer'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'period' => ['required', 'string', 'in:Q1,Q2,MONTH'],
            'distributor_id' => ['nullable', 'integer', 'exists:distributors,id'],
        ]);

        [$dateFrom, $dateTo] = $this->resolvePeriodDates(
            (int) $validated['year'],
            (int) $validated['month'],
            $validated['period']
        );

        if (! $dateFrom || ! $dateTo) {
            return response()->json(['message' => 'Período inválido.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $baseQuery = FuelMovement::query()
            ->where('discounted', false)
            ->where(function ($inner) {
                $inner->whereNull('late_charge')->orWhere('late_charge', false);
            })
            ->whereIn('status', ['IMPUTED'])
            ->whereDate('occurred_at', '>=', $dateFrom)
            ->whereDate('occurred_at', '<=', $dateTo);

        if (! empty($validated['distributor_id'])) {
            $baseQuery->where('distributor_id', $validated['distributor_id']);
        }

        $distributorIds = $baseQuery->clone()
            ->whereNotNull('distributor_id')
            ->distinct()
            ->pluck('distributor_id')
            ->filter()
            ->values();

        $created = [];
        $skipped = [];

        foreach ($distributorIds as $distributorId) {
            $exists = FuelReport::query()
                ->where('distributor_id', $distributorId)
                ->where('period_from', $dateFrom)
                ->where('period_to', $dateTo)
                ->whereIn('status', ['DRAFT', 'READY', 'APPLIED'])
                ->exists();

            if ($exists) {
                $skipped[] = ['distributor_id' => $distributorId, 'reason' => 'Ya existe informe en ese período.'];
                continue;
            }

            $result = $this->createReportForDistributor($distributorId, $dateFrom, $dateTo, $request);
            if ($result) {
                $created[] = $result;
            }
        }

        AuditLogger::log($request, 'fuel.report.close_period', 'fuel_report', null, [
            'period_from' => $dateFrom,
            'period_to' => $dateTo,
            'created' => count($created),
            'skipped' => count($skipped),
        ]);

        return response()->json([
            'period_from' => $dateFrom,
            'period_to' => $dateTo,
            'created' => $created,
            'skipped' => $skipped,
        ]);
    }

    public function globalReports(Request $request)
    {
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        $baseQuery = FuelMovement::query()
            ->whereNotIn('status', ['DUPLICATE']);

        if (is_string($dateFrom) && trim($dateFrom) !== '') {
            $baseQuery->whereDate('occurred_at', '>=', trim($dateFrom));
        }

        if (is_string($dateTo) && trim($dateTo) !== '') {
            $baseQuery->whereDate('occurred_at', '<=', trim($dateTo));
        }

        $byDistributor = $baseQuery->clone()
            ->selectRaw('distributor_id, DATE_FORMAT(occurred_at, \"%Y-%m\") as period, SUM(amount) as total_amount, SUM(liters) as total_liters, COUNT(*) as movements')
            ->whereNotNull('distributor_id')
            ->groupBy('distributor_id', 'period')
            ->orderByDesc('period')
            ->get();

        $distributorNames = Distributor::query()
            ->whereIn('id', $byDistributor->pluck('distributor_id')->unique())
            ->pluck('name', 'id');

        $byDistributor = $byDistributor->map(function ($row) use ($distributorNames) {
            return [
                'distributor_id' => (int) $row->distributor_id,
                'distributor_name' => $distributorNames[$row->distributor_id] ?? null,
                'period' => $row->period,
                'total_amount' => (float) $row->total_amount,
                'total_liters' => (float) $row->total_liters,
                'movements' => (int) $row->movements,
            ];
        });

        $topStations = $baseQuery->clone()
            ->selectRaw('station, SUM(amount) as total_amount, COUNT(*) as movements')
            ->whereNotNull('station')
            ->groupBy('station')
            ->orderByDesc('total_amount')
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'station' => $row->station,
                'total_amount' => (float) $row->total_amount,
                'movements' => (int) $row->movements,
            ]);

        $byProduct = $baseQuery->clone()
            ->selectRaw('product, SUM(amount) as total_amount, SUM(liters) as total_liters, COUNT(*) as movements')
            ->whereNotNull('product')
            ->groupBy('product')
            ->orderByDesc('total_amount')
            ->get()
            ->map(fn ($row) => [
                'product' => $row->product,
                'total_amount' => (float) $row->total_amount,
                'total_liters' => (float) $row->total_liters,
                'movements' => (int) $row->movements,
            ]);

        $pendingMatch = FuelMovement::query()
            ->whereIn('status', ['PENDING_MATCH'])
            ->count();

        $observed = FuelMovement::query()
            ->where('status', 'OBSERVED')
            ->count();

        return response()->json([
            'by_distributor' => $byDistributor,
            'top_stations' => $topStations,
            'by_product' => $byProduct,
            'pending_match' => $pendingMatch,
            'observed' => $observed,
        ]);
    }

    private function recalculateTotals(FuelReport $report): void
    {
        $itemsTotal = (float) $report->items()->sum('amount');
        $adjustments = $report->adjustments()->get();
        $adjustmentsTotal = 0;
        foreach ($adjustments as $adjustment) {
            $value = (float) $adjustment->amount;
            $type = (string) $adjustment->type;
            if (in_array($type, ['debito'], true)) {
                $adjustmentsTotal -= $value;
            } else {
                $adjustmentsTotal += $value;
            }
        }

        $report->update([
            'total_amount' => $itemsTotal,
            'adjustments_total' => $adjustmentsTotal,
            'total_to_bill' => $itemsTotal + $adjustmentsTotal,
        ]);
    }

    private function serializeReport(FuelReport $report, $movements, $extras = null): array
    {
        $extraCollection = $extras ? collect($extras) : collect();

        return [
            'report' => [
                'id' => $report->id,
                'distributor_id' => $report->distributor_id,
                'period_from' => $report->period_from,
                'period_to' => $report->period_to,
                'status' => $report->status,
                'total_amount' => (float) $report->total_amount,
                'adjustments_total' => (float) $report->adjustments_total,
                'total_to_bill' => (float) $report->total_to_bill,
                'liquidacion_id' => $report->liquidacion_id,
            ],
            'items' => $movements->map(fn (FuelMovement $movement) => [
                'id' => $movement->id,
                'occurred_at' => $movement->occurred_at
                    ? $movement->occurred_at->timezone(config('app.timezone', 'America/Argentina/Buenos_Aires'))->toIso8601String()
                    : null,
                'station' => $movement->station,
                'domain_norm' => $movement->domain_norm,
                'product' => $movement->product,
                'liters' => $movement->liters,
                'price_per_liter' => $movement->price_per_liter,
                'amount' => $movement->amount,
                'status' => $movement->status,
            ]),
            'extras' => $extraCollection->map(fn (FuelMovement $movement) => [
                'id' => $movement->id,
                'occurred_at' => $movement->occurred_at
                    ? $movement->occurred_at->timezone(config('app.timezone', 'America/Argentina/Buenos_Aires'))->toIso8601String()
                    : null,
                'station' => $movement->station,
                'domain_norm' => $movement->domain_norm,
                'product' => $movement->product,
                'liters' => $movement->liters,
                'price_per_liter' => $movement->price_per_liter,
                'amount' => $movement->amount,
                'status' => $movement->status,
            ]),
            'adjustments' => $report->adjustments()->get(),
        ];
    }

    private function attachFuelDiscountToLiquidacion(int $liquidacionId, FuelReport $report): void
    {
        $liquidacion = Archivo::query()->find($liquidacionId);
        if (! $liquidacion) {
            return;
        }

        $tipo = FileType::query()->firstOrCreate(
            ['nombre' => 'DESCUENTO_COMBUSTIBLE'],
            ['categoria' => 'liquidaciones']
        );

        $label = sprintf(
            'Descuento combustible (Reporte #%d%s%s)',
            $report->id,
            $report->period_from ? ' ' . $report->period_from : '',
            $report->period_to ? ' - ' . $report->period_to : ''
        );

        $exists = Archivo::query()
            ->where('parent_document_id', $liquidacionId)
            ->where('tipo_archivo_id', $tipo->id)
            ->where('nombre_original', $label)
            ->exists();

        if ($exists) {
            return;
        }

        $directory = $liquidacion->carpeta ?? ('personal/' . ($liquidacion->persona_id ?? ''));
        $fileName = sprintf('descuento-combustible-reporte-%d.txt', $report->id);
        $ruta = rtrim($directory, '/') . '/' . $fileName;

        Archivo::query()->create([
            'persona_id' => $liquidacion->persona_id,
            'parent_document_id' => $liquidacionId,
            'liquidacion_id' => $liquidacionId,
            'tipo_archivo_id' => $tipo->id,
            'carpeta' => $directory,
            'ruta' => $ruta,
            'disk' => $liquidacion->disk ?? 'public',
            'nombre_original' => $label,
            'importe_facturar' => (float) $report->total_to_bill * -1,
            'enviada' => false,
            'recibido' => false,
            'pagado' => false,
        ]);
    }

    private function notifyPersonalReportApplied(FuelReport $report, array $movementIds): void
    {
        if (empty($movementIds)) {
            return;
        }

        $movements = FuelMovement::query()
            ->whereIn('id', $movementIds)
            ->get(['domain_norm']);

        if ($movements->isEmpty()) {
            return;
        }

        $domains = $movements
            ->pluck('domain_norm')
            ->filter()
            ->unique()
            ->values();

        if ($domains->isEmpty()) {
            return;
        }

        $personas = Persona::query()
            ->select('id', 'patente')
            ->whereNotNull('patente')
            ->get();

        if ($personas->isEmpty()) {
            return;
        }

        $personaByDomain = [];
        foreach ($personas as $persona) {
            $normalized = strtoupper(preg_replace('/[\\s\\.\\-]+/', '', (string) $persona->patente));
            if ($normalized !== '') {
                $personaByDomain[$normalized] = $persona;
            }
        }

        foreach ($domains as $domain) {
            $persona = $personaByDomain[$domain] ?? null;
            if (! $persona) {
                continue;
            }

            $message = sprintf(
                'Se aplicó el informe de combustible. Total a facturar: $%s.',
                number_format((float) $report->total_to_bill, 2, ',', '.')
            );

            PersonalNotification::query()->create([
                'persona_id' => $persona->id,
                'type' => 'fuel_report_applied',
                'title' => 'Informe de combustible aplicado',
                'message' => $message,
                'metadata' => [
                    'fuel_report_id' => $report->id,
                    'period_from' => $report->period_from,
                    'period_to' => $report->period_to,
                    'total_to_bill' => (float) $report->total_to_bill,
                    'domain' => $domain,
                ],
            ]);
        }
    }

    private function resolvePeriodDates(int $year, int $month, string $period): array
    {
        if ($year < 2000 || $month < 1 || $month > 12) {
            return [null, null];
        }

        $lastDay = Carbon::create($year, $month, 1)->endOfMonth()->day;
        $startDay = 1;
        $endDay = $lastDay;

        if ($period === 'Q1') {
            $startDay = 1;
            $endDay = 15;
        } elseif ($period === 'Q2') {
            $startDay = 16;
            $endDay = $lastDay;
        }

        $from = Carbon::create($year, $month, $startDay)->toDateString();
        $to = Carbon::create($year, $month, $endDay)->toDateString();

        return [$from, $to];
    }

    private function createReportForDistributor(int $distributorId, string $dateFrom, string $dateTo, Request $request): ?array
    {
        $movements = FuelMovement::query()
            ->where('distributor_id', $distributorId)
            ->where('discounted', false)
            ->where(function ($inner) {
                $inner->whereNull('late_charge')->orWhere('late_charge', false);
            })
            ->whereIn('status', ['IMPUTED'])
            ->whereDate('occurred_at', '>=', $dateFrom)
            ->whereDate('occurred_at', '<=', $dateTo)
            ->orderBy('occurred_at')
            ->get();

        if ($movements->isEmpty()) {
            return null;
        }

        $report = FuelReport::query()->create([
            'distributor_id' => $distributorId,
            'period_from' => $dateFrom,
            'period_to' => $dateTo,
            'status' => 'DRAFT',
            'created_by' => $request->user()?->id,
        ]);

        $itemsPayload = [];
        $totalAmount = 0;
        foreach ($movements as $movement) {
            $itemsPayload[] = [
                'fuel_report_id' => $report->id,
                'fuel_movement_id' => $movement->id,
                'liters' => $movement->liters,
                'amount' => $movement->amount,
                'created_at' => now(),
                'updated_at' => now(),
            ];
            $totalAmount += (float) ($movement->amount ?? 0);
        }

        FuelReportItem::query()->insert($itemsPayload);
        $report->update([
            'total_amount' => $totalAmount,
            'adjustments_total' => 0,
            'total_to_bill' => $totalAmount,
        ]);

        return [
            'report_id' => $report->id,
            'distributor_id' => $distributorId,
            'movements' => $movements->count(),
            'total_amount' => $totalAmount,
        ];
    }

}

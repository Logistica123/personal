<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Archivo;
use App\Models\Distributor;
use App\Models\DistributorDomain;
use App\Models\FileType;
use App\Models\FuelMovement;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
class FuelModuleController extends Controller
{
    public function distributors()
    {
        $rows = Distributor::query()
            ->where('active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return response()->json([
            'data' => $rows,
        ]);
    }

    public function createDistributor(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50'],
        ]);

        $distributor = Distributor::query()->create([
            'name' => $validated['name'],
            'code' => $validated['code'] ?? null,
            'active' => true,
        ]);

        AuditLogger::log($request, 'fuel.distributor.create', 'distributor', $distributor->id, [
            'name' => $distributor->name,
            'code' => $distributor->code,
        ]);

        return response()->json([
            'data' => $distributor,
        ]);
    }

    public function liquidaciones()
    {
        $liquidacionTypeIds = FileType::query()
            ->select('id', 'nombre')
            ->get()
            ->filter(function (FileType $tipo) {
                $nombre = Str::lower($tipo->nombre ?? '');
                return $nombre !== '' && Str::contains($nombre, 'liquid');
            })
            ->pluck('id');

        if ($liquidacionTypeIds->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $rows = Archivo::query()
            ->whereNull('parent_document_id')
            ->whereIn('tipo_archivo_id', $liquidacionTypeIds)
            ->with(['persona:id,nombres,apellidos,legajo'])
            ->orderByDesc('created_at')
            ->limit(100)
            ->get(['id', 'persona_id', 'nombre_original', 'importe_facturar', 'created_at']);

        return response()->json([
            'data' => $rows->map(function (Archivo $archivo) {
                $persona = $archivo->persona;
                $nombre = trim(($persona?->apellidos ?? '') . ' ' . ($persona?->nombres ?? ''));
                return [
                    'id' => $archivo->id,
                    'persona_id' => $archivo->persona_id,
                    'persona_nombre' => $nombre !== '' ? $nombre : null,
                    'persona_legajo' => $persona?->legajo,
                    'nombre_original' => $archivo->nombre_original,
                    'importe_facturar' => $archivo->importe_facturar,
                    'created_at' => optional($archivo->created_at)
                        ? $archivo->created_at->timezone(config('app.timezone', 'America/Argentina/Buenos_Aires'))->toIso8601String()
                        : null,
                ];
            }),
        ]);
    }

    public function pendientes(Request $request)
    {
        $search = $request->query('search');

        $query = FuelMovement::query()
            ->whereIn('status', ['IMPORTED', 'PENDING_MATCH'])
            ->whereNotNull('domain_norm')
            ->where('domain_norm', '!=', '');

        if (is_string($search) && trim($search) !== '') {
            $query->where('domain_norm', 'like', '%' . strtoupper(trim($search)) . '%');
        }

        $rows = $query
            ->selectRaw('domain_norm, count(*) as movements, sum(amount) as amount, min(occurred_at) as first_date, max(occurred_at) as last_date')
            ->groupBy('domain_norm')
            ->orderBy('domain_norm')
            ->limit(200)
            ->get()
            ->map(fn ($row) => [
                'domain_norm' => $row->domain_norm,
                'movements' => (int) $row->movements,
                'amount' => (float) ($row->amount ?? 0),
                'first_date' => $row->first_date,
                'last_date' => $row->last_date,
                'days_pending' => $row->last_date ? \Illuminate\Support\Carbon::parse($row->last_date)->diffInDays(now()) : null,
            ]);

        $totals = [
            'domains' => $rows->count(),
            'movements' => $rows->sum('movements'),
            'amount' => $rows->sum('amount'),
        ];

        return response()->json([
            'data' => $rows,
            'totals' => $totals,
        ]);
    }

    public function pendientesPorDistribuidor(Request $request)
    {
        $search = $request->query('search');

        $query = FuelMovement::query()
            ->where('discounted', false)
            ->where('late_charge', false)
            ->whereIn('status', ['IMPUTED'])
            ->whereNotNull('distributor_id');

        if (is_string($search) && trim($search) !== '') {
            $query->whereHas('distributor', function ($inner) use ($search) {
                $inner->where('name', 'like', '%' . trim($search) . '%');
            });
        }

        $rows = $query
            ->selectRaw('distributor_id, count(*) as movements, sum(amount) as amount, max(occurred_at) as last_date')
            ->groupBy('distributor_id')
            ->with('distributor:id,name,code')
            ->orderByDesc('amount')
            ->limit(200)
            ->get()
            ->map(fn (FuelMovement $movement) => [
                'distributor_id' => $movement->distributor_id,
                'distributor_name' => $movement->distributor?->name,
                'distributor_code' => $movement->distributor?->code,
                'movements' => (int) $movement->movements,
                'amount' => (float) ($movement->amount ?? 0),
                'last_date' => $movement->last_date,
            ]);

        $totals = [
            'distributors' => $rows->count(),
            'movements' => $rows->sum('movements'),
            'amount' => $rows->sum('amount'),
        ];

        return response()->json([
            'data' => $rows,
            'totals' => $totals,
        ]);
    }

    public function vincularPendiente(Request $request)
    {
        $validated = $request->validate([
            'domain_norm' => ['required', 'string', 'max:50'],
            'distributor_id' => ['required', 'integer', 'exists:distributors,id'],
        ]);

        $domainNorm = strtoupper(trim($validated['domain_norm']));
        $domainNorm = preg_replace('/[\s\.\-]+/', '', $domainNorm);

        DistributorDomain::query()->updateOrCreate(
            ['domain_norm' => $domainNorm],
            [
                'distributor_id' => $validated['distributor_id'],
                'domain_raw' => $validated['domain_norm'],
            ]
        );

        $updated = FuelMovement::query()
            ->where('domain_norm', $domainNorm)
            ->whereIn('status', ['IMPORTED', 'PENDING_MATCH'])
            ->update([
                'distributor_id' => $validated['distributor_id'],
                'status' => 'IMPUTED',
            ]);

        AuditLogger::log($request, 'fuel.pending.match', 'fuel_movement', null, [
            'domain_norm' => $domainNorm,
            'distributor_id' => $validated['distributor_id'],
            'updated' => $updated,
        ]);

        return response()->json([
            'updated' => $updated,
        ]);
    }

    public function invalidarPendiente(Request $request)
    {
        $validated = $request->validate([
            'domain_norm' => ['required', 'string', 'max:50'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $domainNorm = strtoupper(trim($validated['domain_norm']));
        $domainNorm = preg_replace('/[\s\.\-]+/', '', $domainNorm);
        $reason = $validated['reason'] ?? 'Patente inválida';

        $updated = FuelMovement::query()
            ->where('domain_norm', $domainNorm)
            ->whereIn('status', ['IMPORTED', 'PENDING_MATCH'])
            ->update([
                'status' => 'OBSERVED',
                'observations' => $reason,
            ]);

        AuditLogger::log($request, 'fuel.pending.invalidate', 'fuel_movement', null, [
            'domain_norm' => $domainNorm,
            'reason' => $reason,
            'updated' => $updated,
        ]);

        return response()->json([
            'updated' => $updated,
        ]);
    }

    public function vincularPendientesMasivo(Request $request)
    {
        $validated = $request->validate([
            'domains' => ['required', 'array', 'min:1'],
            'domains.*' => ['string', 'max:50'],
            'distributor_id' => ['required', 'integer', 'exists:distributors,id'],
        ]);

        $domains = collect($validated['domains'])
            ->map(function ($domain) {
                $normalized = strtoupper(trim((string) $domain));
                return preg_replace('/[\s\.\-]+/', '', $normalized);
            })
            ->filter()
            ->unique()
            ->values();

        foreach ($domains as $domainNorm) {
            DistributorDomain::query()->updateOrCreate(
                ['domain_norm' => $domainNorm],
                [
                    'distributor_id' => $validated['distributor_id'],
                    'domain_raw' => $domainNorm,
                ]
            );
        }

        $updated = FuelMovement::query()
            ->whereIn('domain_norm', $domains)
            ->whereIn('status', ['IMPORTED', 'PENDING_MATCH'])
            ->update([
                'distributor_id' => $validated['distributor_id'],
                'status' => 'IMPUTED',
            ]);

        AuditLogger::log($request, 'fuel.pending.match.bulk', 'fuel_movement', null, [
            'domains' => $domains->values()->all(),
            'distributor_id' => $validated['distributor_id'],
            'updated' => $updated,
        ]);

        return response()->json([
            'updated' => $updated,
            'domains' => $domains,
        ]);
    }

    public function invalidarPendientesMasivo(Request $request)
    {
        $validated = $request->validate([
            'domains' => ['required', 'array', 'min:1'],
            'domains.*' => ['string', 'max:50'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $domains = collect($validated['domains'])
            ->map(function ($domain) {
                $normalized = strtoupper(trim((string) $domain));
                return preg_replace('/[\s\.\-]+/', '', $normalized);
            })
            ->filter()
            ->unique()
            ->values();

        $reason = $validated['reason'] ?? 'Patente inválida';

        $updated = FuelMovement::query()
            ->whereIn('domain_norm', $domains)
            ->whereIn('status', ['IMPORTED', 'PENDING_MATCH'])
            ->update([
                'status' => 'OBSERVED',
                'observations' => $reason,
            ]);

        AuditLogger::log($request, 'fuel.pending.invalidate.bulk', 'fuel_movement', null, [
            'domains' => $domains->values()->all(),
            'reason' => $reason,
            'updated' => $updated,
        ]);

        return response()->json([
            'updated' => $updated,
            'domains' => $domains,
        ]);
    }

    public function consumos(Request $request)
    {
        $domain = $request->query('domain');
        $distributorId = $request->query('distributor_id');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        $onlyImputed = $request->boolean('only_imputed');
        $onlyPending = $request->boolean('only_pending');
        $includeDuplicates = $request->boolean('include_duplicates');
        $status = $request->query('status');
        $sourceFile = $request->query('source_file');

        $baseQuery = FuelMovement::query();
        $normalizedStatus = is_string($status) ? strtoupper(trim($status)) : '';
        if (! $includeDuplicates && $normalizedStatus !== 'DUPLICATE') {
            $baseQuery->whereNotIn('status', ['DUPLICATE']);
        }

        if (is_string($distributorId) && trim($distributorId) !== '') {
            $baseQuery->where('distributor_id', (int) $distributorId);
        }

        if (is_string($domain) && trim($domain) !== '') {
            $normalized = strtoupper(trim($domain));
            $normalized = preg_replace('/[\s\.\-]+/', '', $normalized);
            $baseQuery->where('domain_norm', $normalized);
        }

        if (is_string($dateFrom) && trim($dateFrom) !== '') {
            $baseQuery->whereDate('occurred_at', '>=', trim($dateFrom));
        }

        if (is_string($dateTo) && trim($dateTo) !== '') {
            $baseQuery->whereDate('occurred_at', '<=', trim($dateTo));
        }

        if ($normalizedStatus !== '') {
            $baseQuery->where('status', $normalizedStatus);
        }

        if (is_string($sourceFile) && trim($sourceFile) !== '') {
            $baseQuery->where('source_file', trim($sourceFile));
        }

        if ($onlyPending) {
            $baseQuery->where('discounted', false);
        }

        if ($onlyImputed) {
            $baseQuery->whereIn('status', ['IMPUTED']);
        }

        $statusCounts = (clone $baseQuery)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $discountCounts = [
            'taken' => (int) (clone $baseQuery)->where('discounted', true)->count(),
            'not_taken' => (int) (clone $baseQuery)->where('discounted', false)->count(),
        ];

        $rows = (clone $baseQuery)
            ->orderByDesc('occurred_at')
            ->limit(500)
            ->get()
            ->map(fn (FuelMovement $movement) => [
            'id' => $movement->id,
            'occurred_at' => $movement->occurred_at
                ? $movement->occurred_at->timezone(config('app.timezone', 'America/Argentina/Buenos_Aires'))->toIso8601String()
                : null,
            'station' => $movement->station,
            'domain_norm' => $movement->domain_norm,
            'product' => $movement->product,
            'liters' => $movement->liters,
            'amount' => $movement->amount,
            'price_per_liter' => $movement->price_per_liter,
            'status' => $movement->status,
            'discounted' => (bool) $movement->discounted,
            'observations' => $movement->observations,
            'source_file' => $movement->source_file,
            'source_row' => $movement->source_row,
        ]);

        $totals = [
            'movements' => $rows->count(),
            'liters' => $rows->sum('liters'),
            'amount' => $rows->sum('amount'),
            'discount_counts' => $discountCounts,
            'status_counts' => $statusCounts,
        ];

        return response()->json([
            'data' => $rows,
            'totals' => $totals,
        ]);
    }

    public function tardias(Request $request)
    {
        $search = $request->query('search');

        $query = FuelMovement::query()
            ->where('late_charge', true)
            ->orderByDesc('occurred_at');

        if (is_string($search) && trim($search) !== '') {
            $normalized = strtoupper(trim($search));
            $normalized = preg_replace('/[\s\.\-]+/', '', $normalized);
            $query->where('domain_norm', 'like', '%' . $normalized . '%');
        }

        $rows = $query->limit(300)->get()->map(fn (FuelMovement $movement) => [
            'id' => $movement->id,
            'occurred_at' => $movement->occurred_at
                ? $movement->occurred_at->timezone(config('app.timezone', 'America/Argentina/Buenos_Aires'))->toIso8601String()
                : null,
            'station' => $movement->station,
            'domain_norm' => $movement->domain_norm,
            'product' => $movement->product,
            'liters' => $movement->liters,
            'amount' => $movement->amount,
            'price_per_liter' => $movement->price_per_liter,
            'late_report_id' => $movement->late_report_id,
            'manual_adjustment_required' => (bool) $movement->manual_adjustment_required,
            'manual_adjustment_amount' => $movement->manual_adjustment_amount,
            'manual_adjustment_note' => $movement->manual_adjustment_note,
            'observations' => $movement->observations,
        ]);

        $totals = [
            'movements' => $rows->count(),
            'liters' => $rows->sum('liters'),
            'amount' => $rows->sum('amount'),
        ];

        return response()->json([
            'data' => $rows,
            'totals' => $totals,
        ]);
    }

    public function requiereAjuste(Request $request, FuelMovement $movement)
    {
        $validated = $request->validate([
            'amount' => ['nullable', 'numeric'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $note = $validated['note'] ?? '';
        $note = is_string($note) ? trim($note) : '';
        $message = $note !== '' ? $note : 'Requiere ajuste manual';

        $movement->update([
            'manual_adjustment_required' => true,
            'manual_adjustment_amount' => $validated['amount'] ?? null,
            'manual_adjustment_note' => $note !== '' ? $note : null,
            'status' => 'OBSERVED',
            'observations' => trim($message),
        ]);

        AuditLogger::log($request, 'fuel.late.manual_adjustment', 'fuel_movement', $movement->id, [
            'domain_norm' => $movement->domain_norm,
            'late_report_id' => $movement->late_report_id,
            'note' => $message,
            'amount' => $validated['amount'] ?? null,
        ]);

        return response()->json([
            'data' => [
                'id' => $movement->id,
                'manual_adjustment_required' => true,
                'manual_adjustment_amount' => $movement->manual_adjustment_amount,
                'manual_adjustment_note' => $movement->manual_adjustment_note,
                'observations' => $movement->observations,
            ],
        ]);
    }

    public function deleteMovimientos(Request $request)
    {
        $validated = $request->validate([
            'source_file' => ['required', 'string', 'max:255'],
        ]);

        $sourceFile = trim($validated['source_file']);
        $deleted = FuelMovement::query()
            ->where('source_file', $sourceFile)
            ->delete();

        AuditLogger::log($request, 'fuel.movements.delete', 'fuel_movement', null, [
            'source_file' => $sourceFile,
            'deleted' => $deleted,
        ]);

        return response()->json([
            'deleted' => $deleted,
        ]);
    }
}

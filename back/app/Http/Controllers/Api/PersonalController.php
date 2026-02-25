<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Persona;
use App\Models\Cliente;
use App\Models\Unidad;
use App\Models\Sucursal;
use App\Models\Estado;
use App\Models\User;
use App\Models\FileType;
use App\Models\Notification;
use App\Models\Dueno;
use App\Models\PersonaComment;
use App\Models\PersonaHistory;
use App\Models\Archivo;
use App\Models\Factura;
use App\Models\FuelMovement;
use App\Models\FuelReport;
use App\Models\PersonalMonthlySummary;
use App\Models\PersonalNotification;
use App\Models\ContactReveal;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PersonalController extends Controller
{
    protected array $personalEditorEmails = [
        'dgimenez@logisticaargentinasrl.com.ar',
        'msanchez@logisticaargentinasrl.com.ar',
        'morellfrancisco@gmail.com',
        'xmaldonado@logisticaargentinasrl.com.ar',
        'monica@logisticaargentinasrl.com.ar',
    ];

    protected function resolveActorEmail(Request $request): ?string
    {
        $candidates = [
            $request->header('X-Actor-Email'),
            $request->input('actorEmail'),
            $request->input('userEmail'),
            $request->input('email'),
            $request->user()?->email,
        ];

        $actorIds = collect([
            $request->input('actorId'),
            $request->input('userId'),
            $request->input('autoApproveUserId'),
        ])
            ->filter()
            ->map(fn ($value) => (int) $value)
            ->unique();

        foreach ($actorIds as $actorId) {
            $user = User::query()->find($actorId);
            if ($user && $user->email) {
                $candidates[] = $user->email;
            }
        }

        foreach ($candidates as $candidate) {
            if (! is_string($candidate)) {
                continue;
            }

            $normalized = strtolower(trim($candidate));
            if ($normalized !== '') {
                return $normalized;
            }
        }

        return AuditLogger::resolveActorEmail($request, $request->user());
    }

    protected function ensureCanManagePersonal(Request $request, ?Persona $persona = null): void
    {
        $actorEmail = $this->resolveActorEmail($request);
        $actorUser = $request->user();

        if (! $actorUser) {
            $actorId = $request->input('actorId')
                ?? $request->input('userId')
                ?? $request->input('autoApproveUserId');

            if ($actorId) {
                $actorUser = User::query()->find((int) $actorId);
            }
        }

        if (! $actorUser && $actorEmail) {
            $actorUser = User::query()->where('email', $actorEmail)->first();
        }

        $role = strtolower(trim((string) ($actorUser?->role ?? '')));
        $permissions = $actorUser?->permissions ?? null;
        $hasPersonalPermission = is_array($permissions)
            && (in_array('personal', $permissions, true) || in_array('proveedores', $permissions, true));
        $roleCanManage = ($role !== '' && Str::contains($role, 'admin'))
            || in_array($role, ['asesor', 'encargado'], true);

        $isAllowed = ($actorEmail && in_array($actorEmail, $this->personalEditorEmails, true))
            || $roleCanManage
            || $hasPersonalPermission;
        $isPendingSolicitud = $persona && (! $persona->aprobado) && ($persona->es_solicitud ?? false);

        if ($isAllowed || $isPendingSolicitud) {
            return;
        }

        abort(response()->json([
            'message' => 'No tenés permisos para gestionar personal.',
        ], 403));
    }

    protected function normalizeDomain(?string $domain): ?string
    {
        if (! is_string($domain)) {
            return null;
        }

        $normalized = strtoupper(trim($domain));
        $normalized = preg_replace('/[\s\.\-]+/', '', $normalized);

        return $normalized !== '' ? $normalized : null;
    }

    protected function resolveDefaultApprovedEstadoId(): ?int
    {
        $this->ensurePreActivoEstadoExists();

        $preActivoId = Estado::query()
            ->whereRaw("LOWER(REPLACE(REPLACE(TRIM(nombre), '-', ' '), '_', ' ')) = ?", ['pre activo'])
            ->value('id');

        if ($preActivoId !== null) {
            return (int) $preActivoId;
        }

        $activoId = Estado::query()
            ->whereRaw('LOWER(TRIM(nombre)) = ?', ['activo'])
            ->value('id');

        return $activoId !== null ? (int) $activoId : null;
    }

    protected function ensurePreActivoEstadoExists(): void
    {
        if (! Schema::hasTable('estados')) {
            return;
        }

        $exists = Estado::query()
            ->whereRaw("LOWER(REPLACE(REPLACE(TRIM(nombre), '-', ' '), '_', ' ')) = ?", ['pre activo'])
            ->exists();

        if (! $exists) {
            Estado::query()->create([
                'nombre' => 'Pre activo',
            ]);
        }
    }

    protected function ensureEnviadoEstadoExists(): void
    {
        if (! Schema::hasTable('estados')) {
            return;
        }

        $exists = Estado::query()
            ->whereRaw('LOWER(TRIM(nombre)) = ?', ['enviado'])
            ->exists();

        if (! $exists) {
            Estado::query()->create([
                'nombre' => 'Enviado',
            ]);
        }
    }

    protected function matchesPersonaEmail(Persona $persona, ?string $email): bool
    {
        if (! is_string($email) || trim($email) === '') {
            return false;
        }

        $normalized = strtolower(trim($email));
        $candidates = [
            $persona->email,
            $persona->dueno?->email,
            $persona->cobrador_email,
        ];

        foreach ($candidates as $candidate) {
            if (! is_string($candidate)) {
                continue;
            }
            if (strtolower(trim($candidate)) === $normalized) {
                return true;
            }
        }

        return false;
    }

    public function combustible(Request $request, Persona $persona): JsonResponse
    {
        $domain = $this->normalizeDomain($persona->patente);

        if (! $domain) {
            return response()->json([
                'data' => [],
                'totals' => [
                    'movements' => 0,
                    'liters' => 0,
                    'amount' => 0,
                ],
                'domain' => null,
                'message' => 'No hay patente asociada al distribuidor.',
            ]);
        }

        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        $product = $request->query('product');
        $station = $request->query('station');
        $onlyPending = $request->boolean('only_pending');
        $onlyImputed = $request->boolean('only_imputed');

        $query = FuelMovement::query()
            ->where('domain_norm', $domain)
            ->whereNotIn('status', ['DUPLICATE'])
            ->orderByDesc('occurred_at');

        if ($onlyPending) {
            $query->where('discounted', false);
        }

        if ($onlyImputed) {
            $query->whereIn('status', ['IMPUTED']);
        }

        if (is_string($dateFrom) && trim($dateFrom) !== '') {
            $query->whereDate('occurred_at', '>=', trim($dateFrom));
        }

        if (is_string($dateTo) && trim($dateTo) !== '') {
            $query->whereDate('occurred_at', '<=', trim($dateTo));
        }

        if (is_string($product) && trim($product) !== '') {
            $query->where('product', 'like', '%' . trim($product) . '%');
        }

        if (is_string($station) && trim($station) !== '') {
            $query->where('station', 'like', '%' . trim($station) . '%');
        }

        $rows = $query->limit(500)->get()->map(fn (FuelMovement $movement) => [
            'id' => $movement->id,
            'occurred_at' => $movement->occurred_at
                ? $movement->occurred_at->timezone(config('app.timezone', 'America/Argentina/Buenos_Aires'))->toIso8601String()
                : null,
            'station' => $movement->station,
            'locality' => $movement->locality,
            'domain_norm' => $movement->domain_norm,
            'product' => $movement->product,
            'liters' => $movement->liters,
            'amount' => $movement->amount,
            'price_per_liter' => $movement->price_per_liter,
            'status' => $movement->status,
            'discounted' => (bool) $movement->discounted,
        ]);

        $totals = [
            'movements' => $rows->count(),
            'liters' => $rows->sum('liters'),
            'amount' => $rows->sum('amount'),
        ];

        return response()->json([
            'data' => $rows,
            'totals' => $totals,
            'domain' => $domain,
        ]);
    }

    public function combustibleReports(Request $request, Persona $persona): JsonResponse
    {
        $domain = $this->normalizeDomain($persona->patente);

        if (! $domain) {
            return response()->json([
                'data' => [],
                'domain' => null,
                'message' => 'No hay patente asociada al distribuidor.',
            ]);
        }

        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        $query = FuelReport::query()
            ->where('status', 'APPLIED')
            ->whereHas('items.movement', function ($movementQuery) use ($domain) {
                $movementQuery->where('domain_norm', $domain);
            })
            ->with(['items.movement'])
            ->orderByDesc('applied_at')
            ->orderByDesc('id');

        if (is_string($dateFrom) && trim($dateFrom) !== '') {
            $query->whereDate('period_from', '>=', trim($dateFrom));
        }

        if (is_string($dateTo) && trim($dateTo) !== '') {
            $query->whereDate('period_to', '<=', trim($dateTo));
        }

        $reports = $query->limit(200)->get()->map(function (FuelReport $report) {
            return [
                'id' => $report->id,
                'period_from' => $report->period_from,
                'period_to' => $report->period_to,
                'total_amount' => $report->total_amount,
                'adjustments_total' => $report->adjustments_total,
                'total_to_bill' => $report->total_to_bill,
                'status' => $report->status,
                'applied_at' => $report->applied_at
                    ? $report->applied_at->timezone(config('app.timezone', 'America/Argentina/Buenos_Aires'))->toIso8601String()
                    : null,
                'liquidacion_id' => $report->liquidacion_id,
                'items' => $report->items->map(function ($item) {
                    $movement = $item->movement;
                    return [
                        'id' => $item->id,
                        'movement_id' => $item->fuel_movement_id,
                        'occurred_at' => $movement?->occurred_at,
                        'station' => $movement?->station,
                        'product' => $movement?->product,
                        'liters' => $movement?->liters ?? $item->liters,
                        'amount' => $movement?->amount ?? $item->amount,
                        'status' => $movement?->status,
                    ];
                })->values(),
            ];
        });

        return response()->json([
            'data' => $reports,
            'domain' => $domain,
        ]);
    }

    public function resumenMensual(Request $request): JsonResponse
    {
        $timezone = config('app.timezone', 'UTC');
        $cutoff = Carbon::create(2026, 1, 1, 0, 0, 0, $timezone);

        $baseQuery = Persona::query()
            ->where(function ($query) {
                $query->where('es_solicitud', false)->orWhereNull('es_solicitud');
            });

        $altaRows = (clone $baseQuery)
            ->whereNotNull('fecha_alta')
            ->selectRaw('YEAR(fecha_alta) as year, MONTH(fecha_alta) as month, COUNT(*) as total')
            ->groupByRaw('YEAR(fecha_alta), MONTH(fecha_alta)')
            ->get();

        $bajaRows = (clone $baseQuery)
            ->whereNotNull('fecha_baja')
            ->selectRaw('YEAR(fecha_baja) as year, MONTH(fecha_baja) as month, COUNT(*) as total')
            ->groupByRaw('YEAR(fecha_baja), MONTH(fecha_baja)')
            ->get();

        $computedBuckets = [];
        foreach ($altaRows as $row) {
            $year = (int) $row->year;
            $month = (int) $row->month;
            $key = sprintf('%04d-%02d', $year, $month);
            if (! isset($computedBuckets[$key])) {
                $computedBuckets[$key] = [
                    'year' => $year,
                    'month' => $month,
                    'altas' => 0,
                    'bajas' => 0,
                    'total' => 0,
                ];
            }
            $computedBuckets[$key]['altas'] = (int) $row->total;
            $computedBuckets[$key]['total'] =
                $computedBuckets[$key]['altas'] + $computedBuckets[$key]['bajas'];
        }

        foreach ($bajaRows as $row) {
            $year = (int) $row->year;
            $month = (int) $row->month;
            $key = sprintf('%04d-%02d', $year, $month);
            if (! isset($computedBuckets[$key])) {
                $computedBuckets[$key] = [
                    'year' => $year,
                    'month' => $month,
                    'altas' => 0,
                    'bajas' => 0,
                    'total' => 0,
                ];
            }
            $computedBuckets[$key]['bajas'] = (int) $row->total;
            $computedBuckets[$key]['total'] =
                $computedBuckets[$key]['altas'] + $computedBuckets[$key]['bajas'];
        }

        $frozenCandidates = [];
        $liveBuckets = [];
        foreach ($computedBuckets as $key => $bucket) {
            $bucketDate = Carbon::create($bucket['year'], $bucket['month'], 1, 0, 0, 0, $timezone);
            if ($bucketDate->lt($cutoff)) {
                $frozenCandidates[$key] = $bucket;
            } else {
                $liveBuckets[$key] = $bucket;
            }
        }

        $existingFrozen = PersonalMonthlySummary::query()
            ->where('year', '<', 2026)
            ->get()
            ->keyBy(fn ($item) => sprintf('%04d-%02d', $item->year, $item->month));

        $toInsert = [];
        foreach ($frozenCandidates as $key => $bucket) {
            if ($existingFrozen->has($key)) {
                continue;
            }
            $toInsert[] = [
                'year' => $bucket['year'],
                'month' => $bucket['month'],
                'altas' => $bucket['altas'],
                'bajas' => $bucket['bajas'],
                'total' => $bucket['total'],
                'frozen_at' => now($timezone),
                'created_at' => now($timezone),
                'updated_at' => now($timezone),
            ];
        }

        if (! empty($toInsert)) {
            PersonalMonthlySummary::query()->insert($toInsert);
            $existingFrozen = PersonalMonthlySummary::query()
                ->where('year', '<', 2026)
                ->get()
                ->keyBy(fn ($item) => sprintf('%04d-%02d', $item->year, $item->month));
        }

        $combined = [];
        foreach ($existingFrozen as $key => $row) {
            $combined[$key] = [
                'year' => (int) $row->year,
                'month' => (int) $row->month,
                'altas' => (int) $row->altas,
                'bajas' => (int) $row->bajas,
                'total' => (int) $row->total,
                'frozen' => true,
            ];
        }

        foreach ($liveBuckets as $key => $bucket) {
            $combined[$key] = [
                'year' => $bucket['year'],
                'month' => $bucket['month'],
                'altas' => $bucket['altas'],
                'bajas' => $bucket['bajas'],
                'total' => $bucket['total'],
                'frozen' => false,
            ];
        }

        $sorted = collect($combined)
            ->sortByDesc(fn ($item, $key) => $key)
            ->values()
            ->all();

        return response()->json([
            'data' => $sorted,
            'cutoff' => $cutoff->toDateString(),
        ]);
    }

    public function combustibleProjection(Request $request, Persona $persona): JsonResponse
    {
        $domain = $this->normalizeDomain($persona->patente);

        if (! $domain) {
            return response()->json([
                'totals' => [
                    'movements' => 0,
                    'liters' => 0,
                    'amount' => 0,
                ],
                'domain' => null,
                'message' => 'No hay patente asociada al distribuidor.',
            ]);
        }

        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        $query = FuelMovement::query()
            ->where('domain_norm', $domain)
            ->where('discounted', false)
            ->whereNotIn('status', ['DUPLICATE'])
            ->orderByDesc('occurred_at');

        if (is_string($dateFrom) && trim($dateFrom) !== '') {
            $query->whereDate('occurred_at', '>=', trim($dateFrom));
        }

        if (is_string($dateTo) && trim($dateTo) !== '') {
            $query->whereDate('occurred_at', '<=', trim($dateTo));
        }

        $rows = $query->limit(500)->get(['liters', 'amount']);
        $totals = [
            'movements' => $rows->count(),
            'liters' => $rows->sum('liters'),
            'amount' => $rows->sum('amount'),
        ];

        return response()->json([
            'totals' => $totals,
            'domain' => $domain,
        ]);
    }

    public function personalNotifications(Request $request, Persona $persona): JsonResponse
    {
        $email = $request->query('email');
        if (! $this->matchesPersonaEmail($persona, $email)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $query = PersonalNotification::query()
            ->where('persona_id', $persona->id)
            ->orderByDesc('created_at');

        $limit = (int) $request->query('limit', 50);
        if ($limit <= 0 || $limit > 200) {
            $limit = 50;
        }

        $notifications = $query->limit($limit)->get()->map(fn (PersonalNotification $notification) => [
            'id' => $notification->id,
            'type' => $notification->type,
            'title' => $notification->title,
            'message' => $notification->message,
            'metadata' => $notification->metadata,
            'readAt' => $notification->read_at?->toIso8601String(),
            'createdAt' => $notification->created_at?->toIso8601String(),
        ]);

        return response()->json(['data' => $notifications]);
    }

    public function markPersonalNotificationRead(Request $request, Persona $persona, PersonalNotification $notification): JsonResponse
    {
        $email = $request->query('email');
        if (! $this->matchesPersonaEmail($persona, $email)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($notification->persona_id !== $persona->id) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if (! $notification->read_at) {
            $notification->read_at = Carbon::now();
            $notification->save();
        }

        return response()->json([
            'id' => $notification->id,
            'readAt' => $notification->read_at?->toIso8601String(),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $includePending = $request->boolean('includePending');
        $liquidacionTypeIds = $this->resolveLiquidacionTypeIds();
        $fuelTypeIds = $this->resolveFuelTypeIds();
        $documentTypeIds = $liquidacionTypeIds
            ->merge($fuelTypeIds)
            ->unique()
            ->values();

        $query = Persona::query()
            ->with([
                'cliente:id,nombre',
                'unidad:id,matricula,marca,modelo',
                'sucursal:id,nombre',
                'agente:id,name',
                'agenteResponsable:id,name',
                'estado:id,nombre',
                'dueno:id,persona_id,nombreapellido,fecha_nacimiento,email,telefono,cuil,cuil_cobrador,cbu_alias,observaciones',
                'aprobadoPor:id,name',
                'documentosVencimientos' => function ($documentsQuery) use ($includePending) {
                    $documentsQuery
                        ->select('id', 'persona_id', 'fecha_vencimiento', 'tipo_archivo_id', 'es_pendiente')
                        ->with('tipo:id,vence')
                        ->whereHas('tipo', fn ($query) => $query->where('vence', true))
                        ->whereNotNull('fecha_vencimiento');
                    if (! $includePending) {
                        $documentsQuery->where('es_pendiente', false);
                    }
                },
                'documentos' => function ($documentsQuery) use ($documentTypeIds, $includePending) {
                    $documentsQuery
                        ->select(
                            'id',
                            'persona_id',
                            'parent_document_id',
                            'nombre_original',
                            'tipo_archivo_id',
                            'fecha_vencimiento',
                            'fortnight_key',
                            'created_at',
                            'importe_facturar',
                            'enviada',
                            'recibido',
                            'pagado'
                        )
                        ->with('tipo:id,nombre')
                        ->withCount('children');

                    if ($documentTypeIds->isNotEmpty()) {
                        $documentsQuery->whereIn('tipo_archivo_id', $documentTypeIds);
                    } else {
                        $documentsQuery->where(function ($inner) {
                            $inner
                                ->whereRaw('LOWER(nombre_original) LIKE ?', ['%liquid%'])
                                ->orWhereRaw('LOWER(ruta) LIKE ?', ['%liquid%'])
                                ->orWhereRaw('LOWER(nombre_original) LIKE ?', ['%combust%'])
                                ->orWhereRaw('LOWER(ruta) LIKE ?', ['%combust%']);
                        });
                    }

                    if (! $includePending) {
                        $documentsQuery->where('es_pendiente', false);
                    }
                    $documentsQuery->whereNull('parent_document_id')->orderByDesc('created_at');
                },
            ])
            ->orderByDesc('id');

        if ($request->has('esSolicitud')) {
            $rawValue = $request->input('esSolicitud');
            $truthy = [true, 1, '1', 'true', 'on', 'yes', 'si', 'sí'];
            $falsy = [false, 0, '0', 'false', 'off', 'no'];

            if (in_array($rawValue, $truthy, true)) {
                $query->where('es_solicitud', true);
            } elseif (in_array($rawValue, $falsy, true)) {
                $query->where(function ($inner) {
                    $inner
                        ->where('es_solicitud', false)
                        ->orWhereNull('es_solicitud');
                });
            }
        }

        if ($request->filled('perfilValue')) {
            $query->where('tipo', $request->input('perfilValue'));
        }

        if ($request->filled('email')) {
            $email = strtolower(trim($request->input('email')));

            $query->where(function ($inner) use ($email) {
                $inner
                    ->whereRaw('LOWER(email) = ?', [$email])
                    ->orWhereHas('dueno', function ($ownerQuery) use ($email) {
                        $ownerQuery->whereRaw('LOWER(email) = ?', [$email]);
                    });
            });
        }

        $personas = $query->get();

        $latestLiquidacionIds = $personas
            ->map(fn (Persona $persona) => $persona->documentos?->first()?->id)
            ->filter()
            ->unique()
            ->values();

        $reportsByLiquidacion = collect();
        if ($latestLiquidacionIds->isNotEmpty()) {
            $reports = FuelReport::query()
                ->whereIn('liquidacion_id', $latestLiquidacionIds)
                ->orderByDesc('applied_at')
                ->orderByDesc('id')
                ->get();

            $reportsByLiquidacion = $reports
                ->groupBy('liquidacion_id')
                ->map(fn ($group) => $group->first());
        }

        $personas = $personas
            ->map(function (Persona $persona) use ($reportsByLiquidacion) {
                $item = $this->transformPersonaListItem($persona);
                $latestLiquidacionId = $persona->documentos?->first()?->id;
                if ($latestLiquidacionId && $reportsByLiquidacion->has($latestLiquidacionId)) {
                    $report = $reportsByLiquidacion->get($latestLiquidacionId);
                    $item['combustibleResumen'] = [
                        'reportId' => $report->id,
                        'status' => $report->status,
                        'totalAmount' => (float) $report->total_amount,
                        'adjustmentsTotal' => (float) $report->adjustments_total,
                        'totalToBill' => (float) $report->total_to_bill,
                    ];
                } else {
                    $item['combustibleResumen'] = null;
                }

                return $item;
            })
            ->values();

        return response()->json(['data' => $personas]);
    }

    public function show(Request $request, $id): JsonResponse
    {
        $includePending = $request->boolean('includePending');
        $persona = Persona::withTrashed()
        ->with([
            'cliente:id,nombre',
            'unidad:id,matricula,marca,modelo',
            'sucursal:id,nombre',
            'agente:id,name',
            'agenteResponsable:id,name',
            'estado:id,nombre',
            'dueno:id,persona_id,nombreapellido,fecha_nacimiento,email,telefono,cuil,cuil_cobrador,cbu_alias,observaciones',
            'documentos' => fn ($query) => $query
                ->with([
                    'tipo:id,nombre,vence',
                    'children:id,parent_document_id,nombre_original,tipo_archivo_id',
                    'children.tipo:id,nombre',
                ])
                ->orderByDesc('created_at'),
            'comments.user:id,name',
            'histories.user:id,name',
        ])
        ->find($id);

    if (! $persona) {
        return response()->json([
            'message' => 'El personal solicitado no existe o fue eliminado permanentemente.',
        ], 404);
    }

        return response()->json([
            'data' => $this->buildPersonaDetail($persona, $includePending),
        ]);
    }

    public function logContactReveal(Request $request, Persona $persona): JsonResponse
    {
        $validated = $request->validate([
            'campo' => ['required', 'string', 'in:telefono,email'],
            'actorId' => ['nullable', 'integer', 'exists:users,id'],
            'actorName' => ['nullable', 'string', 'max:255'],
        ]);

        $actorEmail = $this->resolveActorEmail($request);
        $actorId = $validated['actorId'] ?? $request->user()?->id;
        $actorName = $validated['actorName'] ?? $request->user()?->name;

        if ($actorId && (! $actorEmail || ! $actorName)) {
            $actorUser = User::query()->find($actorId);
            if (! $actorEmail) {
                $actorEmail = $actorUser?->email ? strtolower(trim($actorUser->email)) : null;
            }
            if (! $actorName) {
                $actorName = $actorUser?->name;
            }
        }

        $record = ContactReveal::create([
            'persona_id' => $persona->id,
            'campo' => $validated['campo'],
            'actor_id' => $actorId,
            'actor_name' => $actorName,
            'actor_email' => $actorEmail,
            'ip_address' => $request->ip(),
        ]);

        AuditLogger::log($request, 'contact_reveal', 'persona', $persona->id, [
            'campo' => $validated['campo'],
            'actor_id' => $actorId,
            'actor_email' => $actorEmail,
        ]);

        return response()->json([
            'message' => 'Registro de visualización guardado',
            'data' => [
                'id' => $record->id,
                'campo' => $record->campo,
                'personaId' => $record->persona_id,
            ],
        ]);
    }


    public function update(Request $request, Persona $persona): JsonResponse
    {
        $this->ensureCanManagePersonal($request, $persona);
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        $canEditCbu = in_array($role, ['admin', 'admin2'], true);

        $validated = $request->validate([
            'nombres' => ['nullable', 'string', 'max:255'],
            'apellidos' => ['nullable', 'string', 'max:255'],
            'legajo' => ['nullable', 'string', 'max:255'],
            'cuil' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'perfilValue' => ['nullable', 'integer'],
            'agenteId' => ['nullable', 'integer', 'exists:users,id'],
            'agenteResponsableId' => ['nullable', 'integer', 'exists:users,id'],
            'agenteResponsableIds' => ['nullable', 'array'],
            'agenteResponsableIds.*' => ['integer', 'exists:users,id'],
            'clienteId' => ['nullable', 'integer', 'exists:clientes,id'],
            'sucursalId' => ['nullable', 'integer', 'exists:sucursals,id'],
            'unidadId' => ['nullable', 'integer', 'exists:unidades,id'],
            'estadoId' => ['nullable', 'integer', 'exists:estados,id'],
            'pago' => ['nullable', 'numeric'],
            'cbuAlias' => ['nullable', 'string', 'max:255'],
            'patente' => ['nullable', 'string', 'max:100'],
            'fechaAlta' => ['nullable', 'date'],
            'fechaAltaVinculacion' => ['nullable', 'date'],
            'fechaBaja' => ['nullable', 'date'],
            'observacionTarifa' => ['nullable', 'string'],
            'observaciones' => ['nullable', 'string'],
            'combustible' => ['nullable', 'boolean'],
            'combustibleEstado' => ['nullable', 'string', 'in:activo,suspendido'],
            'tarifaEspecial' => ['nullable', 'boolean'],
            'esCobrador' => ['nullable', 'boolean'],
            'cobradorNombre' => ['nullable', 'string', 'max:255'],
            'cobradorEmail' => ['nullable', 'email', 'max:255'],
            'cobradorCuil' => ['nullable', 'string', 'max:255'],
            'cobradorCbuAlias' => ['nullable', 'string', 'max:255'],
            'duenoNombre' => ['nullable', 'string', 'max:255'],
            'duenoFechaNacimiento' => ['nullable', 'date'],
            'duenoEmail' => ['nullable', 'email', 'max:255'],
            'duenoCuil' => ['nullable', 'string', 'max:255'],
            'duenoCuilCobrador' => ['nullable', 'string', 'max:255'],
            'duenoCbuAlias' => ['nullable', 'string', 'max:255'],
            'duenoTelefono' => ['nullable', 'string', 'max:255'],
            'duenoObservaciones' => ['nullable', 'string'],
        ]);

        $targetEstadoId = array_key_exists('estadoId', $validated) ? $validated['estadoId'] : $persona->estado_id;
        $targetEstadoNombre = '';
        if ($targetEstadoId) {
            $estado = Estado::query()->find($targetEstadoId);
            $targetEstadoNombre = $estado?->nombre ?? '';
        } else {
            $targetEstadoNombre = $persona->estado?->nombre ?? '';
        }
        $currentEstadoNombre = (string) ($persona->estado?->nombre ?? '');
        $isTargetBaja = Str::contains(Str::lower($targetEstadoNombre), 'baja');
        $isCurrentBaja = Str::contains(Str::lower($currentEstadoNombre), 'baja');
        $isCurrentActivo = Str::contains(Str::lower($currentEstadoNombre), 'activo') || (bool) $persona->aprobado;
        $requiresFechaBaja = $isTargetBaja && ! $isCurrentBaja && $isCurrentActivo;

        if ($requiresFechaBaja && empty($validated['fechaBaja'])) {
            throw ValidationException::withMessages([
                'fechaBaja' => 'La fecha de baja es obligatoria cuando el estado es baja.',
            ]);
        }

        $originalClienteId = $persona->cliente_id;
        $originalClienteName = $this->resolveClienteName($originalClienteId);
        $personaHistoryDefinitions = $this->getPersonaHistoryFieldDefinitions();
        $ownerHistoryDefinitions = $this->getPersonaOwnerHistoryFieldDefinitions();
        $originalPersonaSnapshot = $this->capturePersonaHistorySnapshot($persona, $personaHistoryDefinitions);
        $originalOwnerSnapshot = $this->capturePersonaOwnerHistorySnapshot($persona->dueno, $ownerHistoryDefinitions);
        $responsableIds = collect(
            $this->normalizeResponsableIds($request->input('agenteResponsableIds') ?? [])
        );

        if (array_key_exists('agenteResponsableId', $validated) && $validated['agenteResponsableId'] !== null) {
            $responsableIds->prepend((int) $validated['agenteResponsableId']);
        }

        $responsableIds = $responsableIds
            ->filter(fn ($id) => $id !== null)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();
        $primaryResponsableId = $responsableIds->first();

        $stringAssignments = [
            'nombres' => 'nombres',
            'apellidos' => 'apellidos',
            'legajo' => 'legajo',
            'cuil' => 'cuil',
            'telefono' => 'telefono',
            'email' => 'email',
            'patente' => 'patente',
            'observacionTarifa' => 'observaciontarifa',
            'observaciones' => 'observaciones',
            'cobradorNombre' => 'cobrador_nombre',
            'cobradorEmail' => 'cobrador_email',
            'cobradorCuil' => 'cobrador_cuil',
        ];
        if ($canEditCbu) {
            $stringAssignments['cbuAlias'] = 'cbu_alias';
            $stringAssignments['cobradorCbuAlias'] = 'cobrador_cbu_alias';
        }

        foreach ($stringAssignments as $inputKey => $attribute) {
            if (array_key_exists($inputKey, $validated)) {
                $value = $validated[$inputKey];
                $persona->{$attribute} = $value !== null && $value !== '' ? $value : null;
            }
        }

        if (array_key_exists('perfilValue', $validated)) {
            $persona->tipo = $validated['perfilValue'] ?? null;
        }

        $integerAssignments = [
            'agenteId' => 'agente_id',
            'clienteId' => 'cliente_id',
            'sucursalId' => 'sucursal_id',
            'unidadId' => 'unidad_id',
            'estadoId' => 'estado_id',
        ];

        foreach ($integerAssignments as $inputKey => $attribute) {
            if (array_key_exists($inputKey, $validated)) {
                $persona->{$attribute} = $validated[$inputKey] ?? null;
            }
        }

        $clienteChanged = false;
        if (array_key_exists('clienteId', $validated)) {
            $newClienteId = $validated['clienteId'] ?? null;
            $clienteChanged = (string) ($newClienteId ?? '') !== (string) ($originalClienteId ?? '');
        }

        if ($clienteChanged) {
            $persona->es_solicitud = true;
            $persona->aprobado = false;
            $persona->aprobado_at = null;
            $persona->aprobado_por = null;
        }

        if ($request->has('agenteResponsableId') || $request->has('agenteResponsableIds')) {
            $persona->agente_responsable_id = $primaryResponsableId ?? null;
            $persona->agentes_responsables_ids = $responsableIds->isNotEmpty() ? $responsableIds->all() : null;
        }

        if (array_key_exists('pago', $validated)) {
            $persona->pago = $validated['pago'] ?? null;
        }

        if (array_key_exists('fechaAlta', $validated)) {
            $persona->fecha_alta = $validated['fechaAlta'] ? Carbon::parse($validated['fechaAlta']) : null;
        } elseif (array_key_exists('fechaAltaVinculacion', $validated)) {
            $persona->fecha_alta = $validated['fechaAltaVinculacion']
                ? Carbon::parse($validated['fechaAltaVinculacion'])
                : null;
        }

        if (array_key_exists('fechaBaja', $validated)) {
            $persona->fecha_baja = $validated['fechaBaja'] ? Carbon::parse($validated['fechaBaja']) : null;
        }

        if (array_key_exists('combustible', $validated)) {
            $persona->combustible = $validated['combustible'] ? 1 : 0;
            $persona->combustible_estado = $persona->combustible
                ? ($validated['combustibleEstado'] ?? $persona->combustible_estado)
                : null;
        }

        if (array_key_exists('combustibleEstado', $validated) && $persona->combustible) {
            $persona->combustible_estado = $validated['combustibleEstado'] ?? null;
        }

        if (array_key_exists('tarifaEspecial', $validated)) {
            $persona->tarifaespecial = $validated['tarifaEspecial'] ? 1 : 0;
        }

        if (array_key_exists('esCobrador', $validated)) {
            $persona->es_cobrador = $validated['esCobrador'] ? 1 : 0;
            $persona->cobrador_nombre = $validated['esCobrador'] ? ($validated['cobradorNombre'] ?? null) : null;
            $persona->cobrador_email = $validated['esCobrador'] ? ($validated['cobradorEmail'] ?? null) : null;
            $persona->cobrador_cuil = $validated['esCobrador'] ? ($validated['cobradorCuil'] ?? null) : null;
            if ($canEditCbu && array_key_exists('cobradorCbuAlias', $validated)) {
                $persona->cobrador_cbu_alias = $validated['esCobrador'] ? ($validated['cobradorCbuAlias'] ?? null) : null;
            }
        }

        $persona->save();

        $ownerPayload = [
            'nombreapellido' => $validated['duenoNombre'] ?? null,
            'fecha_nacimiento' => $validated['duenoFechaNacimiento'] ?? null,
            'email' => $validated['duenoEmail'] ?? null,
            'telefono' => $validated['duenoTelefono'] ?? null,
            'cuil' => $validated['duenoCuil'] ?? null,
            'cuil_cobrador' => $validated['duenoCuilCobrador'] ?? null,
            'cbu_alias' => $canEditCbu
                ? ($validated['duenoCbuAlias'] ?? null)
                : ($persona->dueno?->cbu_alias ?? null),
            'observaciones' => $validated['duenoObservaciones'] ?? null,
        ];

        $hasOwnerData = collect($ownerPayload)
            ->reject(fn ($value) => $value === null || $value === '')
            ->isNotEmpty();

        if ($hasOwnerData) {
            $owner = $persona->dueno;
            $payload = [
                'nombreapellido' => $ownerPayload['nombreapellido'] ?: 'Sin nombre',
                'fecha_nacimiento' => $ownerPayload['fecha_nacimiento'] ?: null,
                'email' => $ownerPayload['email'] ?: null,
                'telefono' => $ownerPayload['telefono'] ?: null,
                'cuil' => $ownerPayload['cuil'] ?: null,
                'cuil_cobrador' => $ownerPayload['cuil_cobrador'] ?: null,
                'cbu_alias' => $ownerPayload['cbu_alias'] ?: null,
                'observaciones' => $ownerPayload['observaciones'] ?: null,
            ];

            if ($owner) {
                $owner->fill($payload);
                $owner->save();
            } else {
                $persona->dueno()->create($payload);
            }
        }

        $persona->loadMissing('dueno');

        $updatedPersonaSnapshot = $this->capturePersonaHistorySnapshot($persona, $personaHistoryDefinitions);
        $updatedOwnerSnapshot = $this->capturePersonaOwnerHistorySnapshot($persona->dueno, $ownerHistoryDefinitions);

        $historyChanges = array_merge(
            $this->computeHistoryChanges($personaHistoryDefinitions, $originalPersonaSnapshot, $updatedPersonaSnapshot),
            $this->computeHistoryChanges($ownerHistoryDefinitions, $originalOwnerSnapshot, $updatedOwnerSnapshot)
        );

        if (! empty($historyChanges)) {
            $persona->histories()->create([
                'user_id' => $request->user()?->id,
                'description' => 'Actualización de datos del personal',
                'changes' => $historyChanges,
            ]);
        }

        if ($clienteChanged) {
            $persona->histories()->create([
                'user_id' => $request->user()?->id,
                'description' => 'Cambio de cliente',
                'changes' => [[
                    'field' => 'cliente_id',
                    'label' => 'Cliente',
                    'oldValue' => $originalClienteName,
                    'newValue' => $this->resolveClienteName($persona->cliente_id),
                ]],
            ]);
        }

        $changed = $persona->getChanges();
        $trackedFields = [
            'nombres',
            'apellidos',
            'legajo',
            'cuil',
            'telefono',
            'email',
            'tipo',
            'agente_id',
            'agente_responsable_id',
            'agentes_responsables_ids',
            'cliente_id',
            'sucursal_id',
            'unidad_id',
            'estado_id',
            'pago',
            'cbu_alias',
            'patente',
            'combustible_estado',
            'es_cobrador',
            'cobrador_nombre',
            'cobrador_email',
            'cobrador_cuil',
            'cobrador_cbu_alias',
            'observaciontarifa',
            'observaciones',
            'fecha_alta',
            'fecha_baja',
            'combustible',
            'tarifaespecial',
            'dueno_cbu_alias',
            'dueno_cuil',
            'dueno_cuil_cobrador',
        ];
        $diff = [];
        foreach ($trackedFields as $field) {
            if (array_key_exists($field, $changed)) {
                $diff[$field] = [
                    'old' => $originalPersonaSnapshot[$field] ?? null,
                    'new' => $persona->{$field},
                ];
            }
        }
        if (! empty($diff)) {
            AuditLogger::log($request, 'persona_update', 'persona', $persona->id, [
                'changes' => $diff,
            ]);
        }

        if ($clienteChanged) {
            $this->notifyAgenteResponsable(
                $persona,
                'Se registró una nueva solicitud de cambio de cliente para %s.'
            );
        }

        $persona->refresh();
        $persona->load([
            'cliente:id,nombre',
            'unidad:id,matricula,marca,modelo',
            'sucursal:id,nombre',
            'agente:id,name',
            'agenteResponsable:id,name',
            'estado:id,nombre',
            'documentos' => fn ($query) => $query->with('tipo:id,nombre,vence')->orderByDesc('created_at'),
            'comments.user:id,name',
            'histories.user:id,name',
        ]);

        return response()->json([
            'message' => 'Información actualizada correctamente.',
            'data' => $this->buildPersonaDetail($persona),
        ]);
    }

    public function destroy(Request $request, Persona $persona): JsonResponse
    {
        $this->ensureCanManagePersonal($request, $persona);

        $persona->delete();

        return response()->json([
            'message' => 'Personal eliminado correctamente.',
        ]);
    }

    public function meta(): JsonResponse
    {
        $this->ensurePreActivoEstadoExists();
        $this->ensureEnviadoEstadoExists();

        return response()->json([
            'perfiles' => [
                ['value' => 1, 'label' => 'Dueño y chofer'],
                ['value' => 2, 'label' => 'Chofer'],
                ['value' => 3, 'label' => 'Transportista'],
            ],
            'clientes' => Cliente::query()->select('id', 'nombre')->orderBy('nombre')->get(),
            'sucursales' => Sucursal::query()->select('id', 'cliente_id', 'nombre')->orderBy('nombre')->get(),
            'agentes' => User::query()->select('id', 'name')->orderBy('name')->get(),
            'unidades' => Unidad::query()->select('id', 'matricula', 'marca', 'modelo')->orderBy('matricula')->get(),
            'estados' => Estado::query()->select('id', 'nombre')->orderBy('nombre')->get(),
            'documentTypes' => FileType::query()
                ->select('id', 'nombre', 'vence')
                ->orderBy('nombre')
                ->get()
                ->map(fn (FileType $tipo) => [
                    'id' => $tipo->id,
                    'nombre' => $tipo->nombre,
                    'vence' => (bool) $tipo->vence,
                ])
                ->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $autoApproveInput = $request->input('autoApprove', false);
        $autoApprove = array_key_exists('autoApprove', $request->all()) ? (bool) $autoApproveInput : false;

        if ($autoApprove) {
            $this->ensureCanManagePersonal($request);
        }

        $perfilValue = (int) $request->input('perfilValue', 0);
        $apellidosRules = ['string', 'max:255'];

        if ($perfilValue === 2) {
            array_unshift($apellidosRules, 'nullable');
        } else {
            array_unshift($apellidosRules, 'required');
        }

        $validated = $request->validate([
            'nombres' => ['required', 'string', 'max:255'],
            'apellidos' => $apellidosRules,
            'legajo' => ['nullable', 'string', 'max:255'],
            'cuil' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'perfilValue' => ['nullable', 'integer'],
            'agenteId' => ['nullable', 'integer', 'exists:users,id'],
            'agenteResponsableId' => ['nullable', 'integer', 'exists:users,id'],
            'agenteResponsableIds' => ['nullable', 'array'],
            'agenteResponsableIds.*' => ['integer', 'exists:users,id'],
            'clienteId' => ['nullable', 'integer', 'exists:clientes,id'],
            'sucursalId' => ['nullable', 'integer', 'exists:sucursals,id'],
            'unidadId' => ['nullable', 'integer', 'exists:unidades,id'],
            'estadoId' => ['nullable', 'integer', 'exists:estados,id'],
            'pago' => ['nullable', 'numeric'],
            'cbuAlias' => ['nullable', 'string', 'max:255'],
            'patente' => ['nullable', 'string', 'max:100'],
            'fechaAlta' => ['nullable', 'date'],
            'fechaAltaVinculacion' => ['nullable', 'date'],
            'fechaBaja' => ['nullable', 'date'],
            'observacionTarifa' => ['nullable', 'string'],
            'observaciones' => ['nullable', 'string'],
            'combustible' => ['required', 'boolean'],
            'combustibleEstado' => ['nullable', 'string', 'in:activo,suspendido'],
            'tarifaEspecial' => ['required', 'boolean'],
            'esCobrador' => ['nullable', 'boolean'],
            'cobradorNombre' => ['nullable', 'string', 'max:255'],
            'cobradorEmail' => ['nullable', 'email', 'max:255'],
            'cobradorCuil' => ['nullable', 'string', 'max:255'],
            'cobradorCbuAlias' => ['nullable', 'string', 'max:255'],
            'duenoNombre' => ['nullable', 'string', 'max:255'],
            'duenoFechaNacimiento' => ['nullable', 'date'],
            'duenoEmail' => ['nullable', 'email', 'max:255'],
            'duenoTelefono' => ['nullable', 'string', 'max:255'],
            'duenoCuil' => ['nullable', 'string', 'max:255'],
            'duenoCuilCobrador' => ['nullable', 'string', 'max:255'],
            'duenoCbuAlias' => ['nullable', 'string', 'max:255'],
            'duenoObservaciones' => ['nullable', 'string'],
            'autoApprove' => ['nullable', 'boolean'],
            'autoApproveUserId' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $autoApprove = array_key_exists('autoApprove', $validated) ? (bool) $validated['autoApprove'] : false;
        $autoApproveUserId = $validated['autoApproveUserId'] ?? null;
        $fechaAltaInput = $validated['fechaAlta'] ?? $validated['fechaAltaVinculacion'] ?? null;
        $fechaAltaValue = $fechaAltaInput ? Carbon::parse($fechaAltaInput) : null;
        $fechaBajaValue = array_key_exists('fechaBaja', $validated) && $validated['fechaBaja']
            ? Carbon::parse($validated['fechaBaja'])
            : null;
        $responsableIds = collect(
            $this->normalizeResponsableIds($request->input('agenteResponsableIds') ?? [])
        );

        if (array_key_exists('agenteResponsableId', $validated) && $validated['agenteResponsableId'] !== null) {
            $responsableIds->prepend((int) $validated['agenteResponsableId']);
        }

        $responsableIds = $responsableIds
            ->filter(fn ($id) => $id !== null)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();
        $primaryResponsableId = $responsableIds->first();

        $persona = Persona::create([
            'nombres' => $validated['nombres'],
            'apellidos' => $validated['apellidos'] ?? null,
            'cuil' => $validated['cuil'] ?? null,
            'telefono' => $validated['telefono'] ?? null,
            'email' => $validated['email'] ?? null,
            'legajo' => $validated['legajo'] ?? null,
            'tipo' => $validated['perfilValue'] ?? null,
            'agente_id' => $validated['agenteId'] ?? null,
            'agente_responsable_id' => $primaryResponsableId,
            'agentes_responsables_ids' => $responsableIds->isNotEmpty() ? $responsableIds->all() : null,
            'cliente_id' => $validated['clienteId'] ?? null,
            'sucursal_id' => $validated['sucursalId'] ?? null,
            'unidad_id' => $validated['unidadId'] ?? null,
            'estado_id' => $validated['estadoId'] ?? null,
            'pago' => $validated['pago'] ?? null,
            'cbu_alias' => $validated['cbuAlias'] ?? null,
            'patente' => $validated['patente'] ?? null,
            'fecha_alta' => $fechaAltaValue,
            'fecha_baja' => $fechaBajaValue,
            'observaciontarifa' => $validated['observacionTarifa'] ?? null,
            'observaciones' => $validated['observaciones'] ?? null,
            'combustible' => $validated['combustible'],
            'combustible_estado' => $validated['combustible'] ? ($validated['combustibleEstado'] ?? null) : null,
            'tarifaespecial' => $validated['tarifaEspecial'],
            'es_cobrador' => $validated['esCobrador'] ?? false,
            'cobrador_nombre' => $validated['esCobrador'] ? ($validated['cobradorNombre'] ?? null) : null,
            'cobrador_email' => $validated['esCobrador'] ? ($validated['cobradorEmail'] ?? null) : null,
            'cobrador_cuil' => $validated['esCobrador'] ? ($validated['cobradorCuil'] ?? null) : null,
            'cobrador_cbu_alias' => $validated['esCobrador'] ? ($validated['cobradorCbuAlias'] ?? null) : null,
            'es_solicitud' => ! $autoApprove,
        ]);

        $ownerPayload = [
            'nombreapellido' => $request->input('duenoNombre'),
            'fecha_nacimiento' => $request->input('duenoFechaNacimiento'),
            'email' => $request->input('duenoEmail'),
            'telefono' => $request->input('duenoTelefono'),
            'cuil' => $request->input('duenoCuil'),
            'cuil_cobrador' => $request->input('duenoCuilCobrador'),
            'cbu_alias' => $request->input('duenoCbuAlias'),
            'observaciones' => $request->input('duenoObservaciones'),
        ];

        $hasOwnerData = collect($ownerPayload)
            ->reject(fn ($value) => $value === null || $value === '')
            ->isNotEmpty();

        if ($hasOwnerData) {
            $persona->dueno()->create([
                'nombreapellido' => $ownerPayload['nombreapellido'] ?: 'Sin nombre',
                'fecha_nacimiento' => $ownerPayload['fecha_nacimiento'] ?: null,
                'email' => $ownerPayload['email'] ?: null,
                'telefono' => $ownerPayload['telefono'] ?: null,
                'cuil' => $ownerPayload['cuil'] ?: null,
                'cuil_cobrador' => $ownerPayload['cuil_cobrador'] ?: null,
                'cbu_alias' => $ownerPayload['cbu_alias'] ?: null,
                'observaciones' => $ownerPayload['observaciones'] ?: null,
            ]);
        }

        if ($autoApprove) {
            $approvedById = $autoApproveUserId ?? $request->user()?->id ?? null;
            $persona->aprobado = true;
            $persona->aprobado_at = Carbon::now();
            $persona->aprobado_por = $approvedById;
            $persona->es_solicitud = false;

            if (! $persona->estado_id) {
                $persona->estado_id = $this->resolveDefaultApprovedEstadoId();
            }

            $persona->save();
        }

        $notificationSent = false;

        if (! $autoApprove) {
            $notificationSent = $this->notifyAgenteResponsable($persona);
        }

        $message = $autoApprove
            ? 'Personal registrado correctamente.'
            : ($notificationSent
                ? 'Solicitud de alta registrada correctamente. Se notificó al agente responsable.'
                : 'Solicitud de alta registrada correctamente.');

        return response()->json([
            'message' => $message,
            'data' => [
                'id' => $persona->id,
            ],
        ], 201);
    }

    public function approve(Request $request, Persona $persona): JsonResponse
    {
        $this->ensureCanManagePersonal($request);

        $validated = $request->validate([
            'userId' => ['nullable', 'integer', 'exists:users,id'],
            'estadoId' => ['nullable', 'integer', 'exists:estados,id'],
        ]);

        if ($persona->aprobado) {
            return response()->json([
                'message' => 'La solicitud ya fue aprobada previamente.',
                'data' => [
                    'aprobado' => true,
                    'aprobadoAt' => optional($persona->aprobado_at)->toIso8601String(),
                    'aprobadoPorId' => $persona->aprobado_por,
                ],
            ]);
        }

        $estadoId = $validated['estadoId'] ?? null;
        if ($estadoId === null) {
            $estadoId = $this->resolveDefaultApprovedEstadoId();
        }

        $persona->aprobado = true;
        $persona->aprobado_at = Carbon::now();
        $persona->aprobado_por = $validated['userId'] ?? null;
        $persona->es_solicitud = false;

        if ($estadoId !== null) {
            $persona->estado_id = $estadoId;
        }

        if (! $persona->fecha_alta) {
            $persona->fecha_alta = Carbon::now();
        }

        $persona->save();

        $persona->loadMissing([
            'cliente:id,nombre',
            'unidad:id,matricula,marca,modelo',
            'sucursal:id,nombre',
            'agente:id,name',
            'agenteResponsable:id,name',
            'estado:id,nombre',
        ]);

        $creatorUserId = null;
        $creatorUserName = null;

        $firstHistory = $persona->histories()
            ->orderBy('created_at')
            ->with('user:id,name')
            ->first();

        if ($firstHistory && $firstHistory->user_id) {
            $creatorUserId = (int) $firstHistory->user_id;
            $creatorUserName = $firstHistory->user?->name;
        }

        $recipientIds = collect($this->getResponsableIds($persona))
            ->push($persona->agente_id)
            ->push($persona->aprobado_por)
            ->push($creatorUserId)
            ->filter(fn ($value) => $value !== null)
            ->map(fn ($value) => (int) $value)
            ->unique();

        foreach ($recipientIds as $recipientId) {
            $recipientName = null;

            if ($persona->agente_id && (int) $persona->agente_id === $recipientId) {
                $recipientName = $persona->agente?->name;
            } elseif ($persona->agente_responsable_id && (int) $persona->agente_responsable_id === $recipientId) {
                $recipientName = $persona->agenteResponsable?->name;
            } elseif ($persona->aprobado_por && (int) $persona->aprobado_por === $recipientId) {
                $recipientName = $persona->aprobadoPor?->name;
            } elseif ($creatorUserId && $recipientId === $creatorUserId) {
                $recipientName = $creatorUserName;
            }

            Log::info('Notificando aprobación de solicitud', [
                'persona_id' => $persona->id,
                'recipient_user_id' => $recipientId,
                'recipient_name' => $recipientName,
                'agente_id' => $persona->agente_id,
                'agente_responsable_id' => $persona->agente_responsable_id,
                'aprobado_por' => $persona->aprobado_por,
                'creator_user_id' => $creatorUserId,
            ]);

            $this->notifySolicitudAprobada($persona, $recipientId, $recipientName);
        }

        return response()->json([
            'message' => 'Solicitud aprobada correctamente.',
            'data' => [
                'aprobado' => true,
                'aprobadoAt' => optional($persona->aprobado_at)->toIso8601String(),
                'aprobadoPorId' => $persona->aprobado_por,
                'aprobadoPorNombre' => $persona->aprobadoPor?->name,
                'esSolicitud' => (bool) $persona->es_solicitud,
                'personalRecord' => $this->transformPersonaListItem($persona),
            ],
        ]);
    }

    public function disapprove(Request $request, Persona $persona): JsonResponse
    {
        $this->ensureCanManagePersonal($request);

        $validated = $request->validate([
            'userId' => ['nullable', 'integer', 'exists:users,id'],
            'estadoId' => ['nullable', 'integer', 'exists:estados,id'],
        ]);

        if (! $persona->aprobado) {
            return response()->json([
                'message' => 'La solicitud ya está desaprobada.',
                'data' => [
                    'aprobado' => false,
                    'aprobadoAt' => null,
                    'aprobadoPorId' => null,
                ],
            ]);
        }

        $oldApprovedAt = $persona->aprobado_at;
        $oldApprovedBy = $persona->aprobado_por;

        $persona->aprobado = false;
        $persona->aprobado_at = null;
        $persona->aprobado_por = null;
        $persona->es_solicitud = true;

        if (array_key_exists('estadoId', $validated)) {
            $persona->estado_id = $validated['estadoId'] ?? null;
        }

        $persona->save();

        $persona->histories()->create([
            'user_id' => $request->user()?->id,
            'description' => 'Aprobación revertida',
            'changes' => [
                [
                    'field' => 'aprobado',
                    'label' => 'Aprobado',
                    'oldValue' => 'Sí',
                    'newValue' => 'No',
                ],
                [
                    'field' => 'aprobado_at',
                    'label' => 'Aprobado el',
                    'oldValue' => optional($oldApprovedAt)->toIso8601String(),
                    'newValue' => null,
                ],
                [
                    'field' => 'aprobado_por',
                    'label' => 'Aprobado por',
                    'oldValue' => $this->resolveUserName($oldApprovedBy),
                    'newValue' => null,
                ],
            ],
        ]);

        $this->notifyAgenteResponsable(
            $persona,
            'Se revirtió la aprobación y la solicitud volvió a revisión para %s.'
        );

        $persona->loadMissing([
            'cliente:id,nombre',
            'unidad:id,matricula,marca,modelo',
            'sucursal:id,nombre',
            'agente:id,name',
            'agenteResponsable:id,name',
            'estado:id,nombre',
        ]);

        AuditLogger::log($request, 'persona_disapprove', 'persona', $persona->id, [
            'aprobado' => false,
            'aprobado_at' => null,
            'aprobado_por' => null,
            'estado_id' => $persona->estado_id,
        ]);

        return response()->json([
            'message' => 'Aprobación revertida correctamente.',
            'data' => [
                'aprobado' => false,
                'aprobadoAt' => null,
                'aprobadoPorId' => null,
                'aprobadoPorNombre' => null,
                'esSolicitud' => (bool) $persona->es_solicitud,
                'personalRecord' => $this->transformPersonaListItem($persona),
            ],
        ]);
    }

    protected function notifyAgenteResponsable(Persona $persona, ?string $customMessageTemplate = null): bool
    {
        $responsableIds = collect($this->getResponsableIds($persona));

        if ($responsableIds->isEmpty() && $persona->agente_id) {
            $responsableIds->push($persona->agente_id);
        }

        if ($responsableIds->isEmpty()) {
            return false;
        }

        $nombreCompleto = trim(
            sprintf(
                '%s %s',
                $persona->nombres ?? '',
                $persona->apellidos ?? ''
            )
        );
        $personaLabel = $nombreCompleto !== '' ? $nombreCompleto : sprintf('ID #%d', $persona->id);

        $messageTemplate = $customMessageTemplate ?? 'Se registró una nueva solicitud de alta para %s.';
        $message = sprintf($messageTemplate, $personaLabel);

        $hasMessageColumn = Schema::hasColumn('notifications', 'message');
        $hasDescriptionColumn = Schema::hasColumn('notifications', 'description');
        $hasTypeColumn = Schema::hasColumn('notifications', 'type');
        $hasEntityTypeColumn = Schema::hasColumn('notifications', 'entity_type');
        $hasEntityIdColumn = Schema::hasColumn('notifications', 'entity_id');
        $hasMetadataColumn = Schema::hasColumn('notifications', 'metadata');

        $sent = false;

        foreach ($responsableIds as $userId) {
            $payload = [
                'user_id' => $userId,
            ];

            if ($hasMessageColumn) {
                $payload['message'] = $message;
            } elseif ($hasDescriptionColumn) {
                $payload['description'] = $message;
            }

            if ($hasTypeColumn) {
                $payload['type'] = 'personal_alta_registrada';
            }

            if ($hasEntityTypeColumn) {
                $payload['entity_type'] = 'persona';
            }

            if ($hasEntityIdColumn) {
                $payload['entity_id'] = $persona->id;
            }

            if ($hasMetadataColumn) {
                $payload['metadata'] = [
                    'persona_id' => $persona->id,
                    'nombres' => $persona->nombres,
                    'apellidos' => $persona->apellidos,
                    'agente_id' => $persona->agente_id,
                    'cliente_id' => $persona->cliente_id,
                    'patente' => $persona->patente,
                ];
            }

            try {
                Notification::create($payload);
                $sent = true;
            } catch (QueryException $exception) {
                report($exception);

                $fallbackPayload = [
                    'user_id' => $userId,
                ];

                if ($hasMessageColumn) {
                    $fallbackPayload['message'] = $message;
                } elseif ($hasDescriptionColumn) {
                    $fallbackPayload['description'] = $message;
                }

                if ($hasTypeColumn) {
                    $fallbackPayload['type'] = 'personal_alta_registrada';
                }

                try {
                    Notification::create($fallbackPayload);
                    $sent = true;
                } catch (QueryException $retryException) {
                    report($retryException);
                }
            }
        }

        return $sent;
    }

    protected function notifySolicitudAprobada(Persona $persona, int $userId, ?string $agenteNombre = null): void
    {
        $personaLabel = trim(
            sprintf(
                '%s %s',
                $persona->nombres ?? '',
                $persona->apellidos ?? ''
            )
        ) ?: sprintf('ID #%d', $persona->id);

        $message = $agenteNombre
            ? sprintf('¡Felicitaciones, %s! Se aprobó el alta de %s.', $agenteNombre, $personaLabel)
            : sprintf('¡Felicitaciones! Se aprobó el alta de %s.', $personaLabel);
        $detail = sprintf('El alta de %s ya está activa.', $personaLabel);

        $hasMessageColumn = Schema::hasColumn('notifications', 'message');
        $hasDescriptionColumn = Schema::hasColumn('notifications', 'description');
        $hasTypeColumn = Schema::hasColumn('notifications', 'type');
        $hasEntityTypeColumn = Schema::hasColumn('notifications', 'entity_type');
        $hasEntityIdColumn = Schema::hasColumn('notifications', 'entity_id');
        $hasMetadataColumn = Schema::hasColumn('notifications', 'metadata');

        $payload = [
            'user_id' => $userId,
        ];

        if ($hasMessageColumn) {
            $payload['message'] = $message;
        } elseif ($hasDescriptionColumn) {
            $payload['description'] = $message;
        }

        if ($hasTypeColumn) {
            $payload['type'] = 'personal_alta_aprobada';
        }

        if ($hasEntityTypeColumn) {
            $payload['entity_type'] = 'persona';
        }

        if ($hasEntityIdColumn) {
            $payload['entity_id'] = $persona->id;
        }

        if ($hasMetadataColumn) {
            $payload['metadata'] = [
                'persona_id' => $persona->id,
                'nombres' => $persona->nombres,
                'apellidos' => $persona->apellidos,
                'persona_full_name' => $personaLabel,
                'celebration' => true,
                'celebration_title' => '¡Felicitaciones!',
                'celebration_message' => $message,
                'celebration_detail' => $detail,
            ];

            if ($persona->agente?->name) {
                $payload['metadata']['agente_nombre'] = $persona->agente->name;
            }

            if ($agenteNombre) {
                $payload['metadata']['celebration_recipient'] = $agenteNombre;
            }
        }

        try {
            Notification::create($payload);
            return;
        } catch (QueryException $exception) {
            report($exception);
            Log::warning('Error creando notificación de aprobación (payload principal)', [
                'persona_id' => $persona->id,
                'recipient_user_id' => $userId,
                'error' => $exception->getMessage(),
            ]);
        }

        $fallbackPayload = [
            'user_id' => $userId,
        ];

        if ($hasMessageColumn) {
            $fallbackPayload['message'] = $message;
        } elseif ($hasDescriptionColumn) {
            $fallbackPayload['description'] = $message;
        }

        if ($hasTypeColumn) {
            $fallbackPayload['type'] = 'personal_alta_aprobada';
        }

        if ($hasEntityTypeColumn) {
            $fallbackPayload['entity_type'] = 'persona';
        }

        if ($hasEntityIdColumn) {
            $fallbackPayload['entity_id'] = $persona->id;
        }

        if ($hasMetadataColumn) {
            $fallbackPayload['metadata'] = [
                'persona_id' => $persona->id,
                'celebration' => true,
                'celebration_title' => '¡Felicitaciones!',
                'celebration_message' => $message,
                'celebration_detail' => $detail,
            ];

            if ($agenteNombre) {
                $fallbackPayload['metadata']['celebration_recipient'] = $agenteNombre;
            }
        }

        try {
            Notification::create($fallbackPayload);
        } catch (QueryException $exception) {
            report($exception);
            Log::error('No se pudo crear notificación de aprobación (payload fallback)', [
                'persona_id' => $persona->id,
                'recipient_user_id' => $userId,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    protected function buildPersonaDetail(Persona $persona, bool $includePending = false): array
    {
        $perfilMap = [
            1 => 'Dueño y chofer',
            2 => 'Chofer',
            3 => 'Transportista',
        ];
        $tipo = $persona->tipo;
        $perfilValue = $tipo !== null && $tipo !== '' ? (int) $tipo : null;
        $perfil = $perfilValue !== null ? ($perfilMap[$perfilValue] ?? 'Perfil '.$perfilValue) : null;
        $responsableIds = $this->getResponsableIds($persona);
        $responsableNames = $this->resolveResponsableNames($responsableIds);
        $duenoNombre = $persona->dueno?->nombreapellido;
        $duenoEmail = $persona->dueno?->email;
        $duenoCuil = $persona->dueno?->cuil;
        $duenoCuilCobrador = $persona->dueno?->cuil_cobrador;
        $duenoCbuAlias = $persona->dueno?->cbu_alias;
        $combustibleEstado = $persona->combustible_estado;
        $fechaBaja = $this->formatFechaAlta($persona->fecha_baja);

        $hasExplicitCobrador = (
            $persona->cobrador_nombre
            || $persona->cobrador_email
            || $persona->cobrador_cuil
            || $persona->cobrador_cbu_alias
        );
        $esCobrador = (bool) (
            ($persona->es_cobrador ?? false)
            || ($perfilValue === 2)
            || $hasExplicitCobrador
        );
        $cobradorNombre = $hasExplicitCobrador ? $persona->cobrador_nombre : null;
        $cobradorEmail = $hasExplicitCobrador ? $persona->cobrador_email : null;
        $cobradorCuil = $hasExplicitCobrador ? $persona->cobrador_cuil : null;
        $cobradorCbuAlias = $hasExplicitCobrador ? $persona->cobrador_cbu_alias : null;

        $documents = $persona->documentos;
        if (! $includePending) {
            $documents = $documents->reject(fn ($documento) => (bool) $documento->es_pendiente);
        }
        $documents = $documents->values();
        $facturasPorLiquidacion = Factura::query()
            ->whereIn('liquidacion_id', $documents->pluck('id')->all())
            ->orderByDesc('id')
            ->get()
            ->groupBy('liquidacion_id');

        return [
            'id' => $persona->id,
            'nombres' => $persona->nombres,
            'apellidos' => $persona->apellidos,
            'legajo' => $persona->legajo,
            'cuil' => $persona->cuil,
            'telefono' => $persona->telefono,
            'email' => $persona->email,
            'perfil' => $perfil,
            'perfilValue' => $perfilValue,
            'agente' => $persona->agente?->name,
            'agenteId' => $persona->agente_id,
            'agenteResponsable' => $persona->agenteResponsable?->name,
            'agenteResponsableId' => $persona->agente_responsable_id,
            'agentesResponsables' => $responsableNames,
            'agentesResponsablesIds' => $responsableIds,
            'cliente' => $persona->cliente?->nombre,
            'clienteId' => $persona->cliente_id,
            'sucursal' => $persona->sucursal?->nombre,
            'sucursalId' => $persona->sucursal_id,
            'unidad' => $persona->unidad?->matricula,
            'unidadDetalle' => $persona->unidad ? trim(($persona->unidad->marca ?? '') . ' ' . ($persona->unidad->modelo ?? '')) ?: null : null,
            'unidadId' => $persona->unidad_id,
            'estado' => $persona->estado?->nombre,
            'estadoId' => $persona->estado_id,
            'combustibleValue' => (bool) $persona->combustible,
            'combustibleEstado' => $combustibleEstado,
            'tarifaEspecialValue' => (bool) $persona->tarifaespecial,
            'pago' => $persona->pago !== null ? (string) $persona->pago : null,
            'cbuAlias' => $persona->cbu_alias,
            'patente' => $persona->patente,
            'observacionTarifa' => $persona->observaciontarifa,
            'observaciones' => $persona->observaciones,
            'esCobrador' => $esCobrador,
            'cobradorNombre' => $cobradorNombre,
            'cobradorEmail' => $cobradorEmail,
            'cobradorCuil' => $cobradorCuil,
            'cobradorCbuAlias' => $cobradorCbuAlias,
            'fechaAlta' => $this->formatFechaAlta($persona->fecha_alta),
            'fechaAltaVinculacion' => $this->formatFechaAlta($persona->fecha_alta),
            'fechaBaja' => $fechaBaja,
            'aprobado' => $persona->aprobado === null ? false : (bool) $persona->aprobado,
            'aprobadoAt' => optional($persona->aprobado_at)->toIso8601String(),
            'aprobadoPorId' => $persona->aprobado_por,
            'aprobadoPorNombre' => $persona->aprobadoPor?->name,
            'esSolicitud' => (bool) $persona->es_solicitud,
            'solicitudTipo' => $persona->es_solicitud ? 'alta' : null,
            'duenoNombre' => $persona->dueno?->nombreapellido,
            'duenoFechaNacimiento' => optional($persona->dueno?->fecha_nacimiento)->format('Y-m-d'),
            'duenoEmail' => $persona->dueno?->email,
            'duenoTelefono' => $persona->dueno?->telefono,
            'duenoCuil' => $persona->dueno?->cuil,
            'duenoCuilCobrador' => $persona->dueno?->cuil_cobrador,
            'duenoCbuAlias' => $persona->dueno?->cbu_alias,
            'duenoObservaciones' => $persona->dueno?->observaciones,
            'documentsDownloadAllUrl' => route('personal.documentos.descargarTodos', [
                'persona' => $persona->id,
            ], false),
            'documentsDownloadAllAbsoluteUrl' => route('personal.documentos.descargarTodos', [
                'persona' => $persona->id,
            ], true),
            'documents' => $documents->map(function ($documento) use ($facturasPorLiquidacion) {
                $factura = $facturasPorLiquidacion->get($documento->id)?->first();
                if (! $factura && ($documento->children?->isNotEmpty() ?? false)) {
                    $factura = $documento->children
                        ->map(fn ($child) => $facturasPorLiquidacion->get($child->id)?->first())
                        ->filter()
                        ->sortByDesc('id')
                        ->first();
                }
                $hasAttachments = $documento->parent_document_id === null
                    && ($documento->children?->isNotEmpty() ?? false);
                $relativeDownloadUrl = route('personal.documentos.descargar', [
                    'persona' => $documento->persona_id,
                    'documento' => $documento->id,
                ], false);

                $absoluteDownloadUrl = route('personal.documentos.descargar', [
                    'persona' => $documento->persona_id,
                    'documento' => $documento->id,
                ], true);

                $nombre = $documento->nombre_original ?? basename($documento->ruta ?? '');
                $importeCombustible = $this->resolveFuelAmountForDocument($documento, $nombre);

                return [
                    'id' => $documento->id,
                    'parentDocumentId' => $documento->parent_document_id,
                    'isAttachment' => $documento->parent_document_id !== null,
                    'nombre' => $nombre,
                    'sourceDownloadUrl' => $documento->download_url,
                    'downloadUrl' => $relativeDownloadUrl,
                    'absoluteDownloadUrl' => $absoluteDownloadUrl,
                    'mime' => $documento->mime,
                    'size' => $documento->size,
                    'sizeLabel' => $this->formatFileSize($documento->size),
                    'fechaCarga' => optional($documento->created_at)->format('Y-m-d'),
                    'fechaCargaIso' => optional($documento->created_at)->toIso8601String(),
                    'fechaVencimiento' => $this->formatFechaVencimiento($documento->fecha_vencimiento),
                    'tipoId' => $documento->tipo_archivo_id,
                    'tipoNombre' => $documento->tipo?->nombre,
                    'requiereVencimiento' => (bool) $documento->tipo?->vence,
                    'importeCombustible' => $importeCombustible,
                    'importeFacturar' => $documento->importe_facturar,
                    'pendiente' => (bool) $documento->es_pendiente,
                    'liquidacionId' => $documento->liquidacion_id,
                    'enviada' => (bool) $documento->enviada,
                    'recibido' => (bool) $documento->recibido,
                    'pagado' => (bool) $documento->pagado,
                    'validacionIaEstado' => $factura?->estado,
                    'validacionIaMotivo' => $factura?->decision_motivo,
                    'validacionIaMensaje' => $factura?->decision_mensaje,
                ];
            })->values(),
            'comments' => $persona->comments->map(function ($comment) {
                return [
                    'id' => $comment->id,
                    'message' => $comment->message,
                    'userId' => $comment->user_id,
                    'userName' => $comment->user?->name,
                    'createdAt' => $comment->created_at?->toIso8601String(),
                    'createdAtLabel' => $comment->created_at?->timezone(config('app.timezone', 'UTC'))?->format('d/m/Y H:i'),
                ];
            })->values(),
            'history' => $persona->histories->map(function ($history) {
                $changes = collect($history->changes ?? [])
                    ->map(function ($change) {
                        return [
                            'field' => $change['field'] ?? null,
                            'label' => $change['label'] ?? ($change['field'] ?? null),
                            'oldValue' => $change['oldValue'] ?? null,
                            'newValue' => $change['newValue'] ?? null,
                        ];
                    })
                    ->values();

                return [
                    'id' => $history->id,
                    'authorId' => $history->user_id,
                    'authorName' => $history->user?->name,
                    'description' => $history->description,
                    'createdAt' => $history->created_at?->toIso8601String(),
                    'createdAtLabel' => $history->created_at?->timezone(config('app.timezone', 'UTC'))?->format('d/m/Y H:i'),
                    'changes' => $changes,
                ];
            })->values(),
        ];
    }

    protected function transformPersonaListItem(Persona $persona): array
    {
        $latestLiquidacion = $persona->documentos?->first();
        $liquidacionEnviada = $latestLiquidacion ? (bool) $latestLiquidacion->enviada : null;
        $liquidacionRecibido = $latestLiquidacion ? (bool) $latestLiquidacion->recibido : null;
        $liquidacionPagado = $latestLiquidacion ? (bool) $latestLiquidacion->pagado : null;
        $liquidacionImporteFacturar = $latestLiquidacion?->importe_facturar;
        $liquidacionesResumen = collect($persona->documentos ?? [])
            ->filter(function (Archivo $documento) {
                return ! $documento->parent_document_id && $this->isLiquidacionDocument($documento);
            })
            ->map(function (Archivo $documento) {
                $date = $this->resolveDocumentDate($documento);
                $monthKey = $date ? $date->format('Y-m') : 'unknown';
                $fortnightKey = $date ? $this->determineFortnightKey($documento, $date) : 'NO_DATE';

                $recibido = (bool) $documento->recibido;

                return [
                    'id' => $documento->id,
                    'fecha' => $date ? $date->format('Y-m-d') : null,
                    'monthKey' => $monthKey,
                    'fortnightKey' => $fortnightKey,
                    'enviada' => (bool) $documento->enviada,
                    'recibido' => $recibido,
                    'pagado' => (bool) $documento->pagado,
                    'importeFacturar' => $documento->importe_facturar,
                ];
            })
            ->values();
        $perfilMap = [
            1 => 'Dueño y chofer',
            2 => 'Chofer',
            3 => 'Transportista',
        ];
        $perfil = $persona->tipo !== null ? ($perfilMap[$persona->tipo] ?? 'Perfil '.$persona->tipo) : null;
        $aprobadoValor = $persona->aprobado;
        $aprobado = $aprobadoValor === null ? false : (bool) $aprobadoValor;
        $responsableIds = $this->getResponsableIds($persona);
        $responsableNames = $this->resolveResponsableNames($responsableIds);
        $duenoNombre = $persona->dueno?->nombreapellido;
        $duenoEmail = $persona->dueno?->email;
        $duenoCuil = $persona->dueno?->cuil;
        $duenoCuilCobrador = $persona->dueno?->cuil_cobrador;
        $duenoCbuAlias = $persona->dueno?->cbu_alias;
        $combustibleEstado = $persona->combustible_estado;
        $fechaBaja = $this->formatFechaAlta($persona->fecha_baja);

        $hasExplicitCobrador = (
            $persona->cobrador_nombre
            || $persona->cobrador_email
            || $persona->cobrador_cuil
            || $persona->cobrador_cbu_alias
        );
        $esCobrador = (bool) (
            ($persona->es_cobrador ?? false)
            || ($persona->tipo === 2)
            || $hasExplicitCobrador
        );
        $cobradorNombre = $hasExplicitCobrador ? $persona->cobrador_nombre : null;
        $cobradorEmail = $hasExplicitCobrador ? $persona->cobrador_email : null;
        $cobradorCuil = $hasExplicitCobrador ? $persona->cobrador_cuil : null;
        $cobradorCbuAlias = $hasExplicitCobrador ? $persona->cobrador_cbu_alias : null;
        $documentacionStatus = $this->resolveDocumentacionStatus($persona);

        return [
            'id' => $persona->id,
            'nombre' => trim(($persona->nombres ?? '') . ' ' . ($persona->apellidos ?? '')) ?: null,
            'nombres' => $persona->nombres,
            'apellidos' => $persona->apellidos,
            'legajo' => $persona->legajo,
            'cuil' => $persona->cuil,
            'telefono' => $persona->telefono,
            'email' => $persona->email,
            'cliente' => $persona->cliente?->nombre,
            'clienteId' => $persona->cliente_id,
            'unidad' => $persona->unidad?->matricula,
            'unidadDetalle' => $persona->unidad ? trim(($persona->unidad->marca ?? '') . ' ' . ($persona->unidad->modelo ?? '')) ?: null : null,
            'unidadId' => $persona->unidad_id,
            'fechaAlta' => $this->formatFechaAlta($persona->fecha_alta),
            'fechaAltaVinculacion' => $this->formatFechaAlta($persona->fecha_alta),
            'fechaBaja' => $fechaBaja,
            'sucursal' => $persona->sucursal?->nombre,
            'sucursalId' => $persona->sucursal_id,
            'perfil' => $perfil,
            'perfilValue' => $persona->tipo,
            'agente' => $persona->agente?->name,
            'agenteId' => $persona->agente_id,
            'agenteResponsable' => $persona->agenteResponsable?->name,
            'agenteResponsableId' => $persona->agente_responsable_id,
            'agentesResponsables' => $responsableNames,
            'agentesResponsablesIds' => $responsableIds,
            'estado' => $persona->estado?->nombre,
            'estadoId' => $persona->estado_id,
            'combustible' => $persona->combustible ? 'Sí' : 'No',
            'combustibleValue' => (bool) $persona->combustible,
            'combustibleEstado' => $combustibleEstado,
            'tarifaEspecial' => $persona->tarifaespecial ? 'Sí' : 'No',
            'tarifaEspecialValue' => (bool) $persona->tarifaespecial,
            'pago' => $persona->pago !== null ? (string) $persona->pago : null,
            'cbuAlias' => $persona->cbu_alias,
            'patente' => $persona->patente,
            'observacionTarifa' => $persona->observaciontarifa,
            'observaciones' => $persona->observaciones,
            'esCobrador' => $esCobrador,
            'cobradorNombre' => $cobradorNombre,
            'cobradorEmail' => $cobradorEmail,
            'cobradorCuil' => $cobradorCuil,
            'cobradorCbuAlias' => $cobradorCbuAlias,
            'aprobado' => $aprobado,
            'aprobadoAt' => optional($persona->aprobado_at)->format('Y-m-d H:i:s'),
            'aprobadoPor' => $persona->aprobadoPor?->name,
            'aprobadoPorId' => $persona->aprobado_por,
            'esSolicitud' => (bool) $persona->es_solicitud,
            'solicitudTipo' => $persona->es_solicitud ? 'alta' : null,
            'duenoNombre' => $persona->dueno?->nombreapellido,
            'duenoFechaNacimiento' => optional($persona->dueno?->fecha_nacimiento)->format('Y-m-d'),
            'duenoEmail' => $persona->dueno?->email,
            'duenoTelefono' => $persona->dueno?->telefono,
            'duenoCuil' => $persona->dueno?->cuil,
            'duenoCuilCobrador' => $persona->dueno?->cuil_cobrador,
            'duenoCbuAlias' => $persona->dueno?->cbu_alias,
            'duenoObservaciones' => $persona->dueno?->observaciones,
            'liquidacionPeriods' => $this->buildLiquidacionPeriods($persona->documentos ?? []),
            'liquidacionEnviada' => $liquidacionEnviada,
            'liquidacionRecibido' => $liquidacionRecibido,
            'liquidacionPagado' => $liquidacionPagado,
            'liquidacionIdLatest' => $latestLiquidacion?->id,
            'liquidacionImporteFacturar' => $liquidacionImporteFacturar,
            'liquidaciones' => $liquidacionesResumen,
            'documentacionStatus' => $documentacionStatus['status'],
            'documentacionVencidos' => $documentacionStatus['vencidos'],
            'documentacionPorVencer' => $documentacionStatus['porVencer'],
            'documentacionTotal' => $documentacionStatus['total'],
        ];
    }

    protected function resolveLiquidacionTypeIds(): \Illuminate\Support\Collection
    {
        return FileType::query()
            ->select('id', 'nombre')
            ->get()
            ->filter(function (FileType $tipo) {
                $nombre = Str::lower($tipo->nombre ?? '');
                return $nombre !== '' && Str::contains($nombre, 'liquid');
            })
            ->pluck('id');
    }

    protected function resolveDocumentacionStatus(Persona $persona): array
    {
        $documents = $persona->documentosVencimientos ?? collect();
        $total = 0;
        $expired = 0;
        $expiring = 0;
        $today = Carbon::today();
        $warningDate = $today->copy()->addDays(30);

        foreach ($documents as $documento) {
            $expiry = $documento->fecha_vencimiento ?? null;
            if (! $expiry) {
                continue;
            }
            $expiryDate = $expiry instanceof Carbon ? $expiry : Carbon::parse($expiry);
            $total++;
            if ($expiryDate->lt($today)) {
                $expired++;
            } elseif ($expiryDate->lte($warningDate)) {
                $expiring++;
            }
        }

        $status = 'sin_documentos';
        if ($total > 0) {
            if ($expired > 0) {
                $status = 'vencido';
            } elseif ($expiring > 0) {
                $status = 'por_vencer';
            } else {
                $status = 'vigente';
            }
        }

        return [
            'status' => $status,
            'vencidos' => $expired,
            'porVencer' => $expiring,
            'total' => $total,
        ];
    }

    protected function formatFechaVencimiento($value): ?string
    {
        if (! $value) {
            return null;
        }
        if ($value instanceof Carbon) {
            return $value->format('Y-m-d');
        }
        try {
            return Carbon::parse($value)->format('Y-m-d');
        } catch (\Throwable $exception) {
            return null;
        }
    }

    protected function resolveFuelTypeIds(): \Illuminate\Support\Collection
    {
        return FileType::query()
            ->select('id', 'nombre')
            ->get()
            ->filter(function (FileType $tipo) {
                $nombre = Str::lower($tipo->nombre ?? '');
                return $nombre !== '' && Str::contains($nombre, 'combust');
            })
            ->pluck('id');
    }

    protected function isLiquidacionDocument(Archivo $document): bool
    {
        $typeName = Str::lower($document->tipo?->nombre ?? '');
        $name = Str::lower($document->nombre_original ?? '');

        return Str::contains($typeName, 'liquid') || Str::contains($name, 'liquid');
    }

    protected function buildLiquidacionPeriods(iterable $documents): array
    {
        $periods = [];
        $seen = [];

        foreach ($documents as $document) {
            if ($document->parent_document_id) {
                continue;
            }

            $date = $this->resolveDocumentDate($document);
            if (! $date) {
                continue;
            }

            $monthKey = $date->format('Y-m');
            $fortnightKey = $this->determineFortnightKey($document, $date);
            $key = "{$monthKey}|{$fortnightKey}";

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $periods[] = [
                'monthKey' => $monthKey,
                'fortnightKey' => $fortnightKey,
            ];
        }

        return $periods;
    }

    protected function parseFuelAmount(?string $name): ?float
    {
        if (! $name) {
            return null;
        }

        if (! preg_match('/\\$\\s*([\\d.,]+)/', $name, $matches)) {
            return null;
        }

        $raw = trim($matches[1]);
        if ($raw === '') {
            return null;
        }

        $normalized = $raw;
        if (str_contains($normalized, ',') && str_contains($normalized, '.')) {
            $normalized = str_replace('.', '', $normalized);
            $normalized = str_replace(',', '.', $normalized);
        } elseif (str_contains($normalized, ',')) {
            $normalized = str_replace(',', '.', $normalized);
        }

        return is_numeric($normalized) ? (float) $normalized : null;
    }

    protected function resolveFuelAmountForDocument(Archivo $documento, ?string $nombre): ?float
    {
        if ($documento->parent_document_id) {
            return null;
        }

        $fromChildren = $documento->children
            ? $documento->children
                ->filter(function (Archivo $child) {
                    $typeName = Str::lower($child->tipo?->nombre ?? '');
                    $name = Str::lower($child->nombre_original ?? '');
                    return Str::contains($typeName, 'combust') || Str::contains($name, 'combust');
                })
                ->map(function (Archivo $child) {
                    return $this->parseFuelAmount($child->nombre_original ?? '');
                })
                ->filter()
                ->values()
            : collect();

        if ($fromChildren->isNotEmpty()) {
            return $fromChildren->sum();
        }

        return $this->parseFuelAmount($nombre);
    }

    protected function resolveDocumentDate(Archivo $document): ?Carbon
    {
        if ($document->fecha_vencimiento) {
            return Carbon::parse($document->fecha_vencimiento);
        }

        return $document->created_at;
    }

    protected function determineFortnightKey(Archivo $document, Carbon $date): string
    {
        if (in_array($document->fortnight_key ?? null, ['Q1', 'Q2', 'MONTHLY'], true)) {
            return $document->fortnight_key;
        }

        if ($this->isMonthlyDocument($document)) {
            return 'MONTHLY';
        }

        return $date->day <= 15 ? 'Q1' : 'Q2';
    }

    protected function isMonthlyDocument(Archivo $document): bool
    {
        $descriptor = trim(($document->tipo?->nombre ?? '') . ' ' . ($document->nombre_original ?? ''));
        $normalized = Str::lower($descriptor);

        return Str::contains($normalized, 'mensual') || Str::contains($normalized, 'mes completo');
    }

    protected function formatFechaAlta($value): ?string
    {
        if (! $value) {
            return null;
        }

        if ($value instanceof Carbon) {
            return $value->format('Y-m-d');
        }

        try {
            return Carbon::parse($value)->format('Y-m-d');
        } catch (\Throwable $exception) {
            report($exception);
            return null;
        }
    }

    protected function formatFileSize(?int $bytes): string
    {
        if (! $bytes || $bytes <= 0) {
            return '—';
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $index = 0;
        $size = (float) $bytes;

        while ($size >= 1024 && $index < count($units) - 1) {
            $size /= 1024;
            $index++;
        }

        $formatted = $index === 0 ? (string) round($size) : number_format($size, 1, ',', '.');

        return sprintf('%s %s', $formatted, $units[$index]);
    }

    protected function getPersonaHistoryFieldDefinitions(): array
    {
        return [
            'nombres' => ['label' => 'Nombre'],
            'apellidos' => ['label' => 'Apellido'],
            'legajo' => ['label' => 'Legajo'],
            'cuil' => ['label' => 'CUIL'],
            'telefono' => ['label' => 'Teléfono'],
            'email' => ['label' => 'Email'],
            'tipo' => [
                'label' => 'Perfil',
                'formatter' => fn ($value) => $this->resolvePerfilLabel($value),
                'normalizer' => function ($value) {
                    return $value === null || $value === '' ? null : (int) $value;
                },
            ],
            'agente_id' => [
                'label' => 'Agente',
                'formatter' => fn ($value) => $this->resolveUserName($value),
            ],
            'agente_responsable_id' => [
                'label' => 'Agente responsable',
                'formatter' => fn ($value) => $this->resolveUserName($value),
            ],
            'agentes_responsables_ids' => [
                'label' => 'Agentes responsables',
                'formatter' => function ($value) {
                    $ids = $this->normalizeResponsableIds($value);
                    if (empty($ids)) {
                        return null;
                    }

                    $names = $this->resolveResponsableNames($ids);
                    return !empty($names) ? implode(' · ', $names) : implode(', ', $ids);
                },
                'normalizer' => function ($value) {
                    $ids = $this->normalizeResponsableIds($value);
                    sort($ids);
                    return empty($ids) ? null : $ids;
                },
            ],
            'cliente_id' => [
                'label' => 'Cliente',
                'formatter' => fn ($value) => $this->resolveClienteName($value),
            ],
            'sucursal_id' => [
                'label' => 'Sucursal',
                'formatter' => fn ($value) => $this->resolveSucursalName($value),
            ],
            'unidad_id' => [
                'label' => 'Unidad',
                'formatter' => fn ($value) => $this->resolveUnidadLabel($value),
            ],
            'estado_id' => [
                'label' => 'Estado',
                'formatter' => fn ($value) => $this->resolveEstadoName($value),
            ],
            'pago' => ['label' => 'Pago pactado'],
            'cbu_alias' => ['label' => 'CBU / Alias'],
            'patente' => ['label' => 'Patente'],
            'combustible_estado' => [
                'label' => 'Estado combustible',
                'formatter' => fn ($value) => $value ? ucfirst((string) $value) : null,
            ],
            'es_cobrador' => [
                'label' => 'Es cobrador',
                'type' => 'boolean',
            ],
            'cobrador_nombre' => ['label' => 'Nombre del cobrador'],
            'cobrador_email' => ['label' => 'Correo del cobrador'],
            'cobrador_cuil' => ['label' => 'CUIL del cobrador'],
            'cobrador_cbu_alias' => ['label' => 'CBU/Alias del cobrador'],
            'observaciontarifa' => ['label' => 'Observación tarifa'],
            'observaciones' => ['label' => 'Observaciones'],
            'fecha_alta' => [
                'label' => 'Fecha de alta',
                'type' => 'date',
            ],
            'fecha_baja' => [
                'label' => 'Fecha de baja',
                'type' => 'date',
            ],
            'combustible' => [
                'label' => 'Combustible',
                'type' => 'boolean',
            ],
            'tarifaespecial' => [
                'label' => 'Tarifa especial',
                'type' => 'boolean',
            ],
        ];
    }

    protected function getPersonaOwnerHistoryFieldDefinitions(): array
    {
        return [
            'nombreapellido' => ['label' => 'Dueño nombre'],
            'fecha_nacimiento' => [
                'label' => 'Dueño fecha de nacimiento',
                'type' => 'date',
            ],
            'email' => ['label' => 'Dueño correo'],
            'telefono' => ['label' => 'Dueño teléfono'],
            'cuil' => ['label' => 'Dueño CUIL'],
            'cuil_cobrador' => ['label' => 'Dueño CUIL cobrador'],
            'cbu_alias' => ['label' => 'Dueño CBU alias'],
            'observaciones' => ['label' => 'Dueño observaciones'],
        ];
    }

    protected function capturePersonaHistorySnapshot(Persona $persona, array $definitions): array
    {
        $snapshot = [];

        foreach (array_keys($definitions) as $attribute) {
            $snapshot[$attribute] = $persona->{$attribute};
        }

        return $snapshot;
    }

    protected function capturePersonaOwnerHistorySnapshot($owner, array $definitions): array
    {
        $snapshot = [];

        foreach (array_keys($definitions) as $attribute) {
            $snapshot[$attribute] = $owner ? $owner->{$attribute} : null;
        }

        return $snapshot;
    }

    protected function computeHistoryChanges(array $definitions, array $original, array $current): array
    {
        $changes = [];

        foreach ($definitions as $attribute => $definition) {
            $label = $definition['label'] ?? ucfirst(str_replace('_', ' ', $attribute));
            $previousValue = $original[$attribute] ?? null;
            $currentValue = $current[$attribute] ?? null;

            if ($this->historyValuesAreEqual($previousValue, $currentValue, $definition)) {
                continue;
            }

            $changes[] = [
                'field' => $attribute,
                'label' => $label,
                'oldValue' => $this->formatHistoryValue($previousValue, $definition),
                'newValue' => $this->formatHistoryValue($currentValue, $definition),
            ];
        }

        return array_values($changes);
    }

    protected function historyValuesAreEqual($oldValue, $newValue, array $definition): bool
    {
        $normalizedOld = $this->normalizeHistoryValue($oldValue, $definition);
        $normalizedNew = $this->normalizeHistoryValue($newValue, $definition);

        if ($normalizedOld === $normalizedNew) {
            return true;
        }

        return $normalizedOld === null && $normalizedNew === null;
    }

    protected function normalizeHistoryValue($value, array $definition)
    {
        if (array_key_exists('normalizer', $definition) && is_callable($definition['normalizer'])) {
            return $definition['normalizer']($value);
        }

        if (($definition['type'] ?? null) === 'boolean') {
            return $value ? 1 : 0;
        }

        if (($definition['type'] ?? null) === 'date') {
            if (! $value) {
                return null;
            }

            try {
                return Carbon::parse($value)->format('Y-m-d');
            } catch (\Throwable $exception) {
                return (string) $value;
            }
        }

        if ($value === null) {
            return null;
        }

        if (is_numeric($value)) {
            return (string) (0 + $value);
        }

        if ($value instanceof Carbon) {
            return $value->format('Y-m-d H:i:s');
        }

        if (is_string($value)) {
            $trimmed = trim($value);
            return $trimmed === '' ? null : $trimmed;
        }

        return (string) $value;
    }

    protected function formatHistoryValue($value, array $definition): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (array_key_exists('formatter', $definition) && is_callable($definition['formatter'])) {
            $formatted = $definition['formatter']($value);
            if ($formatted !== null && $formatted !== '') {
                return $formatted;
            }
        }

        if (($definition['type'] ?? null) === 'boolean') {
            return in_array($value, [true, 1, '1'], true) ? 'Sí' : 'No';
        }

        if (($definition['type'] ?? null) === 'date') {
            try {
                return Carbon::parse($value)->format('Y-m-d');
            } catch (\Throwable $exception) {
                return (string) $value;
            }
        }

        if (is_numeric($value)) {
            return (string) (0 + $value);
        }

        if ($value instanceof Carbon) {
            return $value->format('Y-m-d H:i:s');
        }

        if (is_string($value)) {
            $trimmed = trim($value);
            return $trimmed === '' ? null : $trimmed;
        }

        return (string) $value;
    }

    protected function resolvePerfilLabel($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $perfilMap = [
            1 => 'Dueño y chofer',
            2 => 'Chofer',
            3 => 'Transportista',
        ];

        $intValue = (int) $value;

        return $perfilMap[$intValue] ?? ('Perfil '.$intValue);
    }

    protected function normalizeResponsableIds($value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return collect($value)
            ->filter(fn ($id) => $id !== null && $id !== '')
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->values()
            ->all();
    }

    protected function getResponsableIds(Persona $persona): array
    {
        return collect($persona->agentes_responsables_ids ?? [])
            ->prepend($persona->agente_responsable_id)
            ->filter(fn ($id) => $id !== null)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }

    protected function resolveResponsableNames(array $ids): array
    {
        return collect($ids)
            ->map(fn ($id) => $this->resolveUserName($id))
            ->filter()
            ->values()
            ->all();
    }

    protected function resolveUserName(?int $id): ?string
    {
        if (! $id) {
            return null;
        }

        static $cache = [];

        if (array_key_exists($id, $cache)) {
            return $cache[$id];
        }

        $cache[$id] = User::query()->select('id', 'name')->find($id)?->name;

        return $cache[$id];
    }

    protected function resolveClienteName(?int $id): ?string
    {
        if (! $id) {
            return null;
        }

        static $cache = [];

        if (array_key_exists($id, $cache)) {
            return $cache[$id];
        }

        $cache[$id] = Cliente::query()->select('id', 'nombre')->find($id)?->nombre;

        return $cache[$id] ?? sprintf('Cliente #%d', $id);
    }

    protected function resolveSucursalName(?int $id): ?string
    {
        if (! $id) {
            return null;
        }

        static $cache = [];

        if (array_key_exists($id, $cache)) {
            return $cache[$id];
        }

        $cache[$id] = Sucursal::query()->select('id', 'nombre')->find($id)?->nombre;

        return $cache[$id] ?? sprintf('Sucursal #%d', $id);
    }

    protected function resolveUnidadLabel(?int $id): ?string
    {
        if (! $id) {
            return null;
        }

        static $cache = [];

        if (array_key_exists($id, $cache)) {
            return $cache[$id];
        }

        $unidad = Unidad::query()->select('id', 'matricula', 'marca', 'modelo')->find($id);

        if (! $unidad) {
            $cache[$id] = sprintf('Unidad #%d', $id);
            return $cache[$id];
        }

        $parts = array_filter([
            $unidad->matricula,
            $unidad->marca,
            $unidad->modelo,
        ], fn ($value) => $value !== null && $value !== '');

        $label = $parts ? implode(' · ', $parts) : sprintf('Unidad #%d', $unidad->id);

        $cache[$id] = $label;

        return $cache[$id];
    }

    protected function resolveEstadoName(?int $id): ?string
    {
        if (! $id) {
            return null;
        }

        static $cache = [];

        if (array_key_exists($id, $cache)) {
            return $cache[$id];
        }

        $cache[$id] = Estado::query()->select('id', 'nombre')->find($id)?->nombre;

        return $cache[$id] ?? sprintf('Estado #%d', $id);
    }
}

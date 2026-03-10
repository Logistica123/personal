<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\Estado;
use App\Models\Notification;
use App\Models\Persona;
use App\Models\Reclamo;
use App\Models\ReclamoDocument;
use App\Models\ReclamoType;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ReclamoController extends Controller
{
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
            $request->input('creatorId'),
            $request->input('agenteId'),
            $request->input('actorId'),
            $request->input('userId'),
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

        return null;
    }

    protected function reclamosAdelantosApproverEmails(): array
    {
        static $emails = null;

        if ($emails !== null) {
            return $emails;
        }

        $raw = (string) config('services.reclamos_adelantos.approver_emails', '');
        $emails = collect(explode(',', $raw))
            ->map(fn ($value) => strtolower(trim((string) $value)))
            ->filter(fn ($value) => $value !== '')
            ->values()
            ->all();

        return $emails;
    }

    protected function canEditReclamosAdelantosApproval(Request $request): bool
    {
        $actorEmail = $this->resolveActorEmail($request);
        if ($actorEmail && in_array($actorEmail, $this->reclamosAdelantosApproverEmails(), true)) {
            return true;
        }

        $nameCandidates = [
            $request->user()?->name,
            $request->input('actorName'),
            $request->input('userName'),
        ];

        foreach ($nameCandidates as $candidate) {
            if (! is_string($candidate)) {
                continue;
            }
            $normalized = Str::of($candidate)->ascii()->lower()->trim()->toString();
            if ($normalized !== '' && Str::contains($normalized, 'seba')) {
                return true;
            }
        }

        return false;
    }

    protected function normalizeNullableString($value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $normalized = trim($value);
        return $normalized !== '' ? $normalized : null;
    }

    protected function normalizeNullableCuit($value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $value) ?? '';
        return $digits !== '' ? $digits : null;
    }

    protected function normalizeAprobacionEstado($value): ?string
    {
        $normalized = Str::of((string) $value)->ascii()->lower()->trim()->toString();
        if ($normalized === '') {
            return null;
        }
        if ($normalized === 'aprobado') {
            return 'aprobado';
        }
        if ($normalized === 'no_aprobado' || $normalized === 'no aprobado') {
            return 'no_aprobado';
        }

        return null;
    }

    protected function canMutateLockedValue($current, $incoming): bool
    {
        $currentNormalized = $this->normalizeNullableString(is_numeric($current) ? (string) $current : $current);
        $incomingNormalized = $this->normalizeNullableString(is_numeric($incoming) ? (string) $incoming : $incoming);

        if ($currentNormalized === null) {
            return true;
        }

        return $currentNormalized === $incomingNormalized;
    }

    protected function isReclamosYAdelantosType(?ReclamoType $type = null, ?int $typeId = null): bool
    {
        $resolvedType = $type;
        if (! $resolvedType && $typeId) {
            $resolvedType = ReclamoType::query()->select('id', 'nombre', 'slug')->find($typeId);
        }

        $slug = Str::of((string) ($resolvedType?->slug ?? ''))->ascii()->lower()->trim()->toString();
        if ($slug === 'reclamos-y-adelantos') {
            return true;
        }

        $normalizedName = Str::of((string) ($resolvedType?->nombre ?? ''))
            ->ascii()
            ->lower()
            ->replace(['_', '-'], ' ')
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->toString();

        return $normalizedName === 'reclamos y adelantos';
    }

    protected function requireReclamosAdelantosBaseFields(array $validated): void
    {
        $labels = [
            'clienteNombre' => 'cliente',
            'sucursalNombre' => 'sucursal',
            'distribuidorNombre' => 'nombre distribuidor',
            'emisorFactura' => 'dueño de la unidad / emisor de la factura',
            'importeSolicitado' => 'importe solicitado',
            'cuitCobrador' => 'CUIT cobrador',
            'medioPago' => 'medio de pago',
            'concepto' => 'concepto',
        ];

        $errors = [];
        foreach ($labels as $key => $label) {
            $value = $validated[$key] ?? null;
            $isMissing = is_numeric($value)
                ? false
                : $this->normalizeNullableString((string) $value) === null;

            if ($value === null || $isMissing) {
                $errors[$key] = ["El campo {$label} es obligatorio para Reclamos y Adelantos."];
            }
        }

        if (! empty($errors)) {
            throw \Illuminate\Validation\ValidationException::withMessages($errors);
        }
    }

    protected function aprobacionEstadoLabel(?string $value): ?string
    {
        if ($value === 'aprobado') {
            return 'Aprobado';
        }
        if ($value === 'no_aprobado') {
            return 'No aprobado';
        }

        return null;
    }

    protected function loadReclamoIndexRelations(Reclamo $reclamo): Reclamo
    {
        return $reclamo->loadMissing([
            'creator:id,name',
            'agente:id,name',
            'tipo:id,nombre,slug',
            'persona' => fn ($query) => $query->select(
                'id',
                'nombres',
                'apellidos',
                'cliente_id',
                'patente'
            ),
            'persona.cliente:id,nombre',
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $canViewImportes = $this->canViewReclamoImportes($request);

        $reclamos = Reclamo::query()
            ->with([
                'creator:id,name',
                'agente:id,name',
                'tipo:id,nombre,slug',
                'persona' => fn ($query) => $query->select(
                    'id',
                    'nombres',
                    'apellidos',
                    'cliente_id',
                    'patente'
                ),
                'persona.cliente:id,nombre',
            ])
            ->orderByDesc('fecha_alta')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Reclamo $reclamo) => $this->transformReclamo($reclamo, false, $canViewImportes))
            ->values();

        return response()->json(['data' => $reclamos]);
    }

    public function distriappIndex(Request $request): JsonResponse
    {
        $canViewImportes = $this->canViewReclamoImportes($request);

        $validated = $request->validate([
            'personaId' => ['nullable', 'integer', 'exists:personas,id'],
            'cuil' => ['nullable', 'string', 'max:32'],
            'status' => ['nullable', Rule::in(array_keys($this->statusLabels()))],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $filters = collect($validated);
        $query = Reclamo::query()
            ->with([
                'creator:id,name',
                'agente:id,name',
                'tipo:id,nombre,slug',
                'persona' => fn ($personaQuery) => $personaQuery->select(
                    'id',
                    'nombres',
                    'apellidos',
                    'cliente_id',
                    'cuil',
                    'patente'
                ),
                'persona.cliente:id,nombre',
            ]);

        if ($filters->has('personaId') && $filters->get('personaId')) {
            $query->where('persona_id', $filters->get('personaId'));
        }

        if ($filters->has('cuil') && $filters->get('cuil') !== null && $filters->get('cuil') !== '') {
            $rawCuil = (string) $filters->get('cuil');
            $normalizedCuil = preg_replace('/\D+/', '', $rawCuil);

            $query->whereHas('persona', function ($personaQuery) use ($normalizedCuil, $rawCuil) {
                if ($normalizedCuil !== '') {
                    $personaQuery->whereRaw(
                        "REPLACE(REPLACE(REPLACE(IFNULL(cuil, ''), '-', ''), '.', ''), ' ', '') = ?",
                        [$normalizedCuil]
                    );
                } else {
                    $personaQuery->where('cuil', $rawCuil);
                }
            });
        }

        if ($filters->has('status') && $filters->get('status')) {
            $query->where('status', $filters->get('status'));
        }

        $limit = (int) ($filters->get('limit') ?: 50);

        $reclamos = $query
            ->orderByDesc('fecha_alta')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn (Reclamo $reclamo) => $this->transformReclamo($reclamo, false, $canViewImportes))
            ->values();

        return response()->json([
            'data' => $reclamos,
            'meta' => [
                'appliedFilters' => [
                    'personaId' => $filters->get('personaId'),
                    'cuil' => $filters->get('cuil'),
                    'status' => $filters->get('status'),
                    'limit' => $limit,
                ],
            ],
        ]);
    }

    public function meta(): JsonResponse
    {
        $agentes = User::query()
            ->select('id', 'name')
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'nombre' => $user->name,
            ])
            ->values();

        $transportistas = Persona::query()
            ->select('id', 'nombres', 'apellidos')
            ->where(function ($query) {
                $query
                    ->whereNull('es_solicitud')
                    ->orWhere('es_solicitud', false);
            })
            ->orderBy('apellidos')
            ->orderBy('nombres')
            ->get()
            ->map(fn (Persona $persona) => [
                'id' => $persona->id,
                'nombre' => trim(($persona->nombres ?? '').' '.($persona->apellidos ?? '')) ?: 'Sin nombre',
            ])
            ->values();

        $clientes = Cliente::query()
            ->select('id', 'nombre')
            ->orderBy('nombre')
            ->get()
            ->map(fn (Cliente $cliente) => [
                'id' => $cliente->id,
                'nombre' => $cliente->nombre,
            ])
            ->values();

        $tipos = ReclamoType::query()
            ->select('id', 'nombre', 'slug')
            ->orderBy('nombre')
            ->get()
            ->map(fn (ReclamoType $tipo) => [
                'id' => $tipo->id,
                'nombre' => $tipo->nombre,
                'slug' => $tipo->slug,
            ])
            ->values();

        $estados = collect($this->statusLabels())
            ->map(fn (string $label, string $value) => [
                'value' => $value,
                'label' => $label,
            ])
            ->values();

        return response()->json([
            'data' => [
                'agentes' => $agentes,
                'creadores' => $agentes,
                'transportistas' => $transportistas,
                'clientes' => $clientes,
                'tipos' => $tipos,
                'estados' => $estados,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $canViewImportes = $this->canViewReclamoImportes($request);

        $validated = $request->validate([
            'detalle' => ['nullable', 'string'],
            'agenteId' => ['nullable', 'integer', 'exists:users,id'],
            'creatorId' => ['nullable', 'integer', 'exists:users,id'],
            'transportistaId' => ['nullable', 'integer', 'exists:personas,id'],
            'tipoId' => ['required', 'integer', 'exists:reclamo_types,id'],
            'status' => ['required', Rule::in(array_keys($this->statusLabels()))],
            'pagado' => ['required', 'boolean'],
            'importePagado' => [
                'nullable',
                'numeric',
                'min:0',
                Rule::requiredIf(fn () => $canViewImportes && (bool) $request->input('pagado')),
            ],
            'importeFacturado' => ['nullable', 'numeric', 'min:0'],
            'fechaReclamo' => ['nullable', 'date'],
            'clienteNombre' => ['nullable', 'string', 'max:255'],
            'sucursalNombre' => ['nullable', 'string', 'max:255'],
            'distribuidorNombre' => ['nullable', 'string', 'max:255'],
            'emisorFactura' => ['nullable', 'string', 'max:255'],
            'importeSolicitado' => ['nullable', 'numeric', 'min:0'],
            'cuitCobrador' => ['nullable', 'string', 'max:32'],
            'medioPago' => ['nullable', 'string', 'max:120'],
            'concepto' => ['nullable', 'string', 'max:2000'],
            'fechaCompromisoPago' => ['nullable', 'date'],
            'aprobacionEstado' => ['nullable', Rule::in(['aprobado', 'no_aprobado'])],
            'aprobacionMotivo' => ['nullable', 'string', 'max:2000'],
        ]);

        $tipo = ReclamoType::query()->select('id', 'nombre', 'slug')->find((int) $validated['tipoId']);
        $isReclamoAdelanto = $this->isReclamosYAdelantosType($tipo, (int) $validated['tipoId']);

        if ($isReclamoAdelanto) {
            $this->requireReclamosAdelantosBaseFields($validated);
        } elseif (empty($validated['transportistaId'])) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'transportistaId' => ['El transportista es obligatorio para este tipo de reclamo.'],
            ]);
        }

        $reclamo = DB::transaction(function () use ($request, $validated, $canViewImportes, $isReclamoAdelanto) {
            /** @var \App\Models\User|null $authenticated */
            $authenticated = $request->user();
            $creatorId = $validated['creatorId'] ?? $authenticated?->id ?? null;

            $reclamo = Reclamo::create([
                'creator_id' => $creatorId,
                'agente_id' => $validated['agenteId'] ?? null,
                'persona_id' => $validated['transportistaId'] ?? null,
                'reclamo_type_id' => $validated['tipoId'],
                'detalle' => isset($validated['detalle']) ? trim($validated['detalle']) : null,
                'cliente_nombre' => $this->normalizeNullableString($validated['clienteNombre'] ?? null),
                'sucursal_nombre' => $this->normalizeNullableString($validated['sucursalNombre'] ?? null),
                'distribuidor_nombre' => $this->normalizeNullableString($validated['distribuidorNombre'] ?? null),
                'emisor_factura' => $this->normalizeNullableString($validated['emisorFactura'] ?? null),
                'importe_solicitado' => isset($validated['importeSolicitado'])
                    ? $this->normalizeImportePagado($validated['importeSolicitado'])
                    : null,
                'cuit_cobrador' => $this->normalizeNullableCuit($validated['cuitCobrador'] ?? null),
                'medio_pago' => $this->normalizeNullableString($validated['medioPago'] ?? null),
                'concepto' => $this->normalizeNullableString($validated['concepto'] ?? null),
                'fecha_compromiso_pago' => isset($validated['fechaCompromisoPago'])
                    ? Carbon::parse($validated['fechaCompromisoPago'])->startOfDay()
                    : null,
                'aprobacion_estado' => null,
                'aprobacion_motivo' => null,
                'bloqueado_en' => $isReclamoAdelanto ? Carbon::now() : null,
                'fecha_alta' => isset($validated['fechaReclamo'])
                    ? Carbon::parse($validated['fechaReclamo'])
                    : null,
                'status' => $validated['status'],
                'pagado' => (bool) $validated['pagado'],
                'importe_pagado' => (bool) $validated['pagado']
                    ? ($canViewImportes
                        ? $this->normalizeImportePagado($validated['importePagado'] ?? null)
                        : null)
                    : null,
                'importe_facturado' => $canViewImportes && isset($validated['importeFacturado'])
                    ? $this->normalizeImportePagado($validated['importeFacturado'])
                    : null,
            ]);

            $actorId = $creatorId ?? $validated['agenteId'] ?? null;

            $this->recordComment($reclamo, 'Reclamo creado inicialmente', [
                'status' => $reclamo->status,
            ], $actorId);

            $this->recordStatusChange($reclamo, null, $reclamo->status, $actorId);
            $this->promotePersonaFromPreActivo($reclamo->persona_id);

            return $reclamo;
        });

        $relations = [
            'creator:id,name',
            'agente:id,name',
            'tipo:id,nombre,slug',
            'persona' => fn ($query) => $query->select(
                'id',
                'nombres',
                'apellidos',
                'cliente_id',
                'cuil',
                'telefono',
                'email',
                'patente',
                'fecha_alta',
                'sucursal_id',
                'unidad_id',
                'agente_id'
            ),
            'persona.cliente:id,nombre',
            'persona.sucursal:id,nombre',
            'persona.unidad:id,matricula,marca,modelo',
            'persona.agente:id,name',
            'comments.creator:id,name',
            'comments.senderUser:id,name',
            'comments.senderPersona:id,nombres,apellidos',
            'logs.actor:id,name',
        ];

        if (Schema::hasTable('reclamo_documents')) {
            $relations['documents'] = fn ($query) => $query->orderByDesc('created_at');
        }

        $reclamo->loadMissing($relations);

        if ($reclamo->agente_id) {
            $this->createAssignmentNotification($reclamo, (int) $reclamo->agente_id);
        }

        return response()->json([
            'message' => 'Reclamo creado correctamente.',
            'data' => $this->transformReclamo($reclamo, true, $canViewImportes),
        ], 201);
    }

    public function show(Request $request, Reclamo $reclamo): JsonResponse
    {
        $canViewImportes = $this->canViewReclamoImportes($request);

        $showRelations = [
            'creator:id,name',
            'agente:id,name',
            'tipo:id,nombre,slug',
            'persona' => fn ($query) => $query->select(
                'id',
                'nombres',
                'apellidos',
                'cliente_id',
                'cuil',
                'telefono',
                'email',
                'patente',
                'fecha_alta',
                'sucursal_id',
                'unidad_id',
                'agente_id'
            ),
            'persona.cliente:id,nombre',
            'persona.sucursal:id,nombre',
            'persona.unidad:id,matricula,marca,modelo',
            'persona.agente:id,name',
            'comments' => fn ($query) => $query->orderBy('created_at'),
            'comments.creator:id,name',
            'comments.senderUser:id,name',
            'comments.senderPersona:id,nombres,apellidos',
            'logs' => fn ($query) => $query->orderBy('created_at'),
            'logs.actor:id,name',
        ];

        if (Schema::hasTable('reclamo_documents')) {
            $showRelations['documents'] = fn ($query) => $query->orderByDesc('created_at');
        }

        $reclamo->loadMissing($showRelations);

        return response()->json([
            'data' => $this->transformReclamo($reclamo, true, $canViewImportes),
        ]);
    }

    public function update(Request $request, Reclamo $reclamo): JsonResponse
    {
        $canViewImportes = $this->canViewReclamoImportes($request);

        $validated = $request->validate([
            'detalle' => ['nullable', 'string'],
            'agenteId' => ['nullable', 'integer', 'exists:users,id'],
            'creatorId' => ['nullable', 'integer', 'exists:users,id'],
            'transportistaId' => ['required', 'integer', 'exists:personas,id'],
            'tipoId' => ['required', 'integer', 'exists:reclamo_types,id'],
            'status' => ['required', Rule::in(array_keys($this->statusLabels()))],
            'pagado' => ['required', 'boolean'],
            'importePagado' => [
                'nullable',
                'numeric',
                'min:0',
                Rule::requiredIf(fn () => $canViewImportes && (bool) $request->input('pagado')),
            ],
            'importeFacturado' => ['nullable', 'numeric', 'min:0'],
            'fechaReclamo' => ['nullable', 'date'],
            'clienteNombre' => ['nullable', 'string', 'max:255'],
            'sucursalNombre' => ['nullable', 'string', 'max:255'],
            'distribuidorNombre' => ['nullable', 'string', 'max:255'],
            'emisorFactura' => ['nullable', 'string', 'max:255'],
            'importeSolicitado' => ['nullable', 'numeric', 'min:0'],
            'cuitCobrador' => ['nullable', 'string', 'max:32'],
            'medioPago' => ['nullable', 'string', 'max:120'],
            'concepto' => ['nullable', 'string', 'max:2000'],
            'fechaCompromisoPago' => ['nullable', 'date'],
            'aprobacionEstado' => ['nullable', Rule::in(['aprobado', 'no_aprobado'])],
            'aprobacionMotivo' => ['nullable', 'string', 'max:2000'],
        ]);

        $reclamo->loadMissing('agente:id,name', 'tipo:id,nombre,slug');
        $isReclamoAdelanto = $this->isReclamosYAdelantosType($reclamo->tipo, (int) ($validated['tipoId'] ?? $reclamo->reclamo_type_id));

        if ($isReclamoAdelanto && (bool) $reclamo->en_revision) {
            return response()->json([
                'message' => 'Este reclamo está marcado en checklist. Desmarcalo para volver a editarlo.',
            ], 423);
        }

        $incomingClienteNombre = array_key_exists('clienteNombre', $validated)
            ? $this->normalizeNullableString($validated['clienteNombre'])
            : $this->normalizeNullableString($reclamo->cliente_nombre);
        $incomingSucursalNombre = array_key_exists('sucursalNombre', $validated)
            ? $this->normalizeNullableString($validated['sucursalNombre'])
            : $this->normalizeNullableString($reclamo->sucursal_nombre);
        $incomingDistribuidorNombre = array_key_exists('distribuidorNombre', $validated)
            ? $this->normalizeNullableString($validated['distribuidorNombre'])
            : $this->normalizeNullableString($reclamo->distribuidor_nombre);
        $incomingEmisorFactura = array_key_exists('emisorFactura', $validated)
            ? $this->normalizeNullableString($validated['emisorFactura'])
            : $this->normalizeNullableString($reclamo->emisor_factura);
        $incomingImporteSolicitado = array_key_exists('importeSolicitado', $validated)
            ? $this->normalizeImportePagado($validated['importeSolicitado'])
            : $this->normalizeImportePagado($reclamo->importe_solicitado);
        $incomingCuitCobrador = array_key_exists('cuitCobrador', $validated)
            ? $this->normalizeNullableCuit($validated['cuitCobrador'])
            : $this->normalizeNullableCuit($reclamo->cuit_cobrador);
        $incomingMedioPago = array_key_exists('medioPago', $validated)
            ? $this->normalizeNullableString($validated['medioPago'])
            : $this->normalizeNullableString($reclamo->medio_pago);
        $incomingConcepto = array_key_exists('concepto', $validated)
            ? $this->normalizeNullableString($validated['concepto'])
            : $this->normalizeNullableString($reclamo->concepto);
        $incomingFechaCompromisoPago = array_key_exists('fechaCompromisoPago', $validated)
            ? $this->normalizeNullableString((string) $validated['fechaCompromisoPago'])
            : optional($reclamo->fecha_compromiso_pago)->format('Y-m-d');
        $incomingAprobacionEstado = array_key_exists('aprobacionEstado', $validated)
            ? $this->normalizeAprobacionEstado($validated['aprobacionEstado'])
            : $this->normalizeAprobacionEstado($reclamo->aprobacion_estado);
        $incomingAprobacionMotivo = array_key_exists('aprobacionMotivo', $validated)
            ? $this->normalizeNullableString($validated['aprobacionMotivo'])
            : $this->normalizeNullableString($reclamo->aprobacion_motivo);

        $originalAprobacionEstado = $this->normalizeAprobacionEstado($reclamo->aprobacion_estado);
        $originalAprobacionMotivo = $this->normalizeNullableString($reclamo->aprobacion_motivo);
        $approvalChanged = $incomingAprobacionEstado !== $originalAprobacionEstado
            || $incomingAprobacionMotivo !== $originalAprobacionMotivo;

        if ($incomingAprobacionEstado === 'no_aprobado' && $incomingAprobacionMotivo === null) {
            return response()->json([
                'message' => 'El motivo es obligatorio cuando el estado de aprobación es "No aprobado".',
            ], 422);
        }

        if ($isReclamoAdelanto) {
            $lockedViolations = [];

            $lockedChecks = [
                ['field' => 'clienteNombre', 'label' => 'Cliente', 'current' => $reclamo->cliente_nombre, 'incoming' => $incomingClienteNombre],
                ['field' => 'sucursalNombre', 'label' => 'Sucursal', 'current' => $reclamo->sucursal_nombre, 'incoming' => $incomingSucursalNombre],
                ['field' => 'distribuidorNombre', 'label' => 'Nombre distribuidor', 'current' => $reclamo->distribuidor_nombre, 'incoming' => $incomingDistribuidorNombre],
                ['field' => 'emisorFactura', 'label' => 'Dueño / emisor factura', 'current' => $reclamo->emisor_factura, 'incoming' => $incomingEmisorFactura],
                ['field' => 'importeSolicitado', 'label' => 'Importe solicitado', 'current' => $this->normalizeImportePagado($reclamo->importe_solicitado), 'incoming' => $incomingImporteSolicitado],
                ['field' => 'cuitCobrador', 'label' => 'CUIT cobrador', 'current' => $reclamo->cuit_cobrador, 'incoming' => $incomingCuitCobrador],
                ['field' => 'medioPago', 'label' => 'Medio de pago', 'current' => $reclamo->medio_pago, 'incoming' => $incomingMedioPago],
                ['field' => 'concepto', 'label' => 'Concepto', 'current' => $reclamo->concepto, 'incoming' => $incomingConcepto],
            ];

            foreach ($lockedChecks as $check) {
                if (! $this->canMutateLockedValue($check['current'], $check['incoming'])) {
                    $lockedViolations[$check['field']] = ["{$check['label']} no se puede modificar una vez cargado."];
                }
            }

            if ((int) $reclamo->persona_id !== (int) $validated['transportistaId']) {
                $lockedViolations['transportistaId'] = ['El transportista no se puede modificar una vez cargado.'];
            }
            if ((int) $reclamo->reclamo_type_id !== (int) $validated['tipoId']) {
                $lockedViolations['tipoId'] = ['El tipo de reclamo no se puede modificar para este registro.'];
            }

            if (! empty($lockedViolations)) {
                return response()->json([
                    'message' => 'Algunos campos de Reclamos y Adelantos son inmutables.',
                    'errors' => $lockedViolations,
                ], 422);
            }

            if ($approvalChanged && ! $this->canEditReclamosAdelantosApproval($request)) {
                return response()->json([
                    'message' => 'Solo Seba puede editar "Aprobado / No aprobado" y "Motivo".',
                ], 403);
            }
        }

        $originalAgente = $reclamo->agente_id;
        $originalAgenteName = $reclamo->agente?->name;
        $agentChanged = false;
        $newAgenteId = null;

        $originalImportePagado = $this->normalizeImportePagado($reclamo->importe_pagado);
        $originalImporteFacturado = $this->normalizeImportePagado($reclamo->importe_facturado);
        $originalFechaCompromisoPago = optional($reclamo->fecha_compromiso_pago)->format('Y-m-d');

        DB::transaction(function () use (
            $reclamo,
            $validated,
            $originalAgente,
            $originalAgenteName,
            &$agentChanged,
            &$newAgenteId,
            $originalImportePagado,
            $canViewImportes,
            $isReclamoAdelanto,
            $incomingClienteNombre,
            $incomingSucursalNombre,
            $incomingDistribuidorNombre,
            $incomingEmisorFactura,
            $incomingImporteSolicitado,
            $incomingCuitCobrador,
            $incomingMedioPago,
            $incomingConcepto,
            $incomingFechaCompromisoPago,
            $incomingAprobacionEstado,
            $incomingAprobacionMotivo,
            $approvalChanged,
            $originalFechaCompromisoPago,
            $originalAprobacionEstado,
            $originalAprobacionMotivo
        ) {
            $originalStatus = $reclamo->status;
            $originalPagado = (bool) $reclamo->pagado;
            $originalImporteFacturado = $this->normalizeImportePagado($reclamo->importe_facturado);

            $reclamo->creator_id = $validated['creatorId'] ?? null;
            $reclamo->agente_id = $validated['agenteId'] ?? null;
            $reclamo->persona_id = $validated['transportistaId'];
            $reclamo->reclamo_type_id = $validated['tipoId'];
            $reclamo->detalle = isset($validated['detalle']) ? trim($validated['detalle']) : null;
            $reclamo->cliente_nombre = $incomingClienteNombre;
            $reclamo->sucursal_nombre = $incomingSucursalNombre;
            $reclamo->distribuidor_nombre = $incomingDistribuidorNombre;
            $reclamo->emisor_factura = $incomingEmisorFactura;
            $reclamo->importe_solicitado = $incomingImporteSolicitado;
            $reclamo->cuit_cobrador = $incomingCuitCobrador;
            $reclamo->medio_pago = $incomingMedioPago;
            $reclamo->concepto = $incomingConcepto;
            $reclamo->fecha_compromiso_pago = $incomingFechaCompromisoPago
                ? Carbon::parse($incomingFechaCompromisoPago)->startOfDay()
                : null;
            if ($approvalChanged || ! $isReclamoAdelanto) {
                $reclamo->aprobacion_estado = $incomingAprobacionEstado;
                $reclamo->aprobacion_motivo = $incomingAprobacionMotivo;
            }
            $reclamo->fecha_alta = isset($validated['fechaReclamo'])
                ? Carbon::parse($validated['fechaReclamo'])
                : null;
            $reclamo->status = $validated['status'];
            $reclamo->pagado = (bool) $validated['pagado'];
            if ($canViewImportes) {
                $reclamo->importe_pagado = $reclamo->pagado
                    ? $this->normalizeImportePagado($validated['importePagado'] ?? null)
                    : null;
                $reclamo->importe_facturado = array_key_exists('importeFacturado', $validated)
                    ? $this->normalizeImportePagado($validated['importeFacturado'])
                    : $reclamo->importe_facturado;
            } else {
                $reclamo->importe_pagado = $reclamo->pagado ? $reclamo->importe_pagado : null;
            }

            $reclamo->save();
            $this->promotePersonaFromPreActivo($reclamo->persona_id);

            $actorId = $validated['creatorId'] ?? $validated['agenteId'] ?? null;
            $newAgenteId = $reclamo->agente_id;

            if ($originalStatus !== $reclamo->status) {
                $this->recordStatusChange($reclamo, $originalStatus, $reclamo->status, $actorId);
            }

            if ($originalPagado !== (bool) $reclamo->pagado) {
                $this->recordComment(
                    $reclamo,
                    sprintf('Pagado actualizado a %s', $reclamo->pagado ? 'Sí' : 'No'),
                    [
                        'old' => $originalPagado,
                        'new' => (bool) $reclamo->pagado,
                        'field' => 'pagado',
                    ],
                    $actorId
                );
            }

            if ($canViewImportes) {
                $currentImportePagado = $this->normalizeImportePagado($reclamo->importe_pagado);
                if ($originalImportePagado !== $currentImportePagado) {
                    $this->recordComment(
                        $reclamo,
                        $currentImportePagado
                            ? sprintf('Importe pagado actualizado a %s', $this->formatImportePagadoLabel($currentImportePagado))
                            : 'Importe pagado eliminado.',
                        [
                            'old' => $originalImportePagado,
                            'new' => $currentImportePagado,
                            'field' => 'importe_pagado',
                        ],
                        $actorId
                    );
                }

                $currentImporteFacturado = $this->normalizeImportePagado($reclamo->importe_facturado);
                if ($originalImporteFacturado !== $currentImporteFacturado) {
                    $this->recordComment(
                        $reclamo,
                        $currentImporteFacturado
                            ? sprintf('Importe facturado actualizado a %s', $this->formatImportePagadoLabel($currentImporteFacturado))
                            : 'Importe facturado eliminado.',
                        [
                            'old' => $originalImporteFacturado,
                            'new' => $currentImporteFacturado,
                            'field' => 'importe_facturado',
                        ],
                        $actorId
                    );
                }
            }

            $currentFechaCompromisoPago = optional($reclamo->fecha_compromiso_pago)->format('Y-m-d');
            if ($originalFechaCompromisoPago !== $currentFechaCompromisoPago) {
                $this->recordComment(
                    $reclamo,
                    $currentFechaCompromisoPago
                        ? sprintf('Fecha compromiso de pago actualizada a %s', $currentFechaCompromisoPago)
                        : 'Fecha compromiso de pago eliminada.',
                    [
                        'old' => $originalFechaCompromisoPago,
                        'new' => $currentFechaCompromisoPago,
                        'field' => 'fecha_compromiso_pago',
                    ],
                    $actorId
                );
            }

            if ($approvalChanged) {
                $this->recordComment(
                    $reclamo,
                    sprintf(
                        'Aprobación actualizada de %s a %s.',
                        $this->aprobacionEstadoLabel($originalAprobacionEstado) ?? 'Sin definir',
                        $this->aprobacionEstadoLabel($incomingAprobacionEstado) ?? 'Sin definir'
                    ),
                    [
                        'old' => $originalAprobacionEstado,
                        'new' => $incomingAprobacionEstado,
                        'oldMotivo' => $originalAprobacionMotivo,
                        'newMotivo' => $incomingAprobacionMotivo,
                        'field' => 'aprobacion_estado',
                    ],
                    $actorId
                );
            }

            if ($originalAgente !== $reclamo->agente_id) {
                $agentChanged = true;

                $oldName = $originalAgente ? (User::query()->find($originalAgente)?->name ?? 'Sin asignar') : ($originalAgenteName ?? 'Sin asignar');
                $newName = $reclamo->agente_id ? (User::query()->find($reclamo->agente_id)?->name ?? 'Sin asignar') : 'Sin asignar';

                $this->recordComment(
                    $reclamo,
                    sprintf('Responsable actualizado de %s a %s', $oldName, $newName),
                    [
                        'old' => $originalAgente,
                        'new' => $reclamo->agente_id,
                        'field' => 'agente_id',
                    ],
                    $actorId
                );
            }
        });

        $reclamo->refresh()->loadMissing([
            'creator:id,name',
            'agente:id,name',
            'tipo:id,nombre,slug',
            'persona' => fn ($query) => $query->select(
                'id',
                'nombres',
                'apellidos',
                'cliente_id',
                'cuil',
                'telefono',
                'email',
                'patente',
                'fecha_alta',
                'sucursal_id',
                'unidad_id',
                'agente_id'
            ),
            'persona.cliente:id,nombre',
            'persona.sucursal:id,nombre',
            'persona.unidad:id,matricula,marca,modelo',
            'persona.agente:id,name',
            'comments' => fn ($query) => $query->orderBy('created_at'),
            'comments.creator:id,name',
            'comments.senderUser:id,name',
            'comments.senderPersona:id,nombres,apellidos',
            'logs' => fn ($query) => $query->orderBy('created_at'),
            'logs.actor:id,name',
        ]);

        if ($agentChanged && $newAgenteId) {
            $this->createAssignmentNotification($reclamo, (int) $newAgenteId);
        }

        return response()->json([
            'message' => 'Reclamo actualizado correctamente.',
            'data' => $this->transformReclamo($reclamo, true, $canViewImportes),
        ]);
    }

    public function updateAdelantoStatus(Request $request, Reclamo $reclamo): JsonResponse
    {
        $canViewImportes = $this->canViewReclamoImportes($request);
        $this->loadReclamoIndexRelations($reclamo);

        if (! $this->isReclamosYAdelantosType($reclamo->tipo, $reclamo->reclamo_type_id)) {
            return response()->json([
                'message' => 'Solo los reclamos de tipo Reclamos y Adelantos permiten este cambio.',
            ], 422);
        }

        if ((bool) $reclamo->en_revision) {
            return response()->json([
                'message' => 'El checklist está activo. Desmarcalo para modificar el estado.',
            ], 423);
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in(['aceptado', 'rechazado'])],
        ]);

        $newStatus = $validated['status'];
        $oldStatus = $reclamo->status;

        if ($oldStatus !== $newStatus) {
            DB::transaction(function () use ($request, $reclamo, $oldStatus, $newStatus) {
                $reclamo->status = $newStatus;
                $reclamo->save();

                $this->recordStatusChange($reclamo, $oldStatus, $newStatus, $request->user()?->id);
            });
        }

        $reclamo->refresh();
        $this->loadReclamoIndexRelations($reclamo);

        return response()->json([
            'message' => 'Estado actualizado correctamente.',
            'data' => $this->transformReclamo($reclamo, false, $canViewImportes),
        ]);
    }

    public function updateRevision(Request $request, Reclamo $reclamo): JsonResponse
    {
        $canViewImportes = $this->canViewReclamoImportes($request);
        $this->loadReclamoIndexRelations($reclamo);

        if (! $this->isReclamosYAdelantosType($reclamo->tipo, $reclamo->reclamo_type_id)) {
            return response()->json([
                'message' => 'Solo los reclamos de tipo Reclamos y Adelantos permiten checklist de trabajo.',
            ], 422);
        }

        $validated = $request->validate([
            'enRevision' => ['required', 'boolean'],
        ]);

        $newValue = (bool) $validated['enRevision'];
        $oldValue = (bool) $reclamo->en_revision;

        if ($newValue !== $oldValue) {
            DB::transaction(function () use ($request, $reclamo, $newValue, $oldValue) {
                $reclamo->en_revision = $newValue;
                $reclamo->save();

                $this->recordComment(
                    $reclamo,
                    $newValue
                        ? 'Checklist de trabajo activado. La edición quedó bloqueada.'
                        : 'Checklist de trabajo desactivado. La edición volvió a habilitarse.',
                    [
                        'field' => 'en_revision',
                        'old' => $oldValue,
                        'new' => $newValue,
                    ],
                    $request->user()?->id
                );
            });
        }

        $reclamo->refresh();
        $this->loadReclamoIndexRelations($reclamo);

        return response()->json([
            'message' => $newValue
                ? 'Checklist activado. La edición quedó bloqueada.'
                : 'Checklist desactivado. Ya podés editar el reclamo.',
            'data' => $this->transformReclamo($reclamo, false, $canViewImportes),
        ]);
    }

    public function storeComment(Request $request, Reclamo $reclamo): JsonResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'creatorId' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $message = trim($validated['message']);
        if ($message === '') {
            return response()->json([
                'message' => 'El comentario no puede estar vacío.',
            ], 422);
        }

        DB::transaction(function () use ($reclamo, $message, $validated) {
            $this->recordComment(
                $reclamo,
                $message,
                null,
                $validated['creatorId'] ?? null
            );
        });

        $reclamo->refresh()->loadMissing([
            'creator:id,name',
            'agente:id,name',
            'tipo:id,nombre,slug',
            'persona' => fn ($query) => $query->select(
                'id',
                'nombres',
                'apellidos',
                'cliente_id',
                'cuil',
                'telefono',
                'email',
                'patente',
                'fecha_alta',
                'sucursal_id',
                'unidad_id',
                'agente_id'
            ),
            'persona.cliente:id,nombre',
            'persona.sucursal:id,nombre',
            'persona.unidad:id,matricula,marca,modelo',
            'persona.agente:id,name',
            'comments' => fn ($query) => $query->orderBy('created_at'),
            'comments.creator:id,name',
            'comments.senderUser:id,name',
            'comments.senderPersona:id,nombres,apellidos',
            'logs' => fn ($query) => $query->orderBy('created_at'),
            'logs.actor:id,name',
            'documents' => fn ($query) => $query->orderByDesc('created_at'),
        ]);

        return response()->json([
            'message' => 'Comentario agregado correctamente.',
            'data' => $this->transformReclamo($reclamo, true, $this->canViewReclamoImportes($request)),
        ], 201);
    }

    public function storeDocument(Request $request, Reclamo $reclamo): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            // Allow larger uploads (20MB)
            'archivo' => ['nullable', 'file', 'max:20480'],
            'archivos' => ['nullable', 'array'],
            'archivos.*' => ['file', 'max:20480'],
            'nombre' => ['nullable', 'string', 'max:255'],
            'nombres' => ['nullable', 'array'],
            'nombres.*' => ['nullable', 'string', 'max:255'],
            'creatorId' => ['nullable', 'integer', 'exists:users,id'],
        ], [
            'archivos.*.file' => 'Cada elemento debe ser un archivo válido.',
            'archivos.*.max' => 'Cada archivo debe pesar como máximo 20MB.',
        ]);

        $validator->after(function ($validator) use ($request) {
            $single = $request->file('archivo');
            $multiple = $request->file('archivos');

            $multipleFiles = [];
            if ($multiple instanceof UploadedFile) {
                $multipleFiles = [$multiple];
            } elseif (is_array($multiple)) {
                $multipleFiles = array_filter($multiple);
            }

            if (! $single && empty($multipleFiles)) {
                $validator->errors()->add('archivo', 'Selecciona al menos un archivo.');
            }
        });

        $validated = $validator->validate();

        $files = [];
        $multipleFiles = $request->file('archivos');

        if ($multipleFiles instanceof UploadedFile) {
            $multipleFiles = [$multipleFiles];
        }

        if (is_array($multipleFiles)) {
            $names = Arr::wrap($validated['nombres'] ?? []);

            foreach ($multipleFiles as $index => $file) {
                if (! $file instanceof UploadedFile) {
                    continue;
                }

                $customName = $names[$index] ?? null;
                if (is_string($customName)) {
                    $customName = trim($customName) !== '' ? trim($customName) : null;
                } else {
                    $customName = null;
                }

                $files[] = [
                    'file' => $file,
                    'name' => $customName,
                ];
            }
        }

        if ($request->file('archivo') instanceof UploadedFile) {
            $singleName = isset($validated['nombre']) && is_string($validated['nombre'])
                ? (trim($validated['nombre']) !== '' ? trim($validated['nombre']) : null)
                : null;

            $files[] = [
                'file' => $request->file('archivo'),
                'name' => $singleName,
            ];
        }

        if (empty($files)) {
            return response()->json([
                'message' => 'Selecciona al menos un archivo.',
            ], 422);
        }

        $documents = [];

        DB::transaction(function () use ($files, $reclamo, $validated, &$documents) {
            foreach ($files as $fileData) {
                /** @var UploadedFile $file */
                $file = $fileData['file'];
                $disk = 'public';
                $directory = 'reclamos/'.$reclamo->id;
                $storedPath = $file->store($directory, $disk);
                $downloadUrl = Storage::disk($disk)->url($storedPath);
                $originalName = $fileData['name'] ?? $file->getClientOriginalName();

                $document = $reclamo->documents()->create([
                    'nombre_original' => $originalName,
                    'disk' => $disk,
                    'path' => $storedPath,
                    'download_url' => $downloadUrl,
                    'mime' => $file->getClientMimeType(),
                    'size' => $file->getSize(),
                ]);

                $documents[] = $document;

                $this->recordComment(
                    $reclamo,
                    sprintf('Documento "%s" agregado.', $document->nombre_original ?? basename($document->path)),
                    [
                        'document_id' => $document->id,
                        'path' => $document->path,
                    ],
                    $validated['creatorId'] ?? null
                );
            }
        });

        $reclamo->refresh()->loadMissing([
            'creator:id,name',
            'agente:id,name',
            'tipo:id,nombre,slug',
            'persona' => fn ($query) => $query->select(
                'id',
                'nombres',
                'apellidos',
                'cliente_id',
                'cuil',
                'telefono',
                'email',
                'patente',
                'fecha_alta',
                'sucursal_id',
                'unidad_id',
                'agente_id'
            ),
            'persona.cliente:id,nombre',
            'persona.sucursal:id,nombre',
            'persona.unidad:id,matricula,marca,modelo',
            'persona.agente:id,name',
            'comments' => fn ($query) => $query->orderBy('created_at'),
            'comments.creator:id,name',
            'comments.senderUser:id,name',
            'comments.senderPersona:id,nombres,apellidos',
            'logs' => fn ($query) => $query->orderBy('created_at'),
            'logs.actor:id,name',
            'documents' => fn ($query) => $query->orderByDesc('created_at'),
        ]);

        $message = count($documents) > 1
            ? 'Documentos cargados correctamente.'
            : 'Documento cargado correctamente.';

        return response()->json([
            'message' => $message,
            'data' => $this->transformReclamo($reclamo, true, $this->canViewReclamoImportes($request)),
        ], 201);
    }

    public function destroyDocument(Request $request, Reclamo $reclamo, ReclamoDocument $documento): JsonResponse
    {
        if ($documento->reclamo_id !== $reclamo->id) {
            abort(404);
        }

        $validated = $request->validate([
            'creatorId' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        DB::transaction(function () use ($reclamo, $documento, $validated) {
            $disk = $documento->disk ?? config('filesystems.default');
            $path = $documento->path;

            if ($path && $disk && Storage::disk($disk)->exists($path)) {
                Storage::disk($disk)->delete($path);
            }

            $documento->delete();

            $this->recordComment(
                $reclamo,
                sprintf('Documento "%s" eliminado.', $documento->nombre_original ?? basename($documento->path)),
                [
                    'document_id' => $documento->id,
                    'path' => $documento->path,
                ],
                $validated['creatorId'] ?? null
            );
        });

        $reclamo->refresh()->loadMissing([
            'creator:id,name',
            'agente:id,name',
            'tipo:id,nombre,slug',
            'persona' => fn ($query) => $query->select(
                'id',
                'nombres',
                'apellidos',
                'cliente_id',
                'cuil',
                'telefono',
                'email',
                'patente',
                'fecha_alta',
                'sucursal_id',
                'unidad_id',
                'agente_id'
            ),
            'persona.cliente:id,nombre',
            'persona.sucursal:id,nombre',
            'persona.unidad:id,matricula,marca,modelo',
            'persona.agente:id,name',
            'comments' => fn ($query) => $query->orderBy('created_at'),
            'comments.creator:id,name',
            'comments.senderUser:id,name',
            'comments.senderPersona:id,nombres,apellidos',
            'logs' => fn ($query) => $query->orderBy('created_at'),
            'logs.actor:id,name',
            'documents' => fn ($query) => $query->orderByDesc('created_at'),
        ]);

        return response()->json([
            'message' => 'Documento eliminado correctamente.',
            'data' => $this->transformReclamo($reclamo, true, $this->canViewReclamoImportes($request)),
        ]);
    }

    public function destroy(Reclamo $reclamo): JsonResponse
    {
        DB::transaction(function () use ($reclamo) {
            $documents = $reclamo->documents()->get();

            foreach ($documents as $documento) {
                if ($documento->disk && $documento->path) {
                    try {
                        Storage::disk($documento->disk)->delete($documento->path);
                    } catch (\Throwable $exception) {
                        report($exception);
                    }
                }

                $documento->delete();
            }

            $reclamo->comments()->delete();
            $reclamo->logs()->delete();
            $reclamo->delete();
        });

        return response()->json([
            'message' => 'Reclamo eliminado correctamente.',
        ]);
    }

    public function downloadDocument(Reclamo $reclamo, ReclamoDocument $documento)
    {
        if ($documento->reclamo_id !== $reclamo->id) {
            abort(404);
        }

        $disk = $documento->disk ?? config('filesystems.default');

        if (! Storage::disk($disk)->exists($documento->path)) {
            abort(404, 'Archivo no encontrado.');
        }

        $filename = $documento->nombre_original ?? basename($documento->path);

        return Storage::disk($disk)->download($documento->path, $filename);
    }

    protected function canViewReclamoImportes(Request $request): bool
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if ($role === '') {
            return true;
        }

        return ! Str::contains($role, 'asesor');
    }

    protected function transformReclamo(Reclamo $reclamo, bool $withHistory = false, bool $includeImportes = true): array
    {
        $statusLabels = $this->statusLabels();
        $statusLabel = $statusLabels[$reclamo->status] ?? Str::title(str_replace('_', ' ', (string) $reclamo->status));
        $fechaReferencia = $reclamo->fecha_alta ?? $reclamo->created_at;
        $isReclamoAdelanto = $this->isReclamosYAdelantosType($reclamo->tipo, $reclamo->reclamo_type_id);

        $persona = $reclamo->persona;
        $transportistaDetail = null;

        if ($withHistory && $persona) {
            $transportistaDetail = [
                'id' => $persona->id,
                'nombreCompleto' => trim(($persona->nombres ?? '').' '.($persona->apellidos ?? '')) ?: null,
                'cuil' => $persona->cuil,
                'telefono' => $persona->telefono,
                'email' => $persona->email,
                'cliente' => $persona->cliente?->nombre,
                'sucursal' => $persona->sucursal?->nombre,
                'unidad' => $persona->unidad?->matricula,
                'unidadDetalle' => $persona->unidad
                    ? trim(($persona->unidad->marca ?? '').' '.($persona->unidad->modelo ?? '')) ?: null
                    : null,
                'patente' => $persona->patente,
                'agente' => $persona->agente?->name,
                'agenteId' => $persona->agente_id,
                'fechaAlta' => optional($persona->fecha_alta)->format('Y-m-d'),
            ];
        }

        $base = [
            'id' => $reclamo->id,
            'codigo' => $this->formatReclamoCodigo($reclamo),
            'detalle' => $reclamo->detalle,
            'fechaReclamo' => $fechaReferencia?->format('Y-m-d'),
            'fechaReclamoIso' => $fechaReferencia?->toIso8601String(),
            'status' => $reclamo->status,
            'statusLabel' => $statusLabel,
            'pagado' => (bool) $reclamo->pagado,
            'pagadoLabel' => $reclamo->pagado ? 'Sí' : 'No',
            'importePagado' => $includeImportes ? $this->normalizeImportePagado($reclamo->importe_pagado) : null,
            'importePagadoLabel' => $includeImportes ? $this->formatImportePagadoLabel($reclamo->importe_pagado) : null,
            'importeFacturado' => $includeImportes ? $this->normalizeImportePagado($reclamo->importe_facturado) : null,
            'importeFacturadoLabel' => $includeImportes ? $this->formatImportePagadoLabel($reclamo->importe_facturado) : null,
            'creator' => $reclamo->creator?->name,
            'creatorId' => $reclamo->creator_id,
            'agente' => $reclamo->agente?->name,
            'agenteId' => $reclamo->agente_id,
            'transportista' => $reclamo->persona ? trim(($reclamo->persona->nombres ?? '').' '.($reclamo->persona->apellidos ?? '')) ?: null : null,
            'transportistaId' => $reclamo->persona_id,
            'patente' => $reclamo->persona?->patente,
            'cliente' => $reclamo->persona?->cliente?->nombre,
            'clienteNombre' => $reclamo->cliente_nombre ?? $reclamo->persona?->cliente?->nombre,
            'sucursalNombre' => $reclamo->sucursal_nombre ?? $reclamo->persona?->sucursal?->nombre,
            'distribuidorNombre' => $reclamo->distribuidor_nombre,
            'emisorFactura' => $reclamo->emisor_factura,
            'importeSolicitado' => $this->normalizeImportePagado($reclamo->importe_solicitado),
            'importeSolicitadoLabel' => $this->formatImportePagadoLabel($this->normalizeImportePagado($reclamo->importe_solicitado)),
            'cuitCobrador' => $reclamo->cuit_cobrador,
            'medioPago' => $reclamo->medio_pago,
            'concepto' => $reclamo->concepto,
            'fechaCompromisoPago' => optional($reclamo->fecha_compromiso_pago)->format('Y-m-d'),
            'aprobacionEstado' => $this->normalizeAprobacionEstado($reclamo->aprobacion_estado),
            'aprobacionEstadoLabel' => $this->aprobacionEstadoLabel($this->normalizeAprobacionEstado($reclamo->aprobacion_estado)),
            'aprobacionMotivo' => $reclamo->aprobacion_motivo,
            'bloqueadoEn' => $reclamo->bloqueado_en?->toIso8601String(),
            'enRevision' => (bool) $reclamo->en_revision,
            'tipo' => $reclamo->tipo?->nombre,
            'tipoSlug' => $reclamo->tipo?->slug,
            'tipoId' => $reclamo->reclamo_type_id,
            'isReclamoAdelanto' => $isReclamoAdelanto,
            'createdAt' => $reclamo->created_at?->toIso8601String(),
            'updatedAt' => $reclamo->updated_at?->toIso8601String(),
            'transportistaDetail' => $transportistaDetail,
        ];

        if ($withHistory) {
            $documents = $reclamo->relationLoaded('documents') ? ($reclamo->documents ?? collect()) : collect();
            $base['documents'] = $documents
                ->map(fn (ReclamoDocument $document) => [
                    'id' => $document->id,
                    'nombre' => $document->nombre_original ?? basename($document->path),
                    'downloadUrl' => $document->download_url,
                    'mime' => $document->mime,
                    'size' => $document->size,
                    'uploadedAt' => $document->created_at?->toIso8601String(),
                    'uploadedAtLabel' => $document->created_at?->format('Y-m-d H:i'),
                ])
                ->values()
                ->all();
        }

        if (! $withHistory) {
            return $base;
        }

        $comments = $reclamo->relationLoaded('comments') ? ($reclamo->comments ?? collect()) : collect();
        $logs = $reclamo->relationLoaded('logs') ? ($reclamo->logs ?? collect()) : collect();

        $history = collect();

        foreach ($logs as $log) {
            $oldLabel = $log->old_status
                ? ($statusLabels[$log->old_status] ?? Str::title(str_replace('_', ' ', (string) $log->old_status)))
                : 'Sin estado';
            $newLabel = $log->new_status
                ? ($statusLabels[$log->new_status] ?? Str::title(str_replace('_', ' ', (string) $log->new_status)))
                : 'Sin estado';

            $history->push([
                'id' => 'log-'.$log->id,
                'type' => 'status_change',
                'message' => sprintf('Estado cambiado de %s a %s', $oldLabel, $newLabel),
                'oldStatus' => $log->old_status,
                'oldStatusLabel' => $log->old_status ? ($statusLabels[$log->old_status] ?? $oldLabel) : null,
                'newStatus' => $log->new_status,
                'newStatusLabel' => $statusLabels[$log->new_status] ?? $newLabel,
                'actor' => $log->actor?->name ?? 'Sistema',
                'actorId' => $log->changed_by,
                'timestamp' => $log->created_at?->toIso8601String(),
                'timestampLabel' => $log->created_at?->format('Y-m-d H:i'),
            ]);
        }

        foreach ($comments as $comment) {
            $author = $comment->creator?->name
                ?? $comment->senderUser?->name
                ?? ($comment->senderPersona ? trim(($comment->senderPersona->nombres ?? '').' '.($comment->senderPersona->apellidos ?? '')) : null)
                ?? Str::title(str_replace('_', ' ', (string) $comment->sender_type));

            $history->push([
                'id' => 'comment-'.$comment->id,
                'type' => 'comment',
                'message' => $comment->message,
                'meta' => $comment->meta,
                'author' => $author,
                'authorId' => $comment->creator_id ?? $comment->sender_user_id,
                'timestamp' => $comment->created_at?->toIso8601String(),
                'timestampLabel' => $comment->created_at?->format('Y-m-d H:i'),
            ]);
        }

        $base['history'] = $history
            ->sortBy(fn (array $item) => $item['timestamp'] ?? '')
            ->values()
            ->all();

        return $base;
    }

    /**
     * @return array<string, string>
     */
    protected function statusLabels(): array
    {
        return [
            'creado' => 'Creado',
            'en_proceso' => 'En proceso',
            'aceptado' => 'Aceptado',
            'rechazado' => 'Rechazado',
            'finalizado' => 'Finalizado',
        ];
    }

    protected function recordStatusChange(Reclamo $reclamo, ?string $oldStatus, string $newStatus, ?int $actorId = null): void
    {
        if ($oldStatus === $newStatus) {
            return;
        }

        $statusLabels = $this->statusLabels();

        $reclamo->logs()->create([
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'changed_by' => $actorId,
        ]);

        $oldLabel = $oldStatus ? ($statusLabels[$oldStatus] ?? Str::title(str_replace('_', ' ', $oldStatus))) : 'Sin estado';
        $newLabel = $statusLabels[$newStatus] ?? Str::title(str_replace('_', ' ', $newStatus));

        $this->recordComment(
            $reclamo,
            sprintf('Estado cambiado de %s a %s', $oldLabel, $newLabel),
            [
                'old' => $oldStatus,
                'new' => $newStatus,
                'field' => 'status',
            ],
            $actorId
        );
    }

    protected function recordComment(Reclamo $reclamo, string $message, ?array $meta = null, ?int $actorId = null): void
    {
        $reclamo->comments()->create([
            'creator_id' => $actorId,
            'sender_type' => $actorId ? 'user' : 'sistema',
            'sender_user_id' => $actorId,
            'message' => $message,
            'meta' => $meta ?: null,
        ]);
    }

    protected function promotePersonaFromPreActivo(?int $personaId): void
    {
        if (! $personaId) {
            return;
        }

        $persona = Persona::query()
            ->with('estado:id,nombre')
            ->find($personaId);

        if (! $persona) {
            return;
        }

        $normalizedEstado = $this->normalizeEstadoNombre($persona->estado?->nombre);
        if ($normalizedEstado !== 'preactivo') {
            return;
        }

        $activoEstadoId = Estado::query()
            ->whereRaw('LOWER(TRIM(nombre)) = ?', ['activo'])
            ->value('id');

        if (! $activoEstadoId) {
            return;
        }

        $persona->estado_id = (int) $activoEstadoId;
        $persona->save();
    }

    protected function normalizeEstadoNombre(?string $estado): string
    {
        $normalized = Str::lower(trim((string) $estado));
        $normalized = str_replace(['-', '_'], ' ', $normalized);
        $normalized = preg_replace('/\s+/', ' ', $normalized) ?? '';
        return str_replace(' ', '', trim($normalized));
    }

    protected function createAssignmentNotification(Reclamo $reclamo, int $userId): void
    {
        $message = sprintf(
            'Se te asignó como responsable del reclamo %s.',
            $this->formatReclamoCodigo($reclamo)
        );

        $hasMessageColumn = Schema::hasColumn('notifications', 'message');
        $hasDescriptionColumn = Schema::hasColumn('notifications', 'description');
        $hasReclamoIdColumn = Schema::hasColumn('notifications', 'reclamo_id');
        $hasEntityTypeColumn = Schema::hasColumn('notifications', 'entity_type');
        $hasEntityIdColumn = Schema::hasColumn('notifications', 'entity_id');
        $hasTypeColumn = Schema::hasColumn('notifications', 'type');
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
            $payload['type'] = 'reclamo_responsable_actualizado';
        }

        if ($hasReclamoIdColumn) {
            $payload['reclamo_id'] = $reclamo->id;
        } else {
            if ($hasEntityTypeColumn) {
                $payload['entity_type'] = 'reclamo';
            }
            if ($hasEntityIdColumn) {
                $payload['entity_id'] = $reclamo->id;
            }
        }

        if ($hasMetadataColumn) {
            $payload['metadata'] = [
                'reclamo_id' => $reclamo->id,
                'status' => $reclamo->status,
            ];
        }

        try {
            Notification::create($payload);
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
                $fallbackPayload['type'] = 'reclamo_responsable_actualizado';
            }

            if ($hasEntityTypeColumn) {
                $fallbackPayload['entity_type'] = 'reclamo';
            }
            if ($hasEntityIdColumn) {
                $fallbackPayload['entity_id'] = $reclamo->id;
            }

            try {
                Notification::create($fallbackPayload);
            } catch (QueryException $retryException) {
                report($retryException);
            }
        }
    }

    protected function formatReclamoCodigo(Reclamo $reclamo): string
    {
        return sprintf('R-%05d', $reclamo->id);
    }

    protected function normalizeImportePagado($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return number_format((float) $value, 2, '.', '');
    }

    protected function formatImportePagadoLabel(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return '$ '.number_format((float) $value, 2, ',', '.');
    }
}

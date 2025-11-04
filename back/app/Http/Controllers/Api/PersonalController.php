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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Carbon;

class PersonalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
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

        $personas = $query
            ->get()
            ->map(fn (Persona $persona) => $this->transformPersonaListItem($persona))
            ->values();

        return response()->json(['data' => $personas]);
    }

    public function show($id): JsonResponse
{
    $persona = Persona::withTrashed()
        ->with([
            'cliente:id,nombre',
            'unidad:id,matricula,marca,modelo',
            'sucursal:id,nombre',
            'agente:id,name',
            'agenteResponsable:id,name',
            'estado:id,nombre',
            'dueno:id,persona_id,nombreapellido,fecha_nacimiento,email,telefono,cuil,cuil_cobrador,cbu_alias,observaciones',
            'documentos' => fn ($query) => $query->with('tipo:id,nombre,vence')->orderByDesc('created_at'),
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
        'data' => $this->buildPersonaDetail($persona),
    ]);
}


    public function update(Request $request, Persona $persona): JsonResponse
    {
        $validated = $request->validate([
            'nombres' => ['nullable', 'string', 'max:255'],
            'apellidos' => ['nullable', 'string', 'max:255'],
            'cuil' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'perfilValue' => ['nullable', 'integer'],
            'agenteId' => ['nullable', 'integer', 'exists:users,id'],
            'agenteResponsableId' => ['nullable', 'integer', 'exists:users,id'],
            'clienteId' => ['nullable', 'integer', 'exists:clientes,id'],
            'sucursalId' => ['nullable', 'integer', 'exists:sucursals,id'],
            'unidadId' => ['nullable', 'integer', 'exists:unidades,id'],
            'estadoId' => ['nullable', 'integer', 'exists:estados,id'],
            'pago' => ['nullable', 'numeric'],
            'cbuAlias' => ['nullable', 'string', 'max:255'],
            'patente' => ['nullable', 'string', 'max:100'],
            'fechaAlta' => ['nullable', 'date'],
            'fechaAltaVinculacion' => ['nullable', 'date'],
            'observacionTarifa' => ['nullable', 'string'],
            'observaciones' => ['nullable', 'string'],
            'combustible' => ['nullable', 'boolean'],
            'tarifaEspecial' => ['nullable', 'boolean'],
            'duenoNombre' => ['nullable', 'string', 'max:255'],
            'duenoFechaNacimiento' => ['nullable', 'date'],
            'duenoEmail' => ['nullable', 'email', 'max:255'],
            'duenoCuil' => ['nullable', 'string', 'max:255'],
            'duenoCuilCobrador' => ['nullable', 'string', 'max:255'],
            'duenoTelefono' => ['nullable', 'string', 'max:255'],
            'duenoObservaciones' => ['nullable', 'string'],
        ]);

        $personaHistoryDefinitions = $this->getPersonaHistoryFieldDefinitions();
        $ownerHistoryDefinitions = $this->getPersonaOwnerHistoryFieldDefinitions();
        $originalPersonaSnapshot = $this->capturePersonaHistorySnapshot($persona, $personaHistoryDefinitions);
        $originalOwnerSnapshot = $this->capturePersonaOwnerHistorySnapshot($persona->dueno, $ownerHistoryDefinitions);

        $stringAssignments = [
            'nombres' => 'nombres',
            'apellidos' => 'apellidos',
            'cuil' => 'cuil',
            'telefono' => 'telefono',
            'email' => 'email',
            'cbuAlias' => 'cbu_alias',
            'patente' => 'patente',
            'observacionTarifa' => 'observaciontarifa',
            'observaciones' => 'observaciones',
        ];

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
            'agenteResponsableId' => 'agente_responsable_id',
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

        if (array_key_exists('combustible', $validated)) {
            $persona->combustible = $validated['combustible'] ? 1 : 0;
        }

        if (array_key_exists('tarifaEspecial', $validated)) {
            $persona->tarifaespecial = $validated['tarifaEspecial'] ? 1 : 0;
        }

        $persona->save();

        $ownerPayload = [
            'nombreapellido' => $validated['duenoNombre'] ?? null,
            'fecha_nacimiento' => $validated['duenoFechaNacimiento'] ?? null,
            'email' => $validated['duenoEmail'] ?? null,
            'telefono' => $validated['duenoTelefono'] ?? null,
            'cuil' => $validated['duenoCuil'] ?? null,
            'cuil_cobrador' => $validated['duenoCuilCobrador'] ?? null,
            'cbu_alias' => $validated['duenoCbuAlias'] ?? null,
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

    public function destroy(Persona $persona): JsonResponse
    {
        $persona->delete();

        return response()->json([
            'message' => 'Personal eliminado correctamente.',
        ]);
    }

    public function meta(): JsonResponse
    {
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
            'cuil' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'perfilValue' => ['nullable', 'integer'],
            'agenteId' => ['nullable', 'integer', 'exists:users,id'],
            'agenteResponsableId' => ['nullable', 'integer', 'exists:users,id'],
            'clienteId' => ['nullable', 'integer', 'exists:clientes,id'],
            'sucursalId' => ['nullable', 'integer', 'exists:sucursals,id'],
            'unidadId' => ['nullable', 'integer', 'exists:unidades,id'],
            'estadoId' => ['nullable', 'integer', 'exists:estados,id'],
            'pago' => ['nullable', 'numeric'],
            'cbuAlias' => ['nullable', 'string', 'max:255'],
            'patente' => ['nullable', 'string', 'max:100'],
            'fechaAlta' => ['nullable', 'date'],
            'fechaAltaVinculacion' => ['nullable', 'date'],
            'observacionTarifa' => ['nullable', 'string'],
            'observaciones' => ['nullable', 'string'],
            'combustible' => ['required', 'boolean'],
            'tarifaEspecial' => ['required', 'boolean'],
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

        $persona = Persona::create([
            'nombres' => $validated['nombres'],
            'apellidos' => $validated['apellidos'] ?? null,
            'cuil' => $validated['cuil'] ?? null,
            'telefono' => $validated['telefono'] ?? null,
            'email' => $validated['email'] ?? null,
            'tipo' => $validated['perfilValue'] ?? null,
            'agente_id' => $validated['agenteId'] ?? null,
            'agente_responsable_id' => $validated['agenteResponsableId'] ?? null,
            'cliente_id' => $validated['clienteId'] ?? null,
            'sucursal_id' => $validated['sucursalId'] ?? null,
            'unidad_id' => $validated['unidadId'] ?? null,
            'estado_id' => $validated['estadoId'] ?? null,
            'pago' => $validated['pago'] ?? null,
            'cbu_alias' => $validated['cbuAlias'] ?? null,
            'patente' => $validated['patente'] ?? null,
            'fecha_alta' => $fechaAltaValue,
            'observaciontarifa' => $validated['observacionTarifa'] ?? null,
            'observaciones' => $validated['observaciones'] ?? null,
            'combustible' => $validated['combustible'],
            'tarifaespecial' => $validated['tarifaEspecial'],
            'es_solicitud' => ! $autoApprove,
        ]);

        $shouldCreateOwner = ($validated['perfilValue'] ?? null) === 2;

        if ($shouldCreateOwner) {
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
        }

        if ($autoApprove) {
            $approvedById = $autoApproveUserId ?? $request->user()?->id ?? null;
            $persona->aprobado = true;
            $persona->aprobado_at = Carbon::now();
            $persona->aprobado_por = $approvedById;
            $persona->es_solicitud = false;
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

        $persona->aprobado = true;
        $persona->aprobado_at = Carbon::now();
        $persona->aprobado_por = $validated['userId'] ?? null;
        $persona->es_solicitud = false;

        if (array_key_exists('estadoId', $validated)) {
            $persona->estado_id = $validated['estadoId'];
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

    protected function notifyAgenteResponsable(Persona $persona): bool
    {
        $userId = $persona->agente_responsable_id ?? $persona->agente_id;

        if (! $userId) {
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

        $message = sprintf('Se registró una nueva solicitud de alta para %s.', $personaLabel);

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
            ];
        }

        try {
            Notification::create($payload);
            return true;
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
                return true;
            } catch (QueryException $retryException) {
                report($retryException);
            }
        }

        return false;
    }

    protected function buildPersonaDetail(Persona $persona): array
    {
        $perfilMap = [
            1 => 'Dueño y chofer',
            2 => 'Chofer',
            3 => 'Transportista',
        ];
        $tipo = $persona->tipo;
        $perfilValue = $tipo !== null && $tipo !== '' ? (int) $tipo : null;
        $perfil = $perfilValue !== null ? ($perfilMap[$perfilValue] ?? 'Perfil '.$perfilValue) : null;

        return [
            'id' => $persona->id,
            'nombres' => $persona->nombres,
            'apellidos' => $persona->apellidos,
            'cuil' => $persona->cuil,
            'telefono' => $persona->telefono,
            'email' => $persona->email,
            'perfil' => $perfil,
            'perfilValue' => $perfilValue,
            'agente' => $persona->agente?->name,
            'agenteId' => $persona->agente_id,
            'agenteResponsable' => $persona->agenteResponsable?->name,
            'agenteResponsableId' => $persona->agente_responsable_id,
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
            'tarifaEspecialValue' => (bool) $persona->tarifaespecial,
            'pago' => $persona->pago !== null ? (string) $persona->pago : null,
            'cbuAlias' => $persona->cbu_alias,
            'patente' => $persona->patente,
            'observacionTarifa' => $persona->observaciontarifa,
            'observaciones' => $persona->observaciones,
            'fechaAlta' => $this->formatFechaAlta($persona->fecha_alta),
            'fechaAltaVinculacion' => $this->formatFechaAlta($persona->fecha_alta),
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
            'documents' => $persona->documentos->map(function ($documento) {
                $downloadUrl = route('personal.documentos.descargar', [
                    'persona' => $documento->persona_id,
                    'documento' => $documento->id,
                ], false);

                return [
                    'id' => $documento->id,
                    'nombre' => $documento->nombre_original ?? basename($documento->ruta ?? ''),
                    'downloadUrl' => $downloadUrl,
                    'mime' => $documento->mime,
                    'size' => $documento->size,
                    'fechaVencimiento' => optional($documento->fecha_vencimiento)->format('Y-m-d'),
                    'tipoId' => $documento->tipo_archivo_id,
                    'tipoNombre' => $documento->tipo?->nombre,
                    'requiereVencimiento' => (bool) $documento->tipo?->vence,
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
        $perfilMap = [
            1 => 'Dueño y chofer',
            2 => 'Chofer',
            3 => 'Transportista',
        ];
        $perfil = $persona->tipo !== null ? ($perfilMap[$persona->tipo] ?? 'Perfil '.$persona->tipo) : null;
        $aprobadoValor = $persona->aprobado;
        $aprobado = $aprobadoValor === null ? false : (bool) $aprobadoValor;

        return [
            'id' => $persona->id,
            'nombre' => trim(($persona->nombres ?? '') . ' ' . ($persona->apellidos ?? '')) ?: null,
            'nombres' => $persona->nombres,
            'apellidos' => $persona->apellidos,
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
            'sucursal' => $persona->sucursal?->nombre,
            'sucursalId' => $persona->sucursal_id,
            'perfil' => $perfil,
            'perfilValue' => $persona->tipo,
            'agente' => $persona->agente?->name,
            'agenteId' => $persona->agente_id,
            'agenteResponsable' => $persona->agenteResponsable?->name,
            'agenteResponsableId' => $persona->agente_responsable_id,
            'estado' => $persona->estado?->nombre,
            'estadoId' => $persona->estado_id,
            'combustible' => $persona->combustible ? 'Sí' : 'No',
            'combustibleValue' => (bool) $persona->combustible,
            'tarifaEspecial' => $persona->tarifaespecial ? 'Sí' : 'No',
            'tarifaEspecialValue' => (bool) $persona->tarifaespecial,
            'pago' => $persona->pago !== null ? (string) $persona->pago : null,
            'cbuAlias' => $persona->cbu_alias,
            'patente' => $persona->patente,
            'observacionTarifa' => $persona->observaciontarifa,
            'observaciones' => $persona->observaciones,
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
        ];
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

    protected function getPersonaHistoryFieldDefinitions(): array
    {
        return [
            'nombres' => ['label' => 'Nombre'],
            'apellidos' => ['label' => 'Apellido'],
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
            'observaciontarifa' => ['label' => 'Observación tarifa'],
            'observaciones' => ['label' => 'Observaciones'],
            'fecha_alta' => [
                'label' => 'Fecha de alta',
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

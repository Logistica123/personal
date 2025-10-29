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
        ])
            ->orderByDesc('id');

        if (! $request->boolean('includePending')) {
            $query->where(function ($builder) {
                $builder
                    ->where('aprobado', true)
                    ->orWhereNull('aprobado');
            });
        }

        $personas = $query
            ->get()
            ->map(fn (Persona $persona) => $this->transformPersonaListItem($persona))
            ->values();

        return response()->json(['data' => $personas]);
    }

    public function show(Persona $persona): JsonResponse
    {
        $persona->load([
            'cliente:id,nombre',
            'unidad:id,matricula,marca,modelo',
            'sucursal:id,nombre',
            'agente:id,name',
            'agenteResponsable:id,name',
            'estado:id,nombre',
            'documentos' => fn ($query) => $query->with('tipo:id,nombre,vence')->orderByDesc('created_at'),
            'comments.user:id,name',
        ]);

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
                'observaciones' => $ownerPayload['observaciones'] ?: null,
            ];

            if ($owner) {
                $owner->fill($payload);
                $owner->save();
            } else {
                $persona->dueno()->create($payload);
            }
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
        $validated = $request->validate([
            'nombres' => ['required', 'string', 'max:255'],
            'apellidos' => ['required', 'string', 'max:255'],
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

        $persona = Persona::create([
            'nombres' => $validated['nombres'],
            'apellidos' => $validated['apellidos'],
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
            'fecha_alta' => $validated['fechaAlta'] ?? null,
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
            'fechaAlta' => optional($persona->fecha_alta)->format('Y-m-d'),
            'aprobado' => $persona->aprobado === null ? true : (bool) $persona->aprobado,
            'aprobadoAt' => optional($persona->aprobado_at)->toIso8601String(),
            'aprobadoPorId' => $persona->aprobado_por,
            'aprobadoPorNombre' => $persona->aprobadoPor?->name,
            'esSolicitud' => (bool) $persona->es_solicitud,
            'documents' => $persona->documentos->map(function ($documento) {
                $downloadUrl = route('personal.documentos.descargar', [
                    'persona' => $documento->persona_id,
                    'documento' => $documento->id,
                ]);

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
        $aprobado = $aprobadoValor === null ? true : (bool) $aprobadoValor;

        return [
            'id' => $persona->id,
            'nombre' => trim(($persona->nombres ?? '') . ' ' . ($persona->apellidos ?? '')) ?: null,
            'cuil' => $persona->cuil,
            'telefono' => $persona->telefono,
            'email' => $persona->email,
            'cliente' => $persona->cliente?->nombre,
            'unidad' => $persona->unidad?->matricula,
            'unidadDetalle' => $persona->unidad ? trim(($persona->unidad->marca ?? '') . ' ' . ($persona->unidad->modelo ?? '')) ?: null : null,
            'fechaAlta' => optional($persona->fecha_alta)->format('Y-m-d'),
            'sucursal' => $persona->sucursal?->nombre,
            'perfil' => $perfil,
            'perfilValue' => $persona->tipo,
            'agente' => $persona->agente?->name,
            'agenteId' => $persona->agente_id,
            'agenteResponsable' => $persona->agenteResponsable?->name,
            'agenteResponsableId' => $persona->agente_responsable_id,
            'estado' => $persona->estado?->nombre,
            'combustible' => $persona->combustible ? 'Sí' : 'No',
            'combustibleValue' => (bool) $persona->combustible,
            'tarifaEspecial' => $persona->tarifaespecial ? 'Sí' : 'No',
            'tarifaEspecialValue' => (bool) $persona->tarifaespecial,
            'aprobado' => $aprobado,
            'aprobadoAt' => optional($persona->aprobado_at)->format('Y-m-d H:i:s'),
            'aprobadoPor' => $persona->aprobadoPor?->name,
            'esSolicitud' => (bool) $persona->es_solicitud,
        ];
    }
}

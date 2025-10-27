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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PersonalController extends Controller
{
    public function index(): JsonResponse
    {
        $personas = Persona::query()
            ->with([
                'cliente:id,nombre',
                'unidad:id,matricula,marca,modelo',
                'sucursal:id,nombre',
                'agente:id,name',
                'estado:id,nombre',
            ])
            ->orderByDesc('id')
            ->get()
            ->map(function (Persona $persona) {
                $perfilMap = [
                    1 => 'Dueño y chofer',
                    2 => 'Chofer',
                    3 => 'Transportista',
                ];
                $perfil = $persona->tipo !== null ? ($perfilMap[$persona->tipo] ?? 'Perfil '.$persona->tipo) : null;

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
                    'estado' => $persona->estado?->nombre,
                    'combustible' => $persona->combustible ? 'Sí' : 'No',
                    'combustibleValue' => (bool) $persona->combustible,
                    'tarifaEspecial' => $persona->tarifaespecial ? 'Sí' : 'No',
                    'tarifaEspecialValue' => (bool) $persona->tarifaespecial,
                ];
            })
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
            'estado:id,nombre',
            'documentos' => fn ($query) => $query->with('tipo:id,nombre,vence')->orderByDesc('created_at'),
        ]);

        $perfilMap = [
            1 => 'Dueño y chofer',
            2 => 'Chofer',
            3 => 'Transportista',
        ];
        $perfil = $persona->tipo !== null ? ($perfilMap[$persona->tipo] ?? 'Perfil '.$persona->tipo) : null;

        return response()->json([
            'data' => [
                'id' => $persona->id,
                'nombres' => $persona->nombres,
                'apellidos' => $persona->apellidos,
                'cuil' => $persona->cuil,
                'telefono' => $persona->telefono,
                'email' => $persona->email,
                'perfil' => $perfil,
                'perfilValue' => $persona->tipo,
                'agente' => $persona->agente?->name,
                'agenteId' => $persona->agente_id,
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
                'pago' => $persona->pago,
                'cbuAlias' => $persona->cbu_alias,
                'patente' => $persona->patente,
                'observacionTarifa' => $persona->observaciontarifa,
                'observaciones' => $persona->observaciones,
                'fechaAlta' => optional($persona->fecha_alta)->format('Y-m-d'),
                'documents' => $persona->documentos->map(function ($documento) {
                    return [
                        'id' => $documento->id,
                        'nombre' => $documento->nombre_original ?? basename($documento->ruta ?? ''),
                        'downloadUrl' => $documento->download_url,
                        'mime' => $documento->mime,
                        'size' => $documento->size,
                        'fechaVencimiento' => optional($documento->fecha_vencimiento)->format('Y-m-d'),
                        'tipoId' => $documento->tipo_archivo_id,
                        'tipoNombre' => $documento->tipo?->nombre,
                        'requiereVencimiento' => (bool) $documento->tipo?->vence,
                    ];
                })->values(),
            ],
        ]);
    }

    public function update(Request $request, Persona $persona): JsonResponse
    {
        $validated = $request->validate([
            'observacionTarifa' => ['nullable', 'string'],
            'observaciones' => ['nullable', 'string'],
        ]);

        $persona->observaciontarifa = $validated['observacionTarifa'] ?? null;
        $persona->observaciones = $validated['observaciones'] ?? null;
        $persona->save();

        return response()->json([
            'message' => 'Información actualizada correctamente.',
            'data' => [
                'observacionTarifa' => $persona->observaciontarifa,
                'observaciones' => $persona->observaciones,
            ],
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
        ]);

        $persona = Persona::create([
            'nombres' => $validated['nombres'],
            'apellidos' => $validated['apellidos'],
            'cuil' => $validated['cuil'] ?? null,
            'telefono' => $validated['telefono'] ?? null,
            'email' => $validated['email'] ?? null,
            'tipo' => $validated['perfilValue'] ?? null,
            'agente_id' => $validated['agenteId'] ?? null,
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

        return response()->json([
            'message' => 'Personal registrado correctamente.',
            'data' => [
                'id' => $persona->id,
            ],
        ], 201);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Persona;
use App\Models\Cliente;
use App\Models\Unidad;
use App\Models\Sucursal;
use App\Models\Estado;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\UploadedFile;

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
            ->orderBy('id')
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
            'documentos' => fn ($query) => $query->orderByDesc('created_at'),
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

    public function storeDocument(Request $request, Persona $persona): JsonResponse
    {
        $validated = $request->validate([
            'archivo' => ['required', 'file', 'max:5120'],
            'nombre' => ['nullable', 'string'],
        ]);

        /** @var UploadedFile $file */
        $file = $validated['archivo'];
        $disk = 'public';
        $directory = 'personal/'.$persona->id;
        $storedPath = $file->store($directory, $disk);

        $downloadUrl = Storage::disk($disk)->url($storedPath);

        $documento = $persona->documentos()->create([
            'carpeta' => $directory,
            'ruta' => $storedPath,
            'download_url' => $downloadUrl,
            'disk' => $disk,
            'nombre_original' => $validated['nombre'] ?? $file->getClientOriginalName(),
            'mime' => $file->getClientMimeType(),
            'size' => $file->getSize(),
        ]);

        return response()->json([
            'message' => 'Documento cargado correctamente.',
            'data' => [
                'id' => $documento->id,
                'nombre' => $documento->nombre_original,
                'downloadUrl' => $documento->download_url,
                'mime' => $documento->mime,
                'size' => $documento->size,
                'fechaVencimiento' => optional($documento->fecha_vencimiento)->format('Y-m-d'),
            ],
        ], 201);
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

        return response()->json([
            'message' => 'Personal registrado correctamente.',
            'data' => [
                'id' => $persona->id,
            ],
        ], 201);
    }
}

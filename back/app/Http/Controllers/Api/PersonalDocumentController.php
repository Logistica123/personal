<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FileType;
use App\Models\Persona;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class PersonalDocumentController extends Controller
{
    public function index(Persona $persona): JsonResponse
    {
        $documentos = $persona->documentos()
            ->with(['tipo:id,nombre,vence'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($documento) {
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
            })
            ->values();

        return response()->json([
            'data' => $documentos,
        ]);
    }

    public function types(): JsonResponse
    {
        $tipos = FileType::query()
            ->select('id', 'nombre', 'vence')
            ->orderBy('nombre')
            ->get()
            ->map(function (FileType $tipo) {
                return [
                    'id' => $tipo->id,
                    'nombre' => $tipo->nombre,
                    'vence' => (bool) $tipo->vence,
                ];
            })
            ->values();

        return response()->json([
            'data' => $tipos,
        ]);
    }

    public function storeType(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'vence' => ['required', 'boolean'],
        ]);

        $tipo = FileType::query()->create([
            'nombre' => $validated['nombre'],
            'vence' => $validated['vence'],
        ]);

        return response()->json([
            'message' => 'Tipo de documento creado correctamente.',
            'data' => [
                'id' => $tipo->id,
                'nombre' => $tipo->nombre,
                'vence' => (bool) $tipo->vence,
            ],
        ], 201);
    }

    public function show(FileType $tipo): JsonResponse
    {
        return response()->json([
            'data' => [
                'id' => $tipo->id,
                'nombre' => $tipo->nombre,
                'vence' => (bool) $tipo->vence,
            ],
        ]);
    }

    public function store(Request $request, Persona $persona): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'archivo' => ['required', 'file', 'max:5120'],
            'nombre' => ['nullable', 'string'],
            'tipoArchivoId' => ['required', 'integer', 'exists:fyle_types,id'],
            'fechaVencimiento' => ['nullable', 'date'],
        ], [
            'tipoArchivoId.required' => 'Selecciona el tipo de documento.',
            'tipoArchivoId.exists' => 'El tipo de documento seleccionado no es válido.',
        ]);

        $validator->after(function ($validator) use ($request) {
            $tipoId = $request->input('tipoArchivoId');
            if (! $tipoId) {
                return;
            }

            $tipo = FileType::query()->find($tipoId);
            if (! $tipo) {
                return;
            }

            if ($tipo->vence && ! $request->filled('fechaVencimiento')) {
                $validator->errors()->add('fechaVencimiento', 'Este tipo de documento requiere fecha de vencimiento.');
            }
        });

        $validated = $validator->validate();

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
            'tipo_archivo_id' => $validated['tipoArchivoId'],
            'fecha_vencimiento' => $validated['fechaVencimiento']
                ? Carbon::parse($validated['fechaVencimiento'])
                : null,
        ]);

        $documento->loadMissing('tipo:id,nombre,vence');

        return response()->json([
            'message' => 'Documento cargado correctamente.',
            'data' => [
                'id' => $documento->id,
                'nombre' => $documento->nombre_original,
                'downloadUrl' => $documento->download_url,
                'mime' => $documento->mime,
                'size' => $documento->size,
                'fechaVencimiento' => optional($documento->fecha_vencimiento)->format('Y-m-d'),
                'tipoId' => $documento->tipo_archivo_id,
                'tipoNombre' => $documento->tipo?->nombre,
                'requiereVencimiento' => (bool) $documento->tipo?->vence,
            ],
        ], 201);
    }

    public function update(Request $request, FileType $tipo): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'vence' => ['required', 'boolean'],
        ]);

        $tipo->nombre = $validated['nombre'];
        $tipo->vence = $validated['vence'];
        $tipo->save();

        return response()->json([
            'message' => 'Tipo de documento actualizado correctamente.',
            'data' => [
                'id' => $tipo->id,
                'nombre' => $tipo->nombre,
                'vence' => (bool) $tipo->vence,
            ],
        ]);
    }
}

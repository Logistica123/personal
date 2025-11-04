<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FileType;
use App\Models\Persona;
use App\Models\Archivo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class PersonalDocumentController extends Controller
{
    public function index(Persona $persona): JsonResponse
    {
        $documentos = $persona->documentos()
            ->with(['tipo:id,nombre,vence'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($documento) {
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

    public function liquidaciones(Persona $persona): JsonResponse
    {
        $liquidacionTypeIds = FileType::query()
            ->select('id', 'nombre')
            ->get()
            ->filter(function (FileType $tipo) {
                $nombre = Str::lower($tipo->nombre ?? '');
                return $nombre !== '' && Str::contains($nombre, 'liquid');
            })
            ->pluck('id');

        $documentos = $persona->documentos()
            ->with(['tipo:id,nombre,vence'])
            ->when($liquidacionTypeIds->isNotEmpty(), function ($query) use ($liquidacionTypeIds) {
                $query->whereIn('tipo_archivo_id', $liquidacionTypeIds);
            }, function ($query) {
                $query->where(function ($inner) {
                    $inner
                        ->whereRaw('LOWER(nombre_original) LIKE ?', ['%liquid%'])
                        ->orWhereRaw('LOWER(ruta) LIKE ?', ['%liquid%']);
                });
            })
            ->orderByDesc('created_at')
            ->get()
            ->map(function (Archivo $documento) use ($persona) {
                $relativeDownloadUrl = route('personal.documentos.descargar', [
                    'persona' => $persona->id,
                    'documento' => $documento->id,
                ], false);

                $absoluteDownloadUrl = route('personal.documentos.descargar', [
                    'persona' => $persona->id,
                    'documento' => $documento->id,
                ], true);

                $nombre = $documento->nombre_original
                    ?? $documento->tipo?->nombre
                    ?? basename($documento->ruta ?? '') ?: 'Liquidación';

                return [
                    'id' => $documento->id,
                    'nombre' => $nombre,
                    'downloadUrl' => $relativeDownloadUrl,
                    'absoluteDownloadUrl' => $absoluteDownloadUrl,
                    'mime' => $documento->mime,
                    'size' => $documento->size,
                    'sizeLabel' => $this->formatFileSize($documento->size),
                    'fechaCarga' => optional($documento->created_at)->format('Y-m-d'),
                    'fechaCargaIso' => optional($documento->created_at)->toIso8601String(),
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
        if ($request->boolean('esLiquidacion')) {
            $liquidacionType = FileType::query()->firstOrCreate(
                ['nombre' => 'Liquidación'],
                ['vence' => false]
            );

            $request->merge([
                'tipoArchivoId' => $liquidacionType->id,
            ]);
        }

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

        $fechaVencimiento = $validated['fechaVencimiento'] ?? null;

        $documento = $persona->documentos()->create([
            'carpeta' => $directory,
            'ruta' => $storedPath,
            'download_url' => null,
            'disk' => $disk,
            'nombre_original' => $validated['nombre'] ?? $file->getClientOriginalName(),
            'mime' => $file->getClientMimeType(),
            'size' => $file->getSize(),
            'tipo_archivo_id' => $validated['tipoArchivoId'],
            'fecha_vencimiento' => $fechaVencimiento
                ? Carbon::parse($fechaVencimiento)
                : null,
        ]);

        $documento->loadMissing('tipo:id,nombre,vence');

        $downloadUrl = route('personal.documentos.descargar', [
            'persona' => $persona->id,
            'documento' => $documento->id,
        ], false);

        $documento->download_url = $downloadUrl;
        $documento->save();

        return response()->json([
            'message' => 'Documento cargado correctamente.',
            'data' => [
                'id' => $documento->id,
                'nombre' => $documento->nombre_original,
                'downloadUrl' => $downloadUrl,
                'mime' => $documento->mime,
                'size' => $documento->size,
                'fechaVencimiento' => optional($documento->fecha_vencimiento)->format('Y-m-d'),
                'tipoId' => $documento->tipo_archivo_id,
                'tipoNombre' => $documento->tipo?->nombre,
                'requiereVencimiento' => (bool) $documento->tipo?->vence,
            ],
        ], 201);
    }

    public function download(Persona $persona, Archivo $documento)
    {
        if ($documento->persona_id !== $persona->id) {
            abort(404);
        }

        $documento->loadMissing('tipo:id,nombre');

        $disk = $documento->disk ?: config('filesystems.default', 'public');
        $disks = config('filesystems.disks', []);
        $hasDisk = $disk && array_key_exists($disk, $disks);
        $downloadUrl = $documento->download_url;
        $fileName = $this->buildDownloadFileName($documento, $downloadUrl);

        if (! $hasDisk) {
            return $this->streamExternalFile($downloadUrl, $fileName, $documento->mime);
        }

        $path = $documento->ruta;

        if (! $path || ! Storage::disk($disk)->exists($path)) {
            return $this->streamExternalFile($downloadUrl, $fileName, $documento->mime);
        }

        return Storage::disk($disk)->download($path, $fileName);
    }

    protected function streamExternalFile(?string $url, string $fileName, ?string $mime = null)
    {
        if (! $url || ! preg_match('/^https?:\/\//i', $url)) {
            abort(404, 'El archivo solicitado no está disponible.');
        }

        try {
            $response = Http::withOptions(['stream' => true])->get($url);
        } catch (\Throwable $exception) {
            report($exception);
            abort(404, 'No se pudo acceder al archivo solicitado.');
        }

        if ($response->failed()) {
            abort(404, 'El archivo solicitado no está disponible.');
        }

        $psrResponse = $response->toPsrResponse();
        $stream = $psrResponse->getBody();

        $contentType = $mime ?: $response->header('Content-Type') ?: 'application/octet-stream';

        return response()->streamDownload(function () use ($stream) {
            while (! $stream->eof()) {
                echo $stream->read(8192);
            }
            $stream->close();
        }, $fileName, [
            'Content-Type' => $contentType,
        ]);
    }

    protected function buildDownloadFileName(Archivo $documento, ?string $downloadUrl): string
    {
        $tipoNombre = $documento->tipo?->nombre;
        $nombreArchivo = $documento->nombre_original;

        if ($tipoNombre && $nombreArchivo) {
            $baseName = trim($tipoNombre).' - '.trim($nombreArchivo);
        } elseif ($tipoNombre) {
            $baseName = trim($tipoNombre);
        } elseif ($nombreArchivo) {
            $baseName = trim($nombreArchivo);
        } else {
            $baseName = basename($documento->ruta ?? '') ?: 'documento';
        }

        $baseName = trim($baseName);

        $extension = $this->resolveExtension($documento, $downloadUrl);

        if ($extension) {
            $extension = ltrim($extension, '.');

            // Si el nombre compuesto ya termina con la extensión, no la duplicamos
            if (! str_ends_with(strtolower($baseName), '.'.strtolower($extension))) {
                return sprintf('%s.%s', $baseName, $extension);
            }
        }

        return $baseName;
    }

    protected function resolveExtension(Archivo $documento, ?string $downloadUrl): ?string
    {
        $candidates = [
            $documento->nombre_original,
            $documento->ruta,
        ];

        if ($downloadUrl) {
            $parsed = parse_url($downloadUrl, PHP_URL_PATH);
            if ($parsed) {
                $candidates[] = $parsed;
            }
        }

        foreach ($candidates as $candidate) {
            if (! $candidate) {
                continue;
            }

            $extension = pathinfo($candidate, PATHINFO_EXTENSION);
            if ($extension) {
                return $extension;
            }
        }

        if ($documento->mime) {
            $map = [
                'image/jpeg' => 'jpg',
                'image/jpg' => 'jpg',
                'image/png' => 'png',
                'image/gif' => 'gif',
                'application/pdf' => 'pdf',
            ];

            return $map[strtolower($documento->mime)] ?? null;
        }

        return null;
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

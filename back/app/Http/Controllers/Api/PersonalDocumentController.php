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
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use ZipArchive;
use App\Services\AuditLogger;

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
                    'parentDocumentId' => $documento->parent_document_id,
                    'isAttachment' => $documento->parent_document_id !== null,
                    'nombre' => $documento->nombre_original ?? basename($documento->ruta ?? ''),
                    'downloadUrl' => $downloadUrl,
                    'mime' => $documento->mime,
                    'size' => $documento->size,
                    'fechaVencimiento' => optional($documento->fecha_vencimiento)->format('Y-m-d'),
                    'tipoId' => $documento->tipo_archivo_id,
                    'tipoNombre' => $documento->tipo?->nombre,
                    'requiereVencimiento' => (bool) $documento->tipo?->vence,
                    'importeFacturar' => $documento->importe_facturar,
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

        $fuelTypeIds = $this->resolveFuelTypeIds();

        $documentTypeIds = $liquidacionTypeIds
            ->merge($fuelTypeIds)
            ->unique()
            ->values();

        $documentos = $persona->documentos()
            ->with([
                'tipo:id,nombre,vence',
                'children:id,parent_document_id,nombre_original,tipo_archivo_id',
                'children.tipo:id,nombre',
            ])
            ->when($documentTypeIds->isNotEmpty(), function ($query) use ($documentTypeIds) {
                $query->whereIn('tipo_archivo_id', $documentTypeIds);
            }, function ($query) {
                $query->where(function ($inner) {
                    $inner
                        ->whereRaw('LOWER(nombre_original) LIKE ?', ['%liquid%'])
                        ->orWhereRaw('LOWER(ruta) LIKE ?', ['%liquid%'])
                        ->orWhereRaw('LOWER(nombre_original) LIKE ?', ['%combust%'])
                        ->orWhereRaw('LOWER(ruta) LIKE ?', ['%combust%']);
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
                $importeCombustible = $this->resolveFuelAmountForDocument($documento, $nombre);

                return [
                    'id' => $documento->id,
                    'parentDocumentId' => $documento->parent_document_id,
                    'isAttachment' => $documento->parent_document_id !== null,
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
                    'importeCombustible' => $importeCombustible,
                    'importeFacturar' => $documento->importe_facturar,
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

        if ($request->boolean('esFacturaCombustible')) {
            $combustibleType = FileType::query()->firstOrCreate(
                ['nombre' => 'Factura combustible'],
                ['vence' => false]
            );

            $request->merge([
                'tipoArchivoId' => $combustibleType->id,
            ]);
        }

        $validator = Validator::make($request->all(), [
            'archivo' => ['required', 'file', 'max:51200'],
            'nombre' => ['nullable', 'string'],
            'tipoArchivoId' => ['required', 'integer', 'exists:fyle_types,id'],
            'fechaVencimiento' => ['nullable', 'date'],
            'importeCombustible' => ['nullable', 'numeric', 'min:0'],
            'importeFacturar' => ['nullable', 'numeric', 'min:0'],
            'attachFuelInvoices' => ['nullable', 'boolean'],
        ], [
            'tipoArchivoId.required' => 'Selecciona el tipo de documento.',
            'tipoArchivoId.exists' => 'El tipo de documento seleccionado no es válido.',
            'archivo.max' => 'El archivo es demasiado grande. Permitimos hasta 50 MB por liquidación.',
            'importeCombustible.numeric' => 'El importe de combustible debe ser numérico.',
            'importeFacturar.numeric' => 'El importe a facturar debe ser numérico.',
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

            if ($request->boolean('esFacturaCombustible')) {
                if (! $request->filled('importeCombustible')) {
                    $validator->errors()->add('importeCombustible', 'Ingresá el importe de la factura de combustible.');
                }
            }
        });

        $validated = $validator->validate();

        $parentDocumentId = $this->resolveParentDocumentId($request, $persona);

        Log::info('Documento recibido', [
            'persona_id' => $persona->id,
            'tipo_archivo_id' => $validated['tipoArchivoId'] ?? null,
            'fecha_vencimiento_input' => $request->input('fechaVencimiento'),
            'fecha_vencimiento_validated' => $validated['fechaVencimiento'] ?? null,
            'es_liquidacion' => $request->boolean('esLiquidacion'),
        ]);

        /** @var UploadedFile $file */
        $file = $validated['archivo'];
        $disk = 'public';
        $directory = 'personal/'.$persona->id;
        $storedPath = $file->store($directory, $disk);

        $fechaVencimiento = $validated['fechaVencimiento'] ?? null;

        $parsedFecha = $fechaVencimiento ? Carbon::parse($fechaVencimiento) : null;

        $nombreOriginal = $validated['nombre'] ?? $file->getClientOriginalName();

        if ($request->boolean('esFacturaCombustible') && $request->filled('importeCombustible')) {
            $nombreOriginal = sprintf(
                'Factura combustible - $%s - %s',
                $request->input('importeCombustible'),
                $nombreOriginal
            );
        }

        $documento = $persona->documentos()->create([
            'carpeta' => $directory,
            'ruta' => $storedPath,
            'parent_document_id' => $parentDocumentId,
            'download_url' => null,
            'disk' => $disk,
            'nombre_original' => $nombreOriginal,
            'mime' => $file->getClientMimeType(),
            'size' => $file->getSize(),
            'tipo_archivo_id' => $validated['tipoArchivoId'],
            'fecha_vencimiento' => $parsedFecha,
            'importe_facturar' => $validated['importeFacturar'] ?? null,
        ]);

        if ($parsedFecha) {
            $documento->created_at = $parsedFecha;
            $documento->updated_at = $parsedFecha;
            $documento->save();
        }

        $documento->loadMissing('tipo:id,nombre,vence');

        $downloadUrl = route('personal.documentos.descargar', [
            'persona' => $persona->id,
            'documento' => $documento->id,
        ], false);

        $absoluteDownloadUrl = route('personal.documentos.descargar', [
            'persona' => $persona->id,
            'documento' => $documento->id,
        ], true);

        $documento->download_url = $downloadUrl;
        $documento->save();

        Log::info('Liquidación cargada', [
            'persona_id' => $persona->id,
            'documento_id' => $documento->id,
            'nombre' => $documento->nombre_original,
            'size' => $documento->size,
            'parent_document_id' => $parentDocumentId,
            'origin' => $request->header('User-Agent'),
        ]);

        if ($request->boolean('esLiquidacion') && $request->boolean('attachFuelInvoices')) {
            $this->attachPendingFuelInvoices($persona, $documento);
        }

        AuditLogger::log($request, 'document_create', 'documento', $documento->id, [
            'persona_id' => $persona->id,
            'nombre' => $documento->nombre_original,
            'tipo_archivo_id' => $documento->tipo_archivo_id,
            'size' => $documento->size,
        ]);

        return response()->json([
            'message' => 'Documento cargado correctamente.',
            'data' => [
                'id' => $documento->id,
                'parentDocumentId' => $documento->parent_document_id,
                'nombre' => $documento->nombre_original,
                'downloadUrl' => $downloadUrl,
                'absoluteDownloadUrl' => $absoluteDownloadUrl,
                'mime' => $documento->mime,
                'size' => $documento->size,
                'fechaVencimiento' => optional($documento->fecha_vencimiento)->format('Y-m-d'),
                'tipoId' => $documento->tipo_archivo_id,
                'tipoNombre' => $documento->tipo?->nombre,
                'requiereVencimiento' => (bool) $documento->tipo?->vence,
                'importeCombustible' => $request->input('importeCombustible'),
                'importeFacturar' => $documento->importe_facturar,
            ],
        ], 201);
    }

    public function updateDocument(Request $request, Persona $persona, Archivo $documento): JsonResponse
    {
        if ($documento->persona_id !== $persona->id) {
            abort(404);
        }

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
            'archivo' => ['nullable', 'file', 'max:51200'],
            'nombre' => ['nullable', 'string'],
            'tipoArchivoId' => ['nullable', 'integer', 'exists:fyle_types,id'],
            'fechaVencimiento' => ['nullable', 'date'],
            'importeFacturar' => ['nullable', 'numeric', 'min:0'],
        ], [
            'tipoArchivoId.exists' => 'El tipo de documento seleccionado no es válido.',
            'archivo.max' => 'El archivo es demasiado grande. Permitimos hasta 50 MB por liquidación.',
            'importeFacturar.numeric' => 'El importe a facturar debe ser numérico.',
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

        $parentDocumentId = null;
        $hasParentAssignment = $request->has('parentDocumentId') || $request->has('parent_document_id');

        if ($hasParentAssignment) {
            $parentDocumentId = $this->resolveParentDocumentId($request, $persona);

            if ($parentDocumentId === $documento->id) {
                throw ValidationException::withMessages([
                    'parentDocumentId' => ['No podés adjuntar la liquidación sobre sí misma.'],
                ]);
            }
        }

        /** @var UploadedFile|null $file */
        $file = $request->file('archivo');
        $disk = $documento->disk ?: 'public';
        $directory = $documento->carpeta ?: 'personal/'.$persona->id;
        $storedPath = $documento->ruta;

        if ($file) {
            $storedPath = $file->store($directory, $disk);

            if ($documento->ruta && Storage::disk($disk)->exists($documento->ruta)) {
                Storage::disk($disk)->delete($documento->ruta);
            }

            $documento->nombre_original = $validated['nombre'] ?? $file->getClientOriginalName();
            $documento->mime = $file->getClientMimeType();
            $documento->size = $file->getSize();
        } elseif ($request->filled('nombre')) {
            $documento->nombre_original = $validated['nombre'];
        }

        $documento->carpeta = $directory;
        $documento->ruta = $storedPath;
        $documento->download_url = route('personal.documentos.descargar', [
            'persona' => $persona->id,
            'documento' => $documento->id,
        ], false);

        if (! empty($validated['tipoArchivoId'])) {
            $documento->tipo_archivo_id = $validated['tipoArchivoId'];
        }

        $fechaVencimiento = $validated['fechaVencimiento'] ?? null;
        $parsedFecha = $fechaVencimiento ? Carbon::parse($fechaVencimiento) : null;
        $documento->fecha_vencimiento = $parsedFecha;
        if ($parsedFecha) {
            $documento->created_at = $parsedFecha;
        }

        if ($hasParentAssignment) {
            $documento->parent_document_id = $parentDocumentId;
        }

        if (array_key_exists('importeFacturar', $validated)) {
            $documento->importe_facturar = $validated['importeFacturar'] ?? null;
        }

        $documento->save();
        $documento->loadMissing('tipo:id,nombre,vence');

        return response()->json([
            'message' => 'Liquidación actualizada correctamente.',
            'data' => [
                'id' => $documento->id,
                'parentDocumentId' => $documento->parent_document_id,
                'isAttachment' => $documento->parent_document_id !== null,
                'nombre' => $documento->nombre_original,
                'downloadUrl' => $documento->download_url,
                'absoluteDownloadUrl' => route('personal.documentos.descargar', [
                    'persona' => $persona->id,
                    'documento' => $documento->id,
                ], true),
                'mime' => $documento->mime,
                'size' => $documento->size,
                'sizeLabel' => $this->formatFileSize($documento->size),
                'fechaCarga' => optional($documento->created_at)->format('Y-m-d'),
                'fechaVencimiento' => optional($documento->fecha_vencimiento)->format('Y-m-d'),
                'tipoId' => $documento->tipo_archivo_id,
                'tipoNombre' => $documento->tipo?->nombre,
                'requiereVencimiento' => (bool) $documento->tipo?->vence,
                'importeFacturar' => $documento->importe_facturar,
            ],
        ]);
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

    public function downloadAll(Persona $persona)
    {
        if (! class_exists(ZipArchive::class)) {
            abort(500, 'La funcionalidad de compresión no está disponible en el servidor.');
        }

        $documentos = $persona->documentos()
            ->with(['tipo:id,nombre'])
            ->orderByDesc('created_at')
            ->get();

        if ($documentos->isEmpty()) {
            abort(404, 'No hay documentos disponibles para descargar.');
        }

        $slugBase = Str::slug(trim(implode(' ', array_filter([$persona->apellidos, $persona->nombres]))) ?: 'personal');
        $zipFileName = sprintf('%s-documentos-%s.zip', $slugBase, Carbon::now()->format('YmdHis'));
        $tempPath = tempnam(sys_get_temp_dir(), 'docs_zip_');

        if ($tempPath === false) {
            abort(500, 'No se pudo preparar el archivo para la descarga.');
        }

        $zip = new ZipArchive();
        if ($zip->open($tempPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            @unlink($tempPath);
            abort(500, 'No se pudo generar el archivo comprimido.');
        }

        $addedFiles = 0;

        foreach ($documentos as $documento) {
            $fileName = sprintf(
                '%03d-%s',
                $documento->id,
                $this->buildDownloadFileName($documento, $documento->download_url)
            );

            if ($this->addDocumentToZip($zip, $documento, $fileName)) {
                $addedFiles++;
            }
        }

        $zip->close();

        if ($addedFiles === 0) {
            @unlink($tempPath);
            abort(404, 'No hay documentos disponibles para descargar.');
        }

        return response()->download($tempPath, $zipFileName)->deleteFileAfterSend();
    }

    protected function deleteStoredFile(Archivo $documento): void
    {
        $disk = $documento->disk ?: config('filesystems.default', 'public');

        if (! $disk) {
            return;
        }

        if (! $documento->ruta) {
            return;
        }

        try {
            if (Storage::disk($disk)->exists($documento->ruta)) {
                Storage::disk($disk)->delete($documento->ruta);
            }
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    protected function addDocumentToZip(ZipArchive $zip, Archivo $documento, string $fileName): bool
    {
        $disk = $documento->disk ?: config('filesystems.default', 'public');
        $path = $documento->ruta;

        if ($disk && $path) {
            $disks = config('filesystems.disks', []);

            if ($disk && array_key_exists($disk, $disks)) {
                try {
                    if (Storage::disk($disk)->exists($path)) {
                        $stream = Storage::disk($disk)->readStream($path);

                        if ($stream) {
                            $contents = stream_get_contents($stream);
                            fclose($stream);

                            if ($contents !== false) {
                                return $zip->addFromString($fileName, $contents);
                            }
                        }
                    }
                } catch (\Throwable $exception) {
                    Log::warning('Error al agregar documento local al zip', [
                        'documento_id' => $documento->id,
                        'error' => $exception->getMessage(),
                    ]);
                }
            }
        }

        return $this->addExternalDocumentToZip($zip, $documento, $fileName);
    }

    protected function addExternalDocumentToZip(ZipArchive $zip, Archivo $documento, string $fileName): bool
    {
        $downloadUrl = $documento->download_url;

        if (! $downloadUrl || ! preg_match('/^https?:\/\//i', $downloadUrl)) {
            return false;
        }

        try {
            $response = Http::withOptions(['stream' => true])->get($downloadUrl);

            if ($response->failed()) {
                return false;
            }

            $psrResponse = $response->toPsrResponse();
            $stream = $psrResponse->getBody();
            $contents = stream_get_contents($stream);
            $stream->close();

            if ($contents === false) {
                return false;
            }

            return $zip->addFromString($fileName, $contents);
        } catch (\Throwable $exception) {
            Log::warning('Error al agregar documento externo al zip', [
                'documento_id' => $documento->id,
                'download_url' => $downloadUrl,
                'error' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    protected function resolveParentDocumentId(Request $request, Persona $persona): ?int
    {
        $raw = $request->input('parentDocumentId', $request->input('parent_document_id'));

        if ($raw === null || $raw === '') {
            return null;
        }

        if (! is_numeric($raw)) {
            throw ValidationException::withMessages([
                'parentDocumentId' => ['El identificador de la liquidación principal no es válido.'],
            ]);
        }

        $parentId = (int) $raw;

        $parent = $persona->documentos()
            ->where('id', $parentId)
            ->whereNull('parent_document_id')
            ->first();

        if (! $parent) {
            throw ValidationException::withMessages([
                'parentDocumentId' => ['La liquidación seleccionada para adjuntar no existe o ya es un adjunto.'],
            ]);
        }

        return $parentId;
    }

    protected function attachPendingFuelInvoices(Persona $persona, Archivo $liquidacion): void
    {
        $fuelTypeIds = $this->resolveFuelTypeIds();

        $pendingInvoices = $persona->documentos()
            ->when($fuelTypeIds->isNotEmpty(), function ($query) use ($fuelTypeIds) {
                $query->whereIn('tipo_archivo_id', $fuelTypeIds);
            }, function ($query) {
                $query->where(function ($inner) {
                    $inner->whereRaw('LOWER(nombre_original) LIKE ?', ['%combust%'])
                        ->orWhereRaw('LOWER(ruta) LIKE ?', ['%combust%']);
                });
            })
            ->whereNull('parent_document_id')
            ->where('id', '<>', $liquidacion->id)
            ->get();

        if ($pendingInvoices->isEmpty()) {
            throw ValidationException::withMessages([
                'facturaCombustible' => ['Debes cargar la factura de combustible antes de enviar la liquidación.'],
            ]);
        }

        foreach ($pendingInvoices as $invoice) {
            $invoice->parent_document_id = $liquidacion->id;
            $invoice->save();
        }
    }

    protected function resolveFuelTypeIds()
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

    public function destroy(Persona $persona, Archivo $documento): JsonResponse
    {
        if ($documento->persona_id !== $persona->id) {
            abort(404);
        }

        $attachments = $documento->children()->get();

        foreach ($attachments as $attachment) {
            $this->deleteStoredFile($attachment);
            $attachment->delete();
        }

        $this->deleteStoredFile($documento);

        $documento->delete();

        AuditLogger::log(request(), 'document_delete', 'documento', $documento->id, [
            'persona_id' => $persona->id,
            'nombre' => $documento->nombre_original,
            'tipo_archivo_id' => $documento->tipo_archivo_id,
        ]);

        return response()->json([
            'message' => 'Liquidación eliminada correctamente.',
        ]);
    }
}

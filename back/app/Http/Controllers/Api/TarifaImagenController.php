<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TarifaImagen;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class TarifaImagenController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $this->normalizeOptionalFilters($request);
        $search = $filters['search'];

        $query = TarifaImagen::query()
            ->with(['cliente:id,nombre', 'sucursal:id,nombre']);

        if ($filters['cliente_id']) {
            $query->where('cliente_id', $filters['cliente_id']);
        }
        if ($filters['sucursal_id']) {
            $query->where('sucursal_id', $filters['sucursal_id']);
        }
        if ($filters['mes']) {
            $query->where('mes', $filters['mes']);
        }
        if ($filters['anio']) {
            $query->where('anio', $filters['anio']);
        }
        if ($search) {
            $query->where(function ($inner) use ($search) {
                $inner->where('nombre_original', 'like', '%'.$search.'%')
                    ->orWhereHas('cliente', fn ($sub) => $sub->where('nombre', 'like', '%'.$search.'%'))
                    ->orWhereHas('sucursal', fn ($sub) => $sub->where('nombre', 'like', '%'.$search.'%'));
            });
        }

        $records = $query->orderByDesc('updated_at')->get();

        return response()->json([
            'data' => $records->map(function (TarifaImagen $record) use ($request) {
                $publicUrl = $this->buildPublicUrl($request, $record->disk, $record->path);
                return $this->transform($record, $publicUrl, [
                    'clienteNombre' => $record->cliente?->nombre,
                    'sucursalNombre' => $record->sucursal?->nombre,
                ]);
            }),
        ]);
    }

    public function show(Request $request): JsonResponse
    {
        $filters = $this->normalizeFilters($request);

        $record = $this->queryByFilters($filters)->first();
        $publicUrl = $record ? $this->buildPublicUrl($request, $record->disk, $record->path) : null;

        return response()->json([
            'data' => $record ? $this->transform($record, $publicUrl) : null,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $filters = $this->normalizeFilters($request);

        $validated = $request->validate([
            'archivo' => ['required', 'file', 'image', 'max:10240'],
        ]);

        $templateData = $this->normalizeTemplateData($request);

        /** @var UploadedFile $file */
        $file = $validated['archivo'];
        $disk = 'public';
        $directory = 'tarifas';
        $storedPath = $file->store($directory, $disk);
        $url = $this->buildPublicUrl($request, $disk, $storedPath);

        $record = $this->queryByFilters($filters)->first();

        if ($record) {
            $this->deleteStoredFile($record);
            $record->fill([
                'nombre_original' => $file->getClientOriginalName(),
                'disk' => $disk,
                'path' => $storedPath,
                'url' => $url,
                'mime' => $file->getClientMimeType(),
                'size' => $file->getSize(),
                'template_data' => $templateData ?? $record->template_data,
            ]);
            $record->save();
        } else {
            $record = TarifaImagen::create([
                'cliente_id' => $filters['cliente_id'],
                'sucursal_id' => $filters['sucursal_id'],
                'mes' => $filters['mes'],
                'anio' => $filters['anio'],
                'nombre_original' => $file->getClientOriginalName(),
                'disk' => $disk,
                'path' => $storedPath,
                'url' => $url,
                'mime' => $file->getClientMimeType(),
                'size' => $file->getSize(),
                'template_data' => $templateData,
            ]);
        }

        return response()->json([
            'message' => 'Imagen guardada correctamente.',
            'data' => $this->transform($record, $url),
        ], 201);
    }

    public function destroy(TarifaImagen $tarifaImagen): JsonResponse
    {
        $this->deleteStoredFile($tarifaImagen);
        $tarifaImagen->delete();

        return response()->json([
            'message' => 'Tarifa eliminada correctamente.',
        ]);
    }

    protected function normalizeFilters(Request $request): array
    {
        $input = $request->all();
        foreach (['clienteId', 'sucursalId', 'mes', 'anio'] as $key) {
            if (array_key_exists($key, $input) && $input[$key] === '') {
                $input[$key] = null;
            }
        }
        $request->merge($input);

        $validated = $request->validate([
            'clienteId' => ['nullable', 'integer', 'min:1'],
            'sucursalId' => ['nullable', 'integer', 'min:1'],
            'mes' => ['nullable', 'integer', 'min:1', 'max:12'],
            'anio' => ['nullable', 'integer', 'min:2000', 'max:2100'],
        ]);

        return [
            'cliente_id' => $validated['clienteId'] ?? null,
            'sucursal_id' => $validated['sucursalId'] ?? null,
            'mes' => $validated['mes'] ?? null,
            'anio' => $validated['anio'] ?? null,
        ];
    }

    protected function normalizeOptionalFilters(Request $request): array
    {
        $input = $request->all();
        foreach (['clienteId', 'sucursalId', 'mes', 'anio', 'search'] as $key) {
            if (array_key_exists($key, $input) && $input[$key] === '') {
                $input[$key] = null;
            }
        }
        $request->merge($input);

        $validated = $request->validate([
            'clienteId' => ['nullable', 'integer', 'min:1'],
            'sucursalId' => ['nullable', 'integer', 'min:1'],
            'mes' => ['nullable', 'integer', 'min:1', 'max:12'],
            'anio' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'search' => ['nullable', 'string', 'max:200'],
        ]);

        return [
            'cliente_id' => $validated['clienteId'] ?? null,
            'sucursal_id' => $validated['sucursalId'] ?? null,
            'mes' => $validated['mes'] ?? null,
            'anio' => $validated['anio'] ?? null,
            'search' => isset($validated['search']) && is_string($validated['search'])
                ? trim($validated['search'])
                : null,
        ];
    }

    protected function queryByFilters(array $filters)
    {
        return TarifaImagen::query()
            ->when($filters['cliente_id'] === null, fn ($query) => $query->whereNull('cliente_id'))
            ->when($filters['cliente_id'] !== null, fn ($query) => $query->where('cliente_id', $filters['cliente_id']))
            ->when($filters['sucursal_id'] === null, fn ($query) => $query->whereNull('sucursal_id'))
            ->when($filters['sucursal_id'] !== null, fn ($query) => $query->where('sucursal_id', $filters['sucursal_id']))
            ->when($filters['mes'] === null, fn ($query) => $query->whereNull('mes'))
            ->when($filters['mes'] !== null, fn ($query) => $query->where('mes', $filters['mes']))
            ->when($filters['anio'] === null, fn ($query) => $query->whereNull('anio'))
            ->when($filters['anio'] !== null, fn ($query) => $query->where('anio', $filters['anio']))
            ->orderByDesc('updated_at');
    }

    protected function transform(TarifaImagen $record, ?string $publicUrl, array $extra = []): array
    {
        return [
            'id' => $record->id,
            'clienteId' => $record->cliente_id,
            'sucursalId' => $record->sucursal_id,
            'mes' => $record->mes,
            'anio' => $record->anio,
            'nombreOriginal' => $record->nombre_original,
            'url' => $publicUrl ?? $record->url,
            'relativeUrl' => $this->buildRelativeUrl($record->disk, $record->path),
            'dataUrl' => $this->buildDataUrl($record),
            'templateData' => $record->template_data,
            'mime' => $record->mime,
            'size' => $record->size,
            'updatedAt' => $record->updated_at?->toIso8601String(),
            ...$extra,
        ];
    }

    protected function buildPublicUrl(Request $request, ?string $disk, ?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        $disk = $disk ?: config('filesystems.default', 'public');
        $url = $this->buildRelativeUrl($disk, $path);
        if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
            return $url;
        }

        $host = rtrim($request->getSchemeAndHttpHost(), '/');
        if (str_starts_with($url, '/')) {
            return $host.$url;
        }

        return $host.'/'.$url;
    }

    protected function buildRelativeUrl(?string $disk, ?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        $disk = $disk ?: config('filesystems.default', 'public');
        return Storage::disk($disk)->url($path);
    }

    protected function buildDataUrl(TarifaImagen $record): ?string
    {
        $disk = $record->disk ?: config('filesystems.default', 'public');
        $path = $record->path;
        if (! $path || ! Storage::disk($disk)->exists($path)) {
            return null;
        }

        $maxSizeBytes = 5 * 1024 * 1024;
        $size = $record->size ?? Storage::disk($disk)->size($path);
        if ($size > $maxSizeBytes) {
            return null;
        }

        $contents = Storage::disk($disk)->get($path);
        $mime = $record->mime ?: 'image/png';

        return 'data:'.$mime.';base64,'.base64_encode($contents);
    }

    protected function normalizeTemplateData(Request $request): ?array
    {
        $raw = $request->input('templateData');
        if (is_array($raw)) {
            return $raw;
        }
        if (is_string($raw) && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            return is_array($decoded) ? $decoded : null;
        }
        return null;
    }

    protected function deleteStoredFile(TarifaImagen $record): void
    {
        $disk = $record->disk ?? 'public';
        $path = $record->path;
        if ($path && Storage::disk($disk)->exists($path)) {
            Storage::disk($disk)->delete($path);
        }
    }
}

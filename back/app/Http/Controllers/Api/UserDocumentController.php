<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UserDocumentController extends Controller
{
    private const ALLOWED_CATEGORIES = [
        'FICHA_MEDICA',
        'CONTRATO',
        'DNI',
        'CV',
        'RECIBO_SUELDO',
        'APTO_MEDICO',
        'OTRO',
    ];

    public function index(Request $request, User $usuario): JsonResponse
    {
        if (! $this->canAccessRrhh($request->user())) {
            return response()->json(['message' => 'No tenés permisos para ver RRHH.'], 403);
        }

        $documents = UserDocument::query()
            ->where('user_id', $usuario->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (UserDocument $documento) => $this->serializeDocument($usuario, $documento))
            ->values();

        return response()->json([
            'data' => $documents,
        ]);
    }

    public function store(Request $request, User $usuario): JsonResponse
    {
        if (! $this->canAccessRrhh($request->user())) {
            return response()->json(['message' => 'No tenés permisos para cargar documentos de RRHH.'], 403);
        }

        $validated = $request->validate([
            'category' => ['nullable', 'string', 'in:' . implode(',', self::ALLOWED_CATEGORIES)],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'fechaVencimiento' => ['nullable', 'date'],
            'archivo' => ['required', 'file', 'max:51200'],
        ], [
            'archivo.max' => 'El archivo supera el límite de 50MB.',
        ]);

        $file = $validated['archivo'];
        $disk = 'public';
        $directory = sprintf('rrhh/%d/%s', $usuario->id, now()->format('Y/m'));
        $extension = strtolower((string) ($file->getClientOriginalExtension() ?: $file->extension() ?: 'bin'));
        $filename = Str::random(20) . '.' . $extension;
        $path = $file->storeAs($directory, $filename, $disk);

        $documento = UserDocument::query()->create([
            'user_id' => $usuario->id,
            'uploaded_by' => $request->user()?->id,
            'category' => $validated['category'] ?? 'OTRO',
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'fecha_vencimiento' => $validated['fechaVencimiento'] ?? null,
            'disk' => $disk,
            'path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime' => $file->getMimeType(),
            'size' => $file->getSize(),
        ]);

        return response()->json([
            'message' => 'Documento de RRHH cargado correctamente.',
            'data' => $this->serializeDocument($usuario, $documento),
        ], 201);
    }

    public function update(Request $request, User $usuario, UserDocument $documento): JsonResponse
    {
        if (! $this->canAccessRrhh($request->user())) {
            return response()->json(['message' => 'No tenés permisos para editar documentos de RRHH.'], 403);
        }

        if ((int) $documento->user_id !== (int) $usuario->id) {
            return response()->json(['message' => 'Documento no encontrado para este usuario.'], 404);
        }

        $validated = $request->validate([
            'category' => ['nullable', 'string', 'in:' . implode(',', self::ALLOWED_CATEGORIES)],
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'fechaVencimiento' => ['nullable', 'date'],
            'archivo' => ['nullable', 'file', 'max:51200'],
        ], [
            'archivo.max' => 'El archivo supera el límite de 50MB.',
        ]);

        if (isset($validated['title'])) {
            $documento->title = $validated['title'];
        }
        if (array_key_exists('description', $validated)) {
            $documento->description = $validated['description'] ?? null;
        }
        if (array_key_exists('fechaVencimiento', $validated)) {
            $documento->fecha_vencimiento = $validated['fechaVencimiento'] ?? null;
        }
        if (isset($validated['category'])) {
            $documento->category = $validated['category'];
        }

        $newFile = $request->file('archivo');
        if ($newFile) {
            $oldDisk = $documento->disk ?: 'public';
            $oldPath = $documento->path;

            $disk = 'public';
            $directory = sprintf('rrhh/%d/%s', $usuario->id, now()->format('Y/m'));
            $extension = strtolower((string) ($newFile->getClientOriginalExtension() ?: $newFile->extension() ?: 'bin'));
            $filename = Str::random(20) . '.' . $extension;
            $path = $newFile->storeAs($directory, $filename, $disk);

            $documento->disk = $disk;
            $documento->path = $path;
            $documento->original_name = $newFile->getClientOriginalName();
            $documento->mime = $newFile->getMimeType();
            $documento->size = $newFile->getSize();

            if ($oldPath && Storage::disk($oldDisk)->exists($oldPath)) {
                Storage::disk($oldDisk)->delete($oldPath);
            }
        }

        $documento->save();

        return response()->json([
            'message' => 'Documento de RRHH actualizado.',
            'data' => $this->serializeDocument($usuario, $documento),
        ]);
    }

    public function destroy(Request $request, User $usuario, UserDocument $documento): JsonResponse
    {
        if (! $this->canAccessRrhh($request->user())) {
            return response()->json(['message' => 'No tenés permisos para eliminar documentos de RRHH.'], 403);
        }

        if ((int) $documento->user_id !== (int) $usuario->id) {
            return response()->json(['message' => 'Documento no encontrado para este usuario.'], 404);
        }

        $disk = $documento->disk ?: 'public';
        $path = $documento->path;
        if ($path && Storage::disk($disk)->exists($path)) {
            Storage::disk($disk)->delete($path);
        }

        $documento->delete();

        return response()->json([
            'message' => 'Documento eliminado correctamente.',
        ]);
    }

    public function download(Request $request, User $usuario, UserDocument $documento)
    {
        if (! $this->canAccessRrhh($request->user())) {
            abort(403, 'No tenés permisos para descargar documentos de RRHH.');
        }

        if ((int) $documento->user_id !== (int) $usuario->id) {
            abort(404, 'Documento no encontrado para este usuario.');
        }

        $disk = $documento->disk ?: 'public';
        if (!$documento->path || !Storage::disk($disk)->exists($documento->path)) {
            abort(404, 'El archivo solicitado no está disponible.');
        }

        return Storage::disk($disk)->download($documento->path, $documento->original_name ?: basename($documento->path));
    }

    private function canAccessRrhh($user): bool
    {
        if (!$user) {
            return false;
        }

        $role = strtolower(trim((string) ($user->role ?? '')));
        if ($role !== '' && (str_contains($role, 'admin') || $role === 'encargado')) {
            return true;
        }

        $permissions = $user->permissions ?? null;
        if (!is_array($permissions)) {
            return false;
        }

        return in_array('rrhh', $permissions, true) || in_array('usuarios', $permissions, true);
    }

    private function serializeDocument(User $usuario, UserDocument $documento): array
    {
        return [
            'id' => $documento->id,
            'userId' => $documento->user_id,
            'category' => $documento->category,
            'title' => $documento->title,
            'description' => $documento->description,
            'fechaVencimiento' => optional($documento->fecha_vencimiento)?->format('Y-m-d'),
            'mime' => $documento->mime,
            'size' => $documento->size,
            'originalName' => $documento->original_name,
            'uploadedBy' => $documento->uploaded_by,
            'createdAt' => optional($documento->created_at)?->toIso8601String(),
            'downloadUrl' => route('usuarios.documentos.descargar', [
                'usuario' => $usuario->id,
                'documento' => $documento->id,
            ], false),
        ];
    }
}

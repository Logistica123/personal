<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\TicketRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class TicketRequestController extends Controller
{
    protected function notify(int $userId = null, ?string $message = null, array $metadata = []): void
    {
        if (! $userId || ! $message) {
            return;
        }

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
            $payload['type'] = 'ticketera';
        }

        if ($hasEntityTypeColumn) {
            $payload['entity_type'] = 'ticket_request';
        }

        if ($hasMetadataColumn) {
            $payload['metadata'] = $metadata;
        }

        if ($hasEntityIdColumn && isset($metadata['ticket_id'])) {
            $payload['entity_id'] = $metadata['ticket_id'];
        }

        Notification::create($payload);
    }

    public function index(Request $request): JsonResponse
    {
        $userId = $request->input('userId');

        $query = TicketRequest::query()->orderByDesc('id');

        if ($userId) {
            $query->where(function ($inner) use ($userId) {
                $inner
                    ->where('responsable_id', $userId)
                    ->orWhere('solicitante_id', $userId)
                    ->orWhere('destinatario_id', $userId);
            });
        }

        $tickets = $query->get();

        return response()->json(['data' => $tickets]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'titulo' => ['required', 'string', 'max:255'],
            'categoria' => ['nullable', 'string', 'max:255'],
            'insumos' => ['nullable', 'string'],
            'cantidad' => ['nullable', 'string', 'max:50'],
            'notas' => ['nullable', 'string'],
            'monto' => ['nullable', 'numeric'],
            'facturaMonto' => ['nullable', 'numeric'],
            'responsableId' => ['nullable', 'integer', 'exists:users,id'],
            'destinatarioId' => ['nullable', 'integer', 'exists:users,id'],
            'solicitanteId' => ['nullable', 'integer', 'exists:users,id'],
            'facturaArchivos' => ['nullable', 'array'],
            'facturaArchivos.*.name' => ['required_with:facturaArchivos', 'string', 'max:255'],
            'facturaArchivos.*.dataUrl' => ['required_with:facturaArchivos', 'string'],
        ]);

        $facturas = [];
        if (! empty($validated['facturaArchivos'])) {
            foreach ($validated['facturaArchivos'] as $archivo) {
                $dataUrl = $archivo['dataUrl'];
                if (! str_contains($dataUrl, 'base64,')) {
                    continue;
                }
                [$meta, $encoded] = explode('base64,', $dataUrl, 2);
                $extension = 'png';
                if (str_contains($meta, 'image/jpeg')) {
                    $extension = 'jpg';
                } elseif (str_contains($meta, 'image/webp')) {
                    $extension = 'webp';
                }
                $binary = base64_decode($encoded);
                if ($binary === false) {
                    continue;
                }
                $filename = 'ticketera/'.Str::uuid().'.'.$extension;
                Storage::disk('public')->put($filename, $binary);
                $facturas[] = [
                    'name' => $archivo['name'],
                    'path' => $filename,
                    'size' => strlen($binary),
                    'type' => $extension,
                ];
            }
        }

        $ticket = TicketRequest::create([
            'titulo' => $validated['titulo'],
            'categoria' => $validated['categoria'] ?? null,
            'insumos' => $validated['insumos'] ?? null,
            'cantidad' => $validated['cantidad'] ?? null,
            'notas' => $validated['notas'] ?? null,
            'monto' => $validated['monto'] ?? null,
            'factura_monto' => $validated['facturaMonto'] ?? null,
            'factura_archivos' => $facturas,
            'destinatario_id' => $validated['destinatarioId'] ?? null,
            'responsable_id' => $validated['responsableId'] ?? null,
            'solicitante_id' => $validated['solicitanteId'] ?? $request->user()?->id,
            'hr_id' => env('HR_USER_ID', null),
            'estado' => 'pendiente_responsable',
        ]);

        if ($ticket->responsable_id) {
            $this->notify((int) $ticket->responsable_id, 'Nuevo ticket asignado', [
                'ticket_id' => $ticket->id,
                'titulo' => $ticket->titulo,
            ]);
        }

        return response()->json(['data' => $ticket], 201);
    }

    public function show(TicketRequest $ticketRequest): JsonResponse
    {
        return response()->json(['data' => $ticketRequest]);
    }

    public function update(Request $request, TicketRequest $ticketRequest): JsonResponse
    {
        $validated = $request->validate([
            'estado' => ['nullable', 'string', 'in:pendiente_responsable,pendiente_rrhh,pendiente_compra,aprobado,rechazado'],
            'responsableId' => ['nullable', 'integer', 'exists:users,id'],
            'facturaArchivos' => ['nullable', 'array'],
            'facturaArchivos.*.name' => ['required_with:facturaArchivos', 'string', 'max:255'],
            'facturaArchivos.*.dataUrl' => ['required_with:facturaArchivos', 'string'],
        ]);

        if (array_key_exists('estado', $validated)) {
            $ticketRequest->estado = $validated['estado'];
        }

        if (array_key_exists('responsableId', $validated)) {
            $ticketRequest->responsable_id = $validated['responsableId'];
        }

        if (! empty($validated['facturaArchivos'])) {
            $facturas = is_array($ticketRequest->factura_archivos) ? $ticketRequest->factura_archivos : [];
            foreach ($validated['facturaArchivos'] as $archivo) {
                $dataUrl = $archivo['dataUrl'];
                if (! str_contains($dataUrl, 'base64,')) {
                    continue;
                }
                [$meta, $encoded] = explode('base64,', $dataUrl, 2);
                $extension = 'png';
                if (str_contains($meta, 'image/jpeg')) {
                    $extension = 'jpg';
                } elseif (str_contains($meta, 'image/webp')) {
                    $extension = 'webp';
                }
                $binary = base64_decode($encoded);
                if ($binary === false) {
                    continue;
                }
                $filename = 'ticketera/'.Str::uuid().'.'.$extension;
                Storage::disk('public')->put($filename, $binary);
                $facturas[] = [
                    'name' => $archivo['name'],
                    'path' => $filename,
                    'size' => strlen($binary),
                    'type' => $extension,
                ];
            }
            $ticketRequest->factura_archivos = $facturas;
        }

        $ticketRequest->save();

        if ($ticketRequest->responsable_id) {
            $responsable = User::find($ticketRequest->responsable_id);
            $this->notify((int) $ticketRequest->responsable_id, 'Ticket actualizado', [
                'ticket_id' => $ticketRequest->id,
                'titulo' => $ticketRequest->titulo,
                'estado' => $ticketRequest->estado,
                'responsable' => $responsable?->name,
            ]);
        }

        return response()->json(['data' => $ticketRequest]);
    }
}

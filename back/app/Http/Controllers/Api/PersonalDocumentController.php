<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Archivo;
use App\Models\Factura;
use App\Models\FacturaOcr;
use App\Models\FacturaValidacion;
use App\Models\FileType;
use App\Models\Persona;
use App\Models\PersonalNotification;
use App\Services\FacturaAi\FacturaValidationService;
use App\Services\FacturaAi\OpenAiFacturaParser;
use App\Services\FacturaAi\PdfTextExtractor;
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
    public function index(Request $request, Persona $persona): JsonResponse
    {
        $includePending = $request->boolean('includePending');
        $documentos = $persona->documentos()
            ->with(['tipo:id,nombre,vence'])
            ->when(! $includePending, function ($query) {
                $query->where('es_pendiente', false);
            })
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
                    'fechaVencimiento' => $this->formatFechaVencimiento($documento->fecha_vencimiento),
                    'tipoId' => $documento->tipo_archivo_id,
                    'tipoNombre' => $documento->tipo?->nombre,
                    'requiereVencimiento' => (bool) $documento->tipo?->vence,
                    'importeFacturar' => $documento->importe_facturar,
                    'pendiente' => (bool) $documento->es_pendiente,
                    'liquidacionId' => $documento->liquidacion_id,
                    'enviada' => (bool) $documento->enviada,
                    'recibido' => (bool) $documento->recibido,
                    'pagado' => (bool) $documento->pagado,
                    'destinatarioTipo' => $documento->liquidacion_destinatario_tipo,
                    'destinatarioEmails' => $this->extractLiquidacionRecipientEmails($documento),
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

    public function liquidaciones(Request $request, Persona $persona): JsonResponse
    {
        $actorEmail = strtolower(trim((string) $request->input('email', '')));
        if ($actorEmail !== '') {
            $persona->loadMissing('dueno:id,persona_id,email');
            $allowedEmails = array_filter([
                $persona->email,
                $persona->cobrador_email,
                $persona->dueno?->email,
            ]);
            $allowedEmails = array_map(
                fn ($email) => strtolower(trim((string) $email)),
                $allowedEmails
            );
            if (! in_array($actorEmail, $allowedEmails, true)) {
                return response()->json([
                    'message' => 'No tenés permisos para ver estas liquidaciones.',
                ], 403);
            }
        }

        $includePending = $request->boolean('includePending');
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
            ->when(! $includePending, function ($query) {
                $query->where('es_pendiente', false);
            })
            ->orderByDesc('created_at')
            ->get()
            ->filter(function (Archivo $documento) use ($actorEmail) {
                if ($actorEmail === '') {
                    return true;
                }

                $recipientEmails = $this->extractLiquidacionRecipientEmails($documento);
                if (empty($recipientEmails)) {
                    return true;
                }

                return in_array($actorEmail, $recipientEmails, true);
            })
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
                $hasAttachments = $documento->parent_document_id === null
                    && ($documento->children?->isNotEmpty() ?? false);
                $importeFacturarBase = $documento->importe_facturar;
                $fuelDiscountTotal = 0.0;
                if ($documento->parent_document_id === null && $documento->children) {
                    $fuelDiscountTotal = $documento->children
                        ->filter(function (Archivo $child) {
                            $typeName = Str::lower($child->tipo?->nombre ?? '');
                            $name = Str::lower($child->nombre_original ?? '');
                            return Str::contains($typeName, 'combust')
                                || Str::contains($name, 'combust');
                        })
                        ->map(function (Archivo $child) {
                            return $child->importe_facturar ?? 0;
                        })
                        ->sum();
                }
                $importeFacturarConDescuento = $importeFacturarBase !== null
                    ? $importeFacturarBase + $fuelDiscountTotal
                    : null;

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
                    'fechaVencimiento' => $this->formatFechaVencimiento($documento->fecha_vencimiento),
                    'tipoId' => $documento->tipo_archivo_id,
                    'tipoNombre' => $documento->tipo?->nombre,
                    'requiereVencimiento' => (bool) $documento->tipo?->vence,
                    'importeCombustible' => $importeCombustible,
                    'importeFacturar' => $importeFacturarConDescuento ?? $importeFacturarBase,
                    'importeFacturarBase' => $importeFacturarBase,
                    'importeFacturarConDescuento' => $importeFacturarConDescuento,
                    'pendiente' => (bool) $documento->es_pendiente,
                    'liquidacionId' => $documento->liquidacion_id,
                    'enviada' => (bool) $documento->enviada,
                    'recibido' => (bool) $documento->recibido || $hasAttachments,
                    'pagado' => (bool) $documento->pagado,
                    'destinatarioTipo' => $documento->liquidacion_destinatario_tipo,
                    'destinatarioEmails' => $this->extractLiquidacionRecipientEmails($documento),
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
        if ($request->boolean('esLiquidacion') && ! $request->filled('tipoArchivoId')) {
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
            'fortnightKey' => ['nullable', 'in:Q1,Q2,MONTHLY'],
            'monthKey' => ['nullable', 'date_format:Y-m'],
            'importeCombustible' => ['nullable', 'numeric', 'min:0'],
            'importeFacturar' => ['nullable', 'numeric', 'min:0'],
            'attachFuelInvoices' => ['nullable', 'boolean'],
            'pendiente' => ['nullable', 'boolean'],
            'liquidacionId' => ['nullable', 'integer', 'min:1'],
            'destinatarioTipo' => ['nullable', 'in:proveedor,cobrador,ambos'],
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
        $monthKey = $validated['monthKey'] ?? null;
        if (! $parsedFecha && $monthKey) {
            try {
                $parsedFecha = Carbon::createFromFormat('Y-m', $monthKey)->startOfMonth();
            } catch (\Throwable $exception) {
                // ignore invalid monthKey
            }
        }

        $nombreOriginal = $validated['nombre'] ?? $file->getClientOriginalName();

        if ($request->boolean('esFacturaCombustible') && $request->filled('importeCombustible')) {
            $nombreOriginal = sprintf(
                'Factura combustible - $%s - %s',
                $request->input('importeCombustible'),
                $nombreOriginal
            );
        }

        $isLiquidacion = $request->boolean('esLiquidacion');
        $isPending = $request->boolean('pendiente');
        $recipientPayload = null;

        if ($isLiquidacion) {
            $requestedRecipientType = is_string($request->input('destinatarioTipo'))
                ? $request->input('destinatarioTipo')
                : null;
            $recipientPayload = $this->resolveLiquidacionRecipients($persona, $requestedRecipientType, true);
        }

        $documento = $persona->documentos()->create([
            'carpeta' => $directory,
            'ruta' => $storedPath,
            'parent_document_id' => $parentDocumentId,
            'liquidacion_id' => $validated['liquidacionId'] ?? null,
            'es_pendiente' => $isPending,
            'download_url' => null,
            'disk' => $disk,
            'nombre_original' => $nombreOriginal,
            'mime' => $file->getClientMimeType(),
            'size' => $file->getSize(),
            'tipo_archivo_id' => $validated['tipoArchivoId'],
            'fecha_vencimiento' => $parsedFecha,
            'fortnight_key' => $validated['fortnightKey'] ?? null,
            'importe_facturar' => $validated['importeFacturar'] ?? null,
            'enviada' => $isLiquidacion && ! $isPending,
            'recibido' => false,
            'pagado' => false,
            'liquidacion_destinatario_tipo' => $recipientPayload['type'] ?? null,
            'liquidacion_destinatario_emails' => $recipientPayload['emails'] ?? null,
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

        if ($isLiquidacion && ! $isPending) {
            $this->createLiquidacionNotification(
                $persona,
                $documento->id,
                $documento->nombre_original,
                $recipientPayload['type'] ?? null,
                $recipientPayload['emails'] ?? []
            );
        }

        $isLiquidacionDoc = $request->boolean('esLiquidacion')
            || Str::contains(Str::lower($documento->tipo?->nombre ?? ''), 'liquid');

        Log::info('Chequeo auto validacion IA', [
            'documento_id' => $documento->id,
            'parent_document_id' => $documento->parent_document_id,
            'skip_auto_validacion' => $request->boolean('skipAutoValidacion'),
            'is_liquidacion_doc' => $isLiquidacionDoc,
            'mime' => $documento->mime,
        ]);

        if ($isLiquidacionDoc && $request->boolean('attachFuelInvoices')) {
            $this->attachPendingFuelInvoices($persona, $documento, $request->boolean('marcarRecibido'));
        }

        if ($parentDocumentId && ! $isLiquidacionDoc) {
            $shouldMarkReceived = $request->boolean('marcarRecibido') || $request->boolean('esFacturaCombustible');
            if ($shouldMarkReceived) {
                $persona->documentos()
                    ->where('id', $parentDocumentId)
                    ->update(['recibido' => true]);
            }
        }

        if (! $request->boolean('skipAutoValidacion')) {
            if ($documento->parent_document_id !== null) {
                $this->runFacturaAiValidation($documento);
            }
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
                'fechaVencimiento' => $this->formatFechaVencimiento($documento->fecha_vencimiento),
                'tipoId' => $documento->tipo_archivo_id,
            'tipoNombre' => $documento->tipo?->nombre,
            'requiereVencimiento' => (bool) $documento->tipo?->vence,
            'importeCombustible' => $request->input('importeCombustible'),
            'importeFacturar' => $documento->importe_facturar,
            'pendiente' => (bool) $documento->es_pendiente,
            'liquidacionId' => $documento->liquidacion_id,
            'enviada' => (bool) $documento->enviada,
            'recibido' => (bool) $documento->recibido,
            'pagado' => (bool) $documento->pagado,
            'destinatarioTipo' => $documento->liquidacion_destinatario_tipo,
            'destinatarioEmails' => $this->extractLiquidacionRecipientEmails($documento),
        ],
    ], 201);
    }

    public function publishPending(Request $request, Persona $persona): JsonResponse
    {
        $validated = $request->validate([
            'documentIds' => ['nullable', 'array'],
            'documentIds.*' => ['integer'],
            'importeFacturar' => ['nullable', 'numeric', 'min:0'],
            'destinatarioTipo' => ['nullable', 'in:proveedor,cobrador,ambos'],
        ]);

        $recipientPayload = $this->resolveLiquidacionRecipients($persona, $validated['destinatarioTipo'] ?? null, true);

        $query = $persona->documentos()->where('es_pendiente', true);

        if (! empty($validated['documentIds'])) {
            $query->whereIn('id', $validated['documentIds']);
        }

        $updated = $query->update(['es_pendiente' => false]);

        $liquidacionTypeIds = $this->resolveLiquidacionTypeIds();
        $enviadaQuery = $persona->documentos()
            ->where('es_pendiente', false)
            ->whereNull('parent_document_id');

        if ($liquidacionTypeIds->isNotEmpty()) {
            $enviadaQuery->whereIn('tipo_archivo_id', $liquidacionTypeIds);
        } else {
            $enviadaQuery->where(function ($inner) {
                $inner
                    ->whereRaw('LOWER(nombre_original) LIKE ?', ['%liquid%'])
                    ->orWhereRaw('LOWER(ruta) LIKE ?', ['%liquid%']);
            });
        }

        if (! empty($validated['documentIds'])) {
            $enviadaQuery->whereIn('id', $validated['documentIds']);
        }

        $publishedLiquidaciones = (clone $enviadaQuery)
            ->get(['id', 'nombre_original']);

        $enviadaQuery->update([
            'enviada' => true,
            'liquidacion_destinatario_tipo' => $recipientPayload['type'],
            'liquidacion_destinatario_emails' => json_encode($recipientPayload['emails'], JSON_UNESCAPED_UNICODE),
        ]);

        foreach ($publishedLiquidaciones as $publishedLiquidacion) {
            $this->createLiquidacionNotification(
                $persona,
                (int) $publishedLiquidacion->id,
                $publishedLiquidacion->nombre_original,
                $recipientPayload['type'] ?? null,
                $recipientPayload['emails'] ?? []
            );
        }

        if ($request->boolean('marcarRecibido')) {
            $liquidacionIds = $enviadaQuery->pluck('id');
            if ($liquidacionIds->isNotEmpty()) {
                $fuelTypeIds = $this->resolveFuelTypeIds();
                $attachmentsQuery = $persona->documentos()
                    ->whereIn('parent_document_id', $liquidacionIds);

                if ($fuelTypeIds->isNotEmpty()) {
                    $attachmentsQuery->whereIn('tipo_archivo_id', $fuelTypeIds);
                } else {
                    $attachmentsQuery->where(function ($inner) {
                        $inner
                            ->whereRaw('LOWER(nombre_original) LIKE ?', ['%combust%'])
                            ->orWhereRaw('LOWER(ruta) LIKE ?', ['%combust%']);
                    });
                }

                $parentIds = $attachmentsQuery
                    ->pluck('parent_document_id')
                    ->filter()
                    ->unique()
                    ->values();

                if ($parentIds->isNotEmpty()) {
                    $persona->documentos()
                        ->whereIn('id', $parentIds)
                        ->update(['recibido' => true]);
                }
            }
        }

        if (array_key_exists('importeFacturar', $validated)) {
            $liquidacionTypeIds = $this->resolveLiquidacionTypeIds();

            $importeQuery = $persona->documentos()
                ->where('es_pendiente', false)
                ->whereNull('parent_document_id')
                ;

            if ($liquidacionTypeIds->isNotEmpty()) {
                $importeQuery->whereIn('tipo_archivo_id', $liquidacionTypeIds);
            } else {
                $importeQuery->where(function ($inner) {
                    $inner
                        ->whereRaw('LOWER(nombre_original) LIKE ?', ['%liquid%'])
                        ->orWhereRaw('LOWER(ruta) LIKE ?', ['%liquid%']);
                });
            }

            if (! empty($validated['documentIds'])) {
                $importeQuery->whereIn('id', $validated['documentIds']);
            }

            $importeQuery->update([
                'importe_facturar' => $validated['importeFacturar'],
            ]);
        }

        return response()->json([
            'message' => 'Documentos publicados correctamente.',
            'data' => [
                'updated' => $updated,
            ],
        ]);
    }

    public function updatePagado(Request $request, Persona $persona): JsonResponse
    {
        $validated = $request->validate([
            'documentIds' => ['required', 'array', 'min:1'],
            'documentIds.*' => ['integer'],
            'pagado' => ['required', 'boolean'],
        ]);

        $updated = $persona->documentos()
            ->whereIn('id', $validated['documentIds'])
            ->whereNull('parent_document_id')
            ->update(['pagado' => $validated['pagado']]);

        return response()->json([
            'message' => 'Estado de pago actualizado correctamente.',
            'data' => [
                'updated' => $updated,
            ],
        ]);
    }

    public function updatePagadoBulk(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'documentIds' => ['required', 'array', 'min:1'],
            'documentIds.*' => ['integer'],
            'pagado' => ['required', 'boolean'],
        ]);

        $updated = Archivo::query()
            ->whereIn('id', $validated['documentIds'])
            ->whereNull('parent_document_id')
            ->update(['pagado' => $validated['pagado']]);

        return response()->json([
            'message' => 'Estado de pago actualizado correctamente.',
            'data' => [
                'updated' => $updated,
            ],
        ]);
    }

    public function updateDocument(Request $request, Persona $persona, Archivo $documento): JsonResponse
    {
        if ($documento->persona_id !== $persona->id) {
            abort(404);
        }

        if ($request->boolean('esLiquidacion') && ! $request->filled('tipoArchivoId')) {
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
            'liquidacionId' => ['nullable', 'integer', 'min:1'],
            'destinatarioTipo' => ['nullable', 'in:proveedor,cobrador,ambos'],
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

        if (array_key_exists('liquidacionId', $validated)) {
            $documento->liquidacion_id = $validated['liquidacionId'] ?? null;
        }

        $documento->save();
        $documento->loadMissing('tipo:id,nombre,vence');

        if ($hasParentAssignment && $parentDocumentId && $request->boolean('marcarRecibido')) {
            $persona->documentos()
                ->where('id', $parentDocumentId)
                ->update(['recibido' => true]);
        }

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
                'fechaVencimiento' => $this->formatFechaVencimiento($documento->fecha_vencimiento),
                'tipoId' => $documento->tipo_archivo_id,
                'tipoNombre' => $documento->tipo?->nombre,
                'requiereVencimiento' => (bool) $documento->tipo?->vence,
                'importeFacturar' => $documento->importe_facturar,
                'pendiente' => (bool) $documento->es_pendiente,
                'liquidacionId' => $documento->liquidacion_id,
                'enviada' => (bool) $documento->enviada,
                'recibido' => (bool) $documento->recibido,
                'pagado' => (bool) $documento->pagado,
                'destinatarioTipo' => $documento->liquidacion_destinatario_tipo,
                'destinatarioEmails' => $this->extractLiquidacionRecipientEmails($documento),
            ],
        ]);
    }

    public function preview($personaId, Archivo $documento)
    {
        $persona = Persona::withTrashed()->find($personaId);
        if (! $persona) {
            abort(404);
        }

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
            return $this->streamExternalFile($downloadUrl, $fileName, $documento->mime, true);
        }

        $path = $this->normalizeStoragePath($documento->ruta);

        if (! $path || ! Storage::disk($disk)->exists($path)) {
            return $this->streamExternalFile($downloadUrl, $fileName, $documento->mime, true);
        }

        $contentType = $documento->mime ?: Storage::disk($disk)->mimeType($path) ?: 'application/octet-stream';
        $headers = [
            'Content-Type' => $contentType,
            'Content-Disposition' => 'inline; filename="'.$fileName.'"',
        ];

        return Storage::disk($disk)->response($path, $fileName, $headers);
    }

    public function download($personaId, Archivo $documento)
    {
        $persona = Persona::withTrashed()->find($personaId);
        if (! $persona) {
            abort(404);
        }

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
            return $this->streamExternalFile($downloadUrl, $fileName, $documento->mime, false);
        }

        $path = $this->normalizeStoragePath($documento->ruta);

        if (! $path || ! Storage::disk($disk)->exists($path)) {
            return $this->streamExternalFile($downloadUrl, $fileName, $documento->mime, false);
        }

        return Storage::disk($disk)->download($path, $fileName);
    }

    public function downloadAll($personaId)
    {
        $persona = Persona::withTrashed()->find($personaId);
        if (! $persona) {
            abort(404, 'No hay documentos disponibles para descargar.');
        }

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

    protected function attachPendingFuelInvoices(Persona $persona, Archivo $liquidacion, bool $markReceived = false): void
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

        if ($markReceived && $pendingInvoices->isNotEmpty()) {
            $liquidacion->recibido = true;
            $liquidacion->save();
        }
    }

    protected function createLiquidacionNotification(
        Persona $persona,
        int $documentId,
        ?string $documentName = null,
        ?string $recipientType = null,
        array $recipientEmails = []
    ): void {
        $nombre = trim((string) ($documentName ?: 'Liquidación'));

        PersonalNotification::query()->create([
            'persona_id' => $persona->id,
            'type' => 'liquidacion',
            'title' => 'Nueva liquidación disponible',
            'message' => 'Se cargó una nueva liquidación: '.$nombre,
            'metadata' => [
                'documentId' => $documentId,
                'recipientType' => $recipientType,
                'recipientEmails' => array_values($recipientEmails),
            ],
        ]);
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

    protected function resolveLiquidacionTypeIds()
    {
        return FileType::query()
            ->select('id', 'nombre')
            ->get()
            ->filter(function (FileType $tipo) {
                $nombre = Str::lower($tipo->nombre ?? '');
                return $nombre !== '' && Str::contains($nombre, 'liquid');
            })
            ->pluck('id');
    }

    protected function runFacturaAiValidation(Archivo $documento): void
    {
        try {
            $documento->loadMissing('persona');
            $disk = $documento->disk ?: 'public';
            $absolutePath = Storage::disk($disk)->path($documento->ruta);
            $mime = $documento->mime ?? '';
            $isPdf = $mime !== '' && str_contains($mime, 'pdf');
            $isImage = $mime !== '' && str_starts_with($mime, 'image/');
            if (! $isPdf && ! $isImage) {
                return;
            }
            $skipCuil = ! $isPdf;

            /** @var PdfTextExtractor $extractor */
            $extractor = app(PdfTextExtractor::class);
            /** @var OpenAiFacturaParser $parser */
            $parser = app(OpenAiFacturaParser::class);
            /** @var FacturaValidationService $validator */
            $validator = app(FacturaValidationService::class);

            Log::info('Validacion IA iniciada', [
                'documento_id' => $documento->id,
                'parent_document_id' => $documento->parent_document_id,
                'mime' => $mime,
                'skip_cuil' => $skipCuil,
            ]);

            $rawText = $extractor->extract($absolutePath);
            $parsed = $parser->parse($rawText);
            $liquidacion = $documento;
            if ($documento->parent_document_id) {
                $liquidacion = Archivo::query()->find($documento->parent_document_id);
            }

            $factura = Factura::create([
                'archivo_path' => $documento->ruta,
                'archivo_disk' => $disk,
                'estado' => 'pendiente',
                'liquidacion_id' => $documento->id,
                'persona_id' => $documento->persona_id,
                'razon_social' => $this->stringOrNull($parsed['razon_social'] ?? null),
                'cuit_emisor' => $this->normalizeTaxId($parsed['cuit'] ?? null),
                'numero_factura' => $this->stringOrNull($parsed['numero_factura'] ?? null),
                'fecha_emision' => $this->parseDate($parsed['fecha_emision'] ?? null),
                'tipo_factura' => $this->normalizeFacturaType($parsed['tipo_factura'] ?? null),
                'importe_total' => $this->parseAmount($parsed['importe_total'] ?? null),
                'iva' => $this->parseAmount($parsed['iva'] ?? null),
                'concepto' => $this->stringOrNull($parsed['concepto'] ?? null),
                'cbu' => $this->stringOrNull($parsed['cbu'] ?? null),
            ]);

            FacturaOcr::create([
                'factura_id' => $factura->id,
                'raw_text' => $rawText,
                'extracted_json' => $parsed,
                'model' => config('services.openai.model', 'gpt-4o-mini'),
            ]);

            $result = $validator->validate($factura, $liquidacion, $documento->persona, $skipCuil, false);
            $factura->estado = $result['decision']['estado'];
            $factura->decision_motivo = $result['decision']['motivo'];
            $factura->decision_mensaje = $result['decision']['mensaje'];
            $factura->save();

            foreach ($result['validations'] as $validation) {
                FacturaValidacion::create([
                    'factura_id' => $factura->id,
                    'regla' => $validation['regla'],
                    'resultado' => $validation['resultado'],
                    'mensaje' => $validation['mensaje'],
                ]);
            }

            if ($result['decision']['estado'] === 'aprobada') {
                if ($liquidacion && $liquidacion->recibido !== true) {
                    $liquidacion->recibido = true;
                    $liquidacion->save();
                }
            }

            Log::info('Validacion IA completada', [
                'documento_id' => $documento->id,
                'factura_id' => $factura->id,
                'estado' => $factura->estado,
                'motivo' => $factura->decision_motivo,
            ]);
        } catch (\Throwable $exception) {
            Log::warning('Validación IA fallida al subir liquidación', [
                'documento_id' => $documento->id,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    protected function parseDate($value): ?string
    {
        if (! $value) {
            return null;
        }

        try {
            return Carbon::parse($value)->format('Y-m-d');
        } catch (\Throwable $exception) {
            return null;
        }
    }

    protected function parseAmount($value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        $raw = is_numeric($value) ? (string) $value : (string) $value;
        $normalized = str_replace(['$', ' '], '', $raw);
        if (str_contains($normalized, ',') && str_contains($normalized, '.')) {
            $normalized = str_replace('.', '', $normalized);
            $normalized = str_replace(',', '.', $normalized);
        } elseif (str_contains($normalized, ',')) {
            $normalized = str_replace(',', '.', $normalized);
        }

        return is_numeric($normalized) ? (float) $normalized : null;
    }

    protected function normalizeTaxId($value): ?string
    {
        if (! $value) {
            return null;
        }
        $normalized = preg_replace('/\\D+/', '', (string) $value) ?? '';
        return $normalized !== '' ? $normalized : null;
    }

    protected function normalizeFacturaType($value): ?string
    {
        $trimmed = strtoupper(trim((string) $value));
        if (in_array($trimmed, ['A', 'B', 'C'], true)) {
            return $trimmed;
        }

        return null;
    }

    protected function stringOrNull($value): ?string
    {
        $trimmed = trim((string) $value);
        return $trimmed !== '' ? $trimmed : null;
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

    protected function streamExternalFile(?string $url, string $fileName, ?string $mime = null, bool $inline = false)
    {
        $url = $this->normalizeUrl($url);
        if ($url && $this->isRecursiveApiDocumentUrl($url)) {
            $url = null;
        }

        if (! $url || ! preg_match('/^https?:\/\//i', $url)) {
            abort(404, 'El archivo solicitado no está disponible.');
        }

        $parsedUrl = parse_url($url);
        $appHost = parse_url(request()->getSchemeAndHttpHost(), PHP_URL_HOST);
        if ($appHost && ! empty($parsedUrl['host']) && strcasecmp($parsedUrl['host'], $appHost) === 0) {
            $path = $parsedUrl['path'] ?? '';
            if ($path && str_starts_with($path, '/storage/')) {
                $relativePath = ltrim(substr($path, strlen('/storage/')), '/');
                if (Storage::disk('public')->exists($relativePath)) {
                    $contentType = $mime ?: Storage::disk('public')->mimeType($relativePath) ?: 'application/octet-stream';
                    $headers = [
                        'Content-Type' => $contentType,
                    ];
                    if ($inline) {
                        $headers['Content-Disposition'] = 'inline; filename="'.$fileName.'"';
                        return Storage::disk('public')->response($relativePath, $fileName, $headers);
                    }
                    return Storage::disk('public')->download($relativePath, $fileName, $headers);
                }
            }
        }

        try {
            $response = Http::withOptions(['stream' => true])->timeout(20)->get($url);
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
        $headers = [
            'Content-Type' => $contentType,
        ];

        if ($inline) {
            $headers['Content-Disposition'] = 'inline; filename="'.$fileName.'"';
            return response()->stream(function () use ($stream) {
                while (! $stream->eof()) {
                    echo $stream->read(8192);
                }
                $stream->close();
            }, 200, $headers);
        }

        return response()->streamDownload(function () use ($stream) {
            while (! $stream->eof()) {
                echo $stream->read(8192);
            }
            $stream->close();
        }, $fileName, $headers);
    }

    protected function normalizeStoragePath(?string $path): ?string
    {
        if (! $path) {
            return null;
        }
        $normalized = ltrim($path, '/');
        if (str_starts_with($normalized, 'public/')) {
            $normalized = substr($normalized, strlen('public/'));
        }
        if (str_starts_with($normalized, 'storage/')) {
            $normalized = substr($normalized, strlen('storage/'));
        }
        return $normalized;
    }

    protected function normalizeUrl(?string $url): ?string
    {
        if (! $url) {
            return null;
        }
        if (preg_match('/^https?:\/\//i', $url)) {
            return $url;
        }
        return rtrim(request()->getSchemeAndHttpHost(), '/').'/'.ltrim($url, '/');
    }

    protected function isRecursiveApiDocumentUrl(string $url): bool
    {
        $path = parse_url($url, PHP_URL_PATH) ?? '';
        if ($path === '') {
            return false;
        }
        return str_contains($path, '/api/personal/')
            && str_contains($path, '/documentos/')
            && (str_ends_with($path, '/descargar') || str_ends_with($path, '/preview'));
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

    protected function formatFechaVencimiento($value): ?string
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
            return null;
        }
    }


    protected function normalizeEmailValue(?string $value): ?string
    {
        $normalized = strtolower(trim((string) $value));

        return $normalized !== '' ? $normalized : null;
    }

    protected function extractLiquidacionRecipientEmails(Archivo $documento): array
    {
        $raw = $documento->liquidacion_destinatario_emails;
        if (is_array($raw)) {
            $emails = $raw;
        } elseif (is_string($raw) && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $emails = $decoded;
            } else {
                $emails = [$raw];
            }
        } else {
            $emails = [];
        }

        $normalized = array_map(function ($email) {
            return is_string($email) ? $this->normalizeEmailValue($email) : null;
        }, $emails);

        return array_values(array_unique(array_filter($normalized)));
    }

    protected function resolveLiquidacionRecipients(Persona $persona, ?string $requestedType = null, bool $strict = true): array
    {
        $persona->loadMissing('dueno:id,persona_id,email');

        $providerEmail = $this->normalizeEmailValue($persona->email);
        $collectorEmail = $this->normalizeEmailValue($persona->cobrador_email ?: $persona->dueno?->email);

        $validTypes = ['proveedor', 'cobrador', 'ambos'];
        $type = is_string($requestedType) ? strtolower(trim($requestedType)) : null;
        if (! in_array($type, $validTypes, true)) {
            if ($providerEmail && $collectorEmail && $providerEmail !== $collectorEmail) {
                $type = 'ambos';
            } elseif ($providerEmail) {
                $type = 'proveedor';
            } elseif ($collectorEmail) {
                $type = 'cobrador';
            } else {
                $type = 'proveedor';
            }
        }

        $emails = [];

        if (in_array($type, ['proveedor', 'ambos'], true)) {
            if (! $providerEmail && $strict) {
                throw ValidationException::withMessages([
                    'destinatarioTipo' => ['El proveedor no tiene email configurado para enviar la liquidación.'],
                ]);
            }
            if ($providerEmail) {
                $emails[] = $providerEmail;
            }
        }

        if (in_array($type, ['cobrador', 'ambos'], true)) {
            if (! $collectorEmail && $strict) {
                throw ValidationException::withMessages([
                    'destinatarioTipo' => ['El cobrador no tiene email configurado para enviar la liquidación.'],
                ]);
            }
            if ($collectorEmail) {
                $emails[] = $collectorEmail;
            }
        }

        $emails = array_values(array_unique(array_filter($emails)));

        if (empty($emails) && $strict) {
            throw ValidationException::withMessages([
                'destinatarioTipo' => ['No hay emails disponibles para enviar la liquidación.'],
            ]);
        }

        return [
            'type' => $type,
            'emails' => $emails,
        ];
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

    public function addLiquidacionAdjustment(Request $request, Persona $persona, Archivo $documento): JsonResponse
    {
        if ($documento->persona_id !== $persona->id) {
            return response()->json(['message' => 'No tenés permisos para modificar esta liquidación.'], 403);
        }

        $isLiquidacion = Str::contains(Str::lower($documento->tipo?->nombre ?? ''), 'liquid');
        if (! $isLiquidacion) {
            return response()->json(['message' => 'El documento no es una liquidación válida.'], 422);
        }

        $validated = $request->validate([
            'adjustments' => ['required', 'array', 'min:1'],
            'adjustments.*.type' => ['required', 'in:credito,debito,ajuste_favor,cuota_combustible,pendiente,adelantos_prestamos,poliza'],
            'adjustments.*.amount' => ['required', 'numeric', 'min:0.01'],
            'adjustments.*.note' => ['nullable', 'string', 'max:500'],
        ]);

        $tipo = FileType::query()->firstOrCreate(
            ['nombre' => 'AJUSTE_LIQUIDACION'],
            ['categoria' => 'liquidaciones']
        );

        $created = [];
        $directory = $documento->carpeta ?: ('personal/' . $persona->id);
        $disk = $documento->disk ?: 'public';
        $negativeTypes = ['debito', 'pendiente', 'cuota_combustible', 'adelantos_prestamos', 'poliza'];

        foreach ($validated['adjustments'] as $adjustment) {
            $amount = (float) $adjustment['amount'];
            if ($amount <= 0) {
                continue;
            }
            $type = (string) $adjustment['type'];
            $label = match ($type) {
                'cuota_combustible' => 'Cuota combustible',
                'pendiente' => 'Pendiente',
                'adelantos_prestamos' => 'Adelantos/Préstamos',
                'debito' => 'Débito',
                'poliza' => 'Póliza',
                default => 'Ajuste a favor',
            };
            $note = trim((string) ($adjustment['note'] ?? ''));
            $fileName = sprintf('ajuste-liquidacion-%d-%s.txt', $documento->id, Str::uuid());
            $ruta = rtrim($directory, '/') . '/' . $fileName;
            $signedAmount = in_array($type, $negativeTypes, true) ? ($amount * -1) : $amount;
            $nombre = sprintf('Ajuste liquidación (%s)%s', $label, $note !== '' ? ' - ' . $note : '');

            $createdDoc = Archivo::query()->create([
                'persona_id' => $persona->id,
                'parent_document_id' => $documento->id,
                'liquidacion_id' => $documento->id,
                'tipo_archivo_id' => $tipo->id,
                'carpeta' => $directory,
                'ruta' => $ruta,
                'disk' => $disk,
                'nombre_original' => $nombre,
                'importe_facturar' => $signedAmount,
                'enviada' => false,
                'recibido' => false,
                'pagado' => false,
            ]);

            $created[] = $createdDoc;
        }

        if (empty($created)) {
            return response()->json(['message' => 'No se pudo generar el ajuste.'], 422);
        }

        foreach ($created as $createdDoc) {
            AuditLogger::log($request, 'liquidacion.adjustment.add', 'documento', $createdDoc->id, [
                'liquidacion_id' => $documento->id,
                'importe_facturar' => $createdDoc->importe_facturar,
                'nombre' => $createdDoc->nombre_original,
            ]);
        }

        return response()->json([
            'message' => 'Ajustes aplicados correctamente.',
            'data' => collect($created)->map(function (Archivo $doc) {
                return [
                    'id' => $doc->id,
                    'parentDocumentId' => $doc->parent_document_id,
                    'nombre' => $doc->nombre_original,
                    'importeFacturar' => $doc->importe_facturar,
                ];
            }),
        ]);
    }
}

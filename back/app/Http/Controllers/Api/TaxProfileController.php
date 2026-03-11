<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\ClientTaxDocument;
use App\Models\NosisSnapshot;
use App\Models\Persona;
use App\Models\TaxProfile;
use App\Services\AuditLogger;
use App\Services\NosisClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class TaxProfileController extends Controller
{
    private const CLIENT_DOCUMENT_CATEGORIES = [
        'CONSTANCIA_ARCA',
        'CONSTANCIA_DGR',
        'EXCLUSION',
        'EXENCION',
        'REGIMEN_ESPECIAL',
        'OTRO',
    ];

    public function __construct(private readonly NosisClient $nosisClient)
    {
    }

    public function showCliente(Cliente $cliente): JsonResponse
    {
        return response()->json([
            'data' => $this->buildPayloadForCliente($cliente),
        ]);
    }

    public function updateCliente(Request $request, Cliente $cliente): JsonResponse
    {
        $profile = $this->persistProfile(
            $request,
            'cliente',
            $cliente->id,
            $this->resolveClienteDefaults($cliente)
        );

        AuditLogger::log($request, 'tax_profile.update', 'cliente', $cliente->id, [
            'entity_type' => 'cliente',
            'cuit' => $profile->cuit,
        ]);

        return response()->json([
            'message' => 'Legajo impositivo actualizado.',
            'data' => $this->formatProfile(
                $profile,
                $this->resolveClienteDefaults($cliente),
                $this->recentSnapshots('cliente', $cliente->id),
                $this->clientDocuments($cliente)
            ),
        ]);
    }

    public function refreshClienteNosis(Request $request, Cliente $cliente): JsonResponse
    {
        $result = $this->refreshNosis(
            $request,
            'cliente',
            $cliente->id,
            $this->resolveClienteDefaults($cliente)
        );

        return response()->json([
            'message' => 'Snapshot de Nosis actualizado.',
            'data' => $result,
        ]);
    }

    public function storeClienteDocument(Request $request, Cliente $cliente): JsonResponse
    {
        $validated = $request->validate([
            'category' => ['nullable', 'string', 'in:' . implode(',', self::CLIENT_DOCUMENT_CATEGORIES)],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'fechaVencimiento' => ['nullable', 'date'],
            'archivo' => ['required', 'file', 'max:51200'],
        ], [
            'archivo.max' => 'El archivo supera el límite de 50MB.',
        ]);

        /** @var UploadedFile $file */
        $file = $validated['archivo'];
        $disk = 'public';
        $directory = sprintf('clientes/%d/legajo-impositivo/%s', $cliente->id, now()->format('Y/m'));
        $extension = strtolower((string) ($file->getClientOriginalExtension() ?: $file->extension() ?: 'bin'));
        $filename = Str::random(20) . '.' . $extension;
        $path = $file->storeAs($directory, $filename, $disk);

        $document = ClientTaxDocument::query()->create([
            'cliente_id' => $cliente->id,
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

        AuditLogger::log($request, 'tax_profile.document.create', 'cliente', $cliente->id, [
            'document_id' => $document->id,
            'category' => $document->category,
            'title' => $document->title,
        ]);

        return response()->json([
            'message' => 'Documento del legajo cargado correctamente.',
            'data' => $this->serializeClientDocument($cliente, $document),
        ], 201);
    }

    public function destroyClienteDocument(Request $request, Cliente $cliente, ClientTaxDocument $documento): JsonResponse
    {
        if ((int) $documento->cliente_id !== (int) $cliente->id) {
            return response()->json(['message' => 'Documento no encontrado para este cliente.'], 404);
        }

        $disk = $documento->disk ?: 'public';
        if ($documento->path && Storage::disk($disk)->exists($documento->path)) {
            Storage::disk($disk)->delete($documento->path);
        }

        $documentId = $documento->id;
        $documento->delete();

        AuditLogger::log($request, 'tax_profile.document.delete', 'cliente', $cliente->id, [
            'document_id' => $documentId,
        ]);

        return response()->json([
            'message' => 'Documento eliminado correctamente.',
        ]);
    }

    public function downloadClienteDocument(Request $request, Cliente $cliente, ClientTaxDocument $documento)
    {
        if ((int) $documento->cliente_id !== (int) $cliente->id) {
            abort(404, 'Documento no encontrado para este cliente.');
        }

        $disk = $documento->disk ?: 'public';
        if (!$documento->path || !Storage::disk($disk)->exists($documento->path)) {
            abort(404, 'El archivo solicitado no está disponible.');
        }

        return Storage::disk($disk)->download(
            $documento->path,
            $documento->original_name ?: basename($documento->path)
        );
    }

    public function showPersona(Persona $persona): JsonResponse
    {
        return response()->json([
            'data' => $this->buildPayloadForPersona($persona),
        ]);
    }

    public function updatePersona(Request $request, Persona $persona): JsonResponse
    {
        $profile = $this->persistProfile(
            $request,
            'persona',
            $persona->id,
            $this->resolvePersonaDefaults($persona)
        );

        AuditLogger::log($request, 'tax_profile.update', 'persona', $persona->id, [
            'entity_type' => 'persona',
            'cuit' => $profile->cuit,
        ]);

        return response()->json([
            'message' => 'Legajo impositivo actualizado.',
            'data' => $this->formatProfile(
                $profile,
                $this->resolvePersonaDefaults($persona),
                $this->recentSnapshots('persona', $persona->id),
                collect()
            ),
        ]);
    }

    public function refreshPersonaNosis(Request $request, Persona $persona): JsonResponse
    {
        $result = $this->refreshNosis(
            $request,
            'persona',
            $persona->id,
            $this->resolvePersonaDefaults($persona)
        );

        return response()->json([
            'message' => 'Snapshot de Nosis actualizado.',
            'data' => $result,
        ]);
    }

    private function buildPayloadForCliente(Cliente $cliente): array
    {
        $defaults = $this->resolveClienteDefaults($cliente);
        $profile = $this->findProfile('cliente', $cliente->id);

        return $this->formatProfile(
            $profile,
            $defaults,
            $this->recentSnapshots('cliente', $cliente->id),
            $this->clientDocuments($cliente)
        );
    }

    private function buildPayloadForPersona(Persona $persona): array
    {
        $defaults = $this->resolvePersonaDefaults($persona);
        $profile = $this->findProfile('persona', $persona->id);

        return $this->formatProfile(
            $profile,
            $defaults,
            $this->recentSnapshots('persona', $persona->id),
            collect()
        );
    }

    private function persistProfile(Request $request, string $entityType, int $entityId, array $defaults): TaxProfile
    {
        $validated = $request->validate([
            'cuit' => ['nullable', 'string', 'max:20'],
            'razonSocial' => ['nullable', 'string', 'max:255'],
            'arcaStatus' => ['nullable', 'string', 'max:255'],
            'dgrStatus' => ['nullable', 'string', 'max:255'],
            'fiscalAddressStreet' => ['nullable', 'string', 'max:255'],
            'fiscalAddressNumber' => ['nullable', 'string', 'max:20'],
            'fiscalAddressFloor' => ['nullable', 'string', 'max:20'],
            'fiscalAddressUnit' => ['nullable', 'string', 'max:20'],
            'fiscalAddressLocality' => ['nullable', 'string', 'max:255'],
            'fiscalAddressPostalCode' => ['nullable', 'string', 'max:20'],
            'fiscalAddressProvince' => ['nullable', 'string', 'max:120'],
            'activityMainCode' => ['nullable', 'string', 'max:20'],
            'activityMainDescription' => ['nullable', 'string', 'max:255'],
            'activityMainSector' => ['nullable', 'string', 'max:120'],
            'activityMainStartDate' => ['nullable', 'date'],
            'afipKeyStatus' => ['nullable', 'string', 'max:120'],
            'afipKeyStatusDate' => ['nullable', 'date'],
            'ivaRegistered' => ['nullable', 'boolean'],
            'ivaWithholdingExclusion' => ['nullable', 'boolean'],
            'ivaRegisteredAt' => ['nullable', 'date'],
            'ivaCondition' => ['nullable', 'string', 'max:120'],
            'gananciasRegistered' => ['nullable', 'boolean'],
            'gananciasWithholdingExclusion' => ['nullable', 'boolean'],
            'gananciasRegisteredAt' => ['nullable', 'date'],
            'gananciasCondition' => ['nullable', 'string', 'max:120'],
            'monotributoRegistered' => ['nullable', 'boolean'],
            'monotributoRegisteredAt' => ['nullable', 'date'],
            'monotributoCategory' => ['nullable', 'string', 'max:40'],
            'monotributoType' => ['nullable', 'string', 'max:255'],
            'monotributoActivity' => ['nullable', 'string', 'max:255'],
            'monotributoSeniorityMonths' => ['nullable', 'integer', 'min:0'],
            'isEmployee' => ['nullable', 'boolean'],
            'isEmployer' => ['nullable', 'boolean'],
            'isRetired' => ['nullable', 'boolean'],
            'exclusionNotes' => ['nullable', 'string'],
            'exemptionNotes' => ['nullable', 'string'],
            'regimeNotes' => ['nullable', 'string'],
            'bankAccount' => ['nullable', 'string', 'max:40'],
            'bankAlias' => ['nullable', 'string', 'max:255'],
            'bankOwnerName' => ['nullable', 'string', 'max:255'],
            'bankOwnerDocument' => ['nullable', 'string', 'max:20'],
            'bankValidationStatus' => ['nullable', 'string', 'max:40'],
            'insuranceNotes' => ['nullable', 'string'],
            'observations' => ['nullable', 'string'],
        ]);

        $cuit = $this->sanitizeDocument($validated['cuit'] ?? ($defaults['cuit'] ?? null));
        if ($cuit !== null && strlen($cuit) !== 11) {
            abort(response()->json([
                'message' => 'El CUIT/CUIL debe tener 11 dígitos.',
            ], 422));
        }

        $bankAccount = $this->sanitizeBankAccount($validated['bankAccount'] ?? ($defaults['bankAccount'] ?? null));
        if ($bankAccount !== null && strlen($bankAccount) !== 22) {
            abort(response()->json([
                'message' => 'La cuenta bancaria para validación fiscal debe tener 22 dígitos.',
            ], 422));
        }

        $profile = $this->findProfile($entityType, $entityId) ?? new TaxProfile([
            'entity_type' => $entityType,
            'entity_id' => $entityId,
        ]);

        $profile->fill([
            'cuit' => $cuit,
            'razon_social' => $this->sanitizeString($validated['razonSocial'] ?? ($defaults['razonSocial'] ?? null)),
            'arca_status' => $this->sanitizeString($validated['arcaStatus'] ?? null),
            'dgr_status' => $this->sanitizeString($validated['dgrStatus'] ?? null),
            'fiscal_address_street' => $this->sanitizeString($validated['fiscalAddressStreet'] ?? null),
            'fiscal_address_number' => $this->sanitizeString($validated['fiscalAddressNumber'] ?? null),
            'fiscal_address_floor' => $this->sanitizeString($validated['fiscalAddressFloor'] ?? null),
            'fiscal_address_unit' => $this->sanitizeString($validated['fiscalAddressUnit'] ?? null),
            'fiscal_address_locality' => $this->sanitizeString($validated['fiscalAddressLocality'] ?? null),
            'fiscal_address_postal_code' => $this->sanitizeString($validated['fiscalAddressPostalCode'] ?? null),
            'fiscal_address_province' => $this->sanitizeString($validated['fiscalAddressProvince'] ?? null),
            'activity_main_code' => $this->sanitizeString($validated['activityMainCode'] ?? null),
            'activity_main_description' => $this->sanitizeString($validated['activityMainDescription'] ?? null),
            'activity_main_sector' => $this->sanitizeString($validated['activityMainSector'] ?? null),
            'activity_main_started_at' => $this->sanitizeDate($validated['activityMainStartDate'] ?? null),
            'afip_key_status' => $this->sanitizeString($validated['afipKeyStatus'] ?? null),
            'afip_key_status_at' => $this->sanitizeDate($validated['afipKeyStatusDate'] ?? null),
            'iva_inscripto' => $this->sanitizeBoolean($validated['ivaRegistered'] ?? null),
            'iva_exento_retencion' => $this->sanitizeBoolean($validated['ivaWithholdingExclusion'] ?? null),
            'iva_registered_at' => $this->sanitizeDate($validated['ivaRegisteredAt'] ?? null),
            'iva_condition' => $this->sanitizeString($validated['ivaCondition'] ?? null),
            'ganancias_inscripto' => $this->sanitizeBoolean($validated['gananciasRegistered'] ?? null),
            'ganancias_exento_retencion' => $this->sanitizeBoolean($validated['gananciasWithholdingExclusion'] ?? null),
            'ganancias_registered_at' => $this->sanitizeDate($validated['gananciasRegisteredAt'] ?? null),
            'ganancias_condition' => $this->sanitizeString($validated['gananciasCondition'] ?? null),
            'monotributo_inscripto' => $this->sanitizeBoolean($validated['monotributoRegistered'] ?? null),
            'monotributo_registered_at' => $this->sanitizeDate($validated['monotributoRegisteredAt'] ?? null),
            'monotributo_category' => $this->sanitizeString($validated['monotributoCategory'] ?? null),
            'monotributo_type' => $this->sanitizeString($validated['monotributoType'] ?? null),
            'monotributo_activity' => $this->sanitizeString($validated['monotributoActivity'] ?? null),
            'monotributo_seniority_months' => $this->sanitizeInteger($validated['monotributoSeniorityMonths'] ?? null),
            'is_employee' => $this->sanitizeBoolean($validated['isEmployee'] ?? null),
            'is_employer' => $this->sanitizeBoolean($validated['isEmployer'] ?? null),
            'is_retired' => $this->sanitizeBoolean($validated['isRetired'] ?? null),
            'exclusion_notes' => $this->sanitizeText($validated['exclusionNotes'] ?? null),
            'exemption_notes' => $this->sanitizeText($validated['exemptionNotes'] ?? null),
            'regime_notes' => $this->sanitizeText($validated['regimeNotes'] ?? null),
            'bank_account' => $bankAccount,
            'bank_alias' => $this->sanitizeString($validated['bankAlias'] ?? ($defaults['bankAlias'] ?? null)),
            'bank_owner_name' => $this->sanitizeString($validated['bankOwnerName'] ?? null),
            'bank_owner_document' => $this->sanitizeDocument($validated['bankOwnerDocument'] ?? null),
            'bank_validation_status' => $this->sanitizeString($validated['bankValidationStatus'] ?? null),
            'insurance_notes' => $this->sanitizeText($validated['insuranceNotes'] ?? null),
            'observations' => $this->sanitizeText($validated['observations'] ?? null),
        ]);

        $profile->save();

        return $profile->fresh(['latestNosisSnapshot']);
    }

    private function refreshNosis(Request $request, string $entityType, int $entityId, array $defaults): array
    {
        $validated = $request->validate([
            'cuit' => ['nullable', 'string', 'max:20'],
            'razonSocial' => ['nullable', 'string', 'max:255'],
            'bankAccount' => ['nullable', 'string', 'max:40'],
            'bankAlias' => ['nullable', 'string', 'max:255'],
        ]);

        $profile = $this->findProfile($entityType, $entityId);
        if (!$profile) {
            $profile = new TaxProfile([
                'entity_type' => $entityType,
                'entity_id' => $entityId,
            ]);
        }

        $requestedCuit = $this->sanitizeDocument($validated['cuit'] ?? null);
        if ($requestedCuit !== null && strlen($requestedCuit) !== 11) {
            abort(response()->json([
                'message' => 'El CUIT/CUIL debe tener 11 dígitos.',
            ], 422));
        }

        $requestedBankAccount = $this->sanitizeBankAccount($validated['bankAccount'] ?? null);
        if ($requestedBankAccount !== null && strlen($requestedBankAccount) !== 22) {
            abort(response()->json([
                'message' => 'La cuenta bancaria para validación fiscal debe tener 22 dígitos.',
            ], 422));
        }

        $documento = $requestedCuit
            ?: $this->sanitizeDocument($profile->cuit ?: ($defaults['cuit'] ?? null));
        if (!$documento) {
            abort(response()->json([
                'message' => 'No hay CUIT/CUIL para consultar Nosis.',
            ], 422));
        }

        $lookup = $this->nosisClient->lookupDocumento($documento);
        $lookupParsed = is_array($lookup['parsed'] ?? null) ? $lookup['parsed'] : [];
        $documentSnapshot = $this->storeSnapshot(
            $entityType,
            $entityId,
            'DOCUMENTO',
            $documento,
            null,
            $lookup
        );
        $profileDocumentBeforeRefresh = $this->sanitizeDocument($profile->cuit);
        $documentChanged = $profileDocumentBeforeRefresh !== null && $profileDocumentBeforeRefresh !== $documento;
        $fallbackRazonSocial = $this->sanitizeString($validated['razonSocial'] ?? null)
            ?? $this->sanitizeString($defaults['razonSocial'] ?? null);
        if (!$documentChanged) {
            $fallbackRazonSocial = $fallbackRazonSocial ?? $profile->razon_social;
        }

        $profile->cuit = $lookup['parsed']['documentoNormalizado']
            ?? $lookup['parsed']['documento']
            ?? $documento;
        $profile->razon_social = $lookup['parsed']['razonSocial']
            ?? $fallbackRazonSocial;
        $profile->arca_status = $this->inferArcaStatus($lookupParsed) ?? $profile->arca_status;
        $profile->dgr_status = $this->inferDgrStatus($lookupParsed) ?? $profile->dgr_status;
        $this->fillProfileFromNosisParsed($profile, $lookupParsed);
        $profile->latest_nosis_snapshot_id = $documentSnapshot->id;

        $bankAccount = $requestedBankAccount
            ?: $this->sanitizeBankAccount($profile->bank_account ?: ($defaults['bankAccount'] ?? null));
        $profile->bank_alias = $this->sanitizeString($validated['bankAlias'] ?? null)
            ?? $profile->bank_alias
            ?? $this->sanitizeString($defaults['bankAlias'] ?? null);

        $snapshots = [$documentSnapshot];

        if ($bankAccount && strlen($bankAccount) === 22) {
            $fechaNacimiento = $defaults['fechaNacimiento'] ?? null;
            $bankValidation = $this->nosisClient->validateCbu($documento, $bankAccount, null, $fechaNacimiento);
            $bankParsed = is_array($bankValidation['parsed'] ?? null) ? $bankValidation['parsed'] : [];
            $bankSnapshot = $this->storeSnapshot(
                $entityType,
                $entityId,
                'CBU',
                $documento,
                $bankAccount,
                $bankValidation
            );

            $profile->bank_account = $bankAccount;
            $profile->bank_owner_name = $this->inferBankOwnerName($bankParsed) ?? $profile->bank_owner_name;
            $profile->bank_owner_document = $this->inferBankOwnerDocument($bankParsed) ?? $profile->bank_owner_document;
            $profile->bank_validation_status = $this->inferBankValidationStatus($bankParsed, (bool) ($bankValidation['valid'] ?? false))
                ?? (($bankValidation['valid'] ?? false) ? 'validado' : 'observado');
            $profile->arca_status = $this->inferArcaStatus($bankParsed) ?? $profile->arca_status;
            $profile->dgr_status = $this->inferDgrStatus($bankParsed) ?? $profile->dgr_status;
            $this->fillProfileFromNosisParsed($profile, $bankParsed);
            $profile->latest_nosis_snapshot_id = $bankSnapshot->id;
            $snapshots[] = $bankSnapshot;
        }

        $profile->save();

        AuditLogger::log($request, 'tax_profile.refresh_nosis', $entityType, $entityId, [
            'entity_type' => $entityType,
            'documento' => $documento,
            'snapshots' => collect($snapshots)->pluck('id')->all(),
        ]);

        return $this->formatProfile(
            $profile->fresh(['latestNosisSnapshot']),
            $defaults,
            $this->recentSnapshots($entityType, $entityId),
            $entityType === 'cliente' && isset($defaults['cliente'])
                ? $this->clientDocuments($defaults['cliente'])
                : collect()
        );
    }

    private function storeSnapshot(
        string $entityType,
        int $entityId,
        string $snapshotType,
        ?string $documento,
        ?string $cbu,
        array $result
    ): NosisSnapshot {
        return NosisSnapshot::query()->create([
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'snapshot_type' => $snapshotType,
            'documento' => $documento,
            'cbu' => $cbu,
            'valid' => (bool) ($result['valid'] ?? false),
            'message' => $this->sanitizeString($result['message'] ?? null),
            'raw_response' => $this->serializeRawResponse($result['raw'] ?? null),
            'parsed_response' => is_array($result['parsed'] ?? null) ? $result['parsed'] : null,
            'requested_at' => Carbon::now(),
        ]);
    }

    private function findProfile(string $entityType, int $entityId): ?TaxProfile
    {
        return TaxProfile::query()
            ->with('latestNosisSnapshot')
            ->where('entity_type', $entityType)
            ->where('entity_id', $entityId)
            ->first();
    }

    private function recentSnapshots(string $entityType, int $entityId)
    {
        return NosisSnapshot::query()
            ->where('entity_type', $entityType)
            ->where('entity_id', $entityId)
            ->orderByDesc('requested_at')
            ->orderByDesc('id')
            ->limit(5)
            ->get();
    }

    private function formatProfile(?TaxProfile $profile, array $defaults, $snapshots, $documents): array
    {
        $latestSnapshot = $profile?->latestNosisSnapshot;

        return [
            'id' => $profile?->id,
            'entityType' => $profile?->entity_type ?? $defaults['entityType'],
            'entityId' => $profile?->entity_id ?? $defaults['entityId'],
            'cuit' => $profile?->cuit ?? ($defaults['cuit'] ?? null),
            'razonSocial' => $profile?->razon_social ?? ($defaults['razonSocial'] ?? null),
            'arcaStatus' => $profile?->arca_status,
            'dgrStatus' => $profile?->dgr_status,
            'fiscalAddressStreet' => $profile?->fiscal_address_street,
            'fiscalAddressNumber' => $profile?->fiscal_address_number,
            'fiscalAddressFloor' => $profile?->fiscal_address_floor,
            'fiscalAddressUnit' => $profile?->fiscal_address_unit,
            'fiscalAddressLocality' => $profile?->fiscal_address_locality,
            'fiscalAddressPostalCode' => $profile?->fiscal_address_postal_code,
            'fiscalAddressProvince' => $profile?->fiscal_address_province,
            'activityMainCode' => $profile?->activity_main_code,
            'activityMainDescription' => $profile?->activity_main_description,
            'activityMainSector' => $profile?->activity_main_sector,
            'activityMainStartDate' => $this->formatDateValue($profile?->activity_main_started_at),
            'activities' => $this->formatActivities($profile?->activities),
            'afipKeyStatus' => $profile?->afip_key_status,
            'afipKeyStatusDate' => $this->formatDateValue($profile?->afip_key_status_at),
            'ivaRegistered' => $profile?->iva_inscripto,
            'ivaWithholdingExclusion' => $profile?->iva_exento_retencion,
            'ivaRegisteredAt' => $this->formatDateValue($profile?->iva_registered_at),
            'ivaCondition' => $profile?->iva_condition,
            'gananciasRegistered' => $profile?->ganancias_inscripto,
            'gananciasWithholdingExclusion' => $profile?->ganancias_exento_retencion,
            'gananciasRegisteredAt' => $this->formatDateValue($profile?->ganancias_registered_at),
            'gananciasCondition' => $profile?->ganancias_condition,
            'monotributoRegistered' => $profile?->monotributo_inscripto,
            'monotributoRegisteredAt' => $this->formatDateValue($profile?->monotributo_registered_at),
            'monotributoCategory' => $profile?->monotributo_category,
            'monotributoType' => $profile?->monotributo_type,
            'monotributoActivity' => $profile?->monotributo_activity,
            'monotributoSeniorityMonths' => $profile?->monotributo_seniority_months,
            'isEmployee' => $profile?->is_employee,
            'isEmployer' => $profile?->is_employer,
            'isRetired' => $profile?->is_retired,
            'exclusionNotes' => $profile?->exclusion_notes,
            'exemptionNotes' => $profile?->exemption_notes,
            'regimeNotes' => $profile?->regime_notes,
            'bankAccount' => $profile?->bank_account ?? ($defaults['bankAccount'] ?? null),
            'bankAlias' => $profile?->bank_alias ?? ($defaults['bankAlias'] ?? null),
            'bankOwnerName' => $profile?->bank_owner_name,
            'bankOwnerDocument' => $profile?->bank_owner_document,
            'bankValidationStatus' => $profile?->bank_validation_status,
            'insuranceNotes' => $profile?->insurance_notes,
            'observations' => $profile?->observations,
            'latestNosisSnapshotId' => $profile?->latest_nosis_snapshot_id,
            'latestNosisSnapshot' => $latestSnapshot ? $this->formatSnapshot($latestSnapshot) : null,
            'snapshots' => $snapshots->map(fn (NosisSnapshot $snapshot) => $this->formatSnapshot($snapshot))->values(),
            'documents' => $documents->map(
                fn (ClientTaxDocument $document) => $this->serializeClientDocument($defaults['cliente'] ?? null, $document)
            )->values(),
        ];
    }

    private function formatSnapshot(NosisSnapshot $snapshot): array
    {
        return [
            'id' => $snapshot->id,
            'snapshotType' => $snapshot->snapshot_type,
            'documento' => $snapshot->documento,
            'cbu' => $snapshot->cbu,
            'valid' => (bool) $snapshot->valid,
            'message' => $snapshot->message,
            'requestedAt' => optional($snapshot->requested_at)->toIso8601String(),
            'requestedAtLabel' => optional($snapshot->requested_at)
                ? $snapshot->requested_at->timezone(config('app.timezone', 'UTC'))->format('d/m/Y H:i')
                : null,
            'parsed' => $snapshot->parsed_response,
        ];
    }

    private function resolveClienteDefaults(Cliente $cliente): array
    {
        return [
            'entityType' => 'cliente',
            'entityId' => $cliente->id,
            'cliente' => $cliente,
            'cuit' => $this->sanitizeDocument($cliente->documento_fiscal),
            'razonSocial' => $this->sanitizeString($cliente->nombre),
            'bankAccount' => null,
            'bankAlias' => null,
            'fechaNacimiento' => null,
        ];
    }

    private function resolvePersonaDefaults(Persona $persona): array
    {
        $bankRaw = $this->sanitizeString($persona->cbu_alias);
        $bankDigits = $this->sanitizeBankAccount($bankRaw);

        return [
            'entityType' => 'persona',
            'entityId' => $persona->id,
            'cuit' => $this->sanitizeDocument($persona->cuil),
            'razonSocial' => $this->sanitizeString(trim(($persona->nombres ?? '') . ' ' . ($persona->apellidos ?? ''))),
            'bankAccount' => $bankDigits,
            'bankAlias' => $bankDigits ? null : $bankRaw,
            'fechaNacimiento' => optional($persona->dueno?->fecha_nacimiento)->format('Y-m-d'),
        ];
    }

    private function clientDocuments(Cliente $cliente)
    {
        return ClientTaxDocument::query()
            ->where('cliente_id', $cliente->id)
            ->orderByDesc('fecha_vencimiento')
            ->orderByDesc('id')
            ->get();
    }

    private function serializeClientDocument(?Cliente $cliente, ClientTaxDocument $document): array
    {
        $downloadUrl = $cliente
            ? route('clientes.legajo.documentos.descargar', [
                'cliente' => $cliente->id,
                'documento' => $document->id,
            ], false)
            : null;

        return [
            'id' => $document->id,
            'category' => $document->category,
            'title' => $document->title,
            'description' => $document->description,
            'fechaVencimiento' => optional($document->fecha_vencimiento)?->format('Y-m-d'),
            'mime' => $document->mime,
            'size' => $document->size,
            'originalName' => $document->original_name,
            'createdAt' => optional($document->created_at)?->toIso8601String(),
            'downloadUrl' => $downloadUrl,
        ];
    }

    private function serializeRawResponse(mixed $raw): ?string
    {
        if ($raw === null) {
            return null;
        }

        if (is_string($raw)) {
            $trimmed = trim($raw);
            return $trimmed !== '' ? $trimmed : null;
        }

        $encoded = json_encode($raw, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return $encoded !== false ? $encoded : null;
    }

    private function sanitizeString(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function sanitizeText(?string $value): ?string
    {
        return $this->sanitizeString($value);
    }

    private function sanitizeBoolean(mixed $value): ?bool
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_bool($value)) {
            return $value;
        }

        return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    }

    private function sanitizeInteger(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_int($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        return null;
    }

    private function sanitizeDate(?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        return Carbon::parse($value)->toDateString();
    }

    private function sanitizeDocument(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $value) ?: '';

        return $digits !== '' ? $digits : null;
    }

    private function sanitizeBankAccount(?string $value): ?string
    {
        $digits = $this->sanitizeDocument($value);

        return $digits !== null ? substr($digits, 0, 30) : null;
    }

    private function formatDateValue(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            if ($value instanceof Carbon) {
                return $value->toDateString();
            }

            return Carbon::parse((string) $value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    private function fillProfileFromNosisParsed(TaxProfile $profile, array $parsed): void
    {
        $fields = [
            'fiscal_address_street' => $this->arrayString($parsed, ['fiscalAddressStreet']),
            'fiscal_address_number' => $this->arrayString($parsed, ['fiscalAddressNumber']),
            'fiscal_address_floor' => $this->arrayString($parsed, ['fiscalAddressFloor']),
            'fiscal_address_unit' => $this->arrayString($parsed, ['fiscalAddressUnit']),
            'fiscal_address_locality' => $this->arrayString($parsed, ['fiscalAddressLocality']),
            'fiscal_address_postal_code' => $this->arrayString($parsed, ['fiscalAddressPostalCode']),
            'fiscal_address_province' => $this->arrayString($parsed, ['fiscalAddressProvince']),
            'activity_main_code' => $this->arrayString($parsed, ['activityMainCode']),
            'activity_main_description' => $this->arrayString($parsed, ['activityMainDescription']),
            'activity_main_sector' => $this->arrayString($parsed, ['activityMainSector']),
            'activity_main_started_at' => $this->arrayDate($parsed, ['activityMainStartDate']),
            'afip_key_status' => $this->arrayString($parsed, ['afipKeyStatus']),
            'afip_key_status_at' => $this->arrayDate($parsed, ['afipKeyStatusDate']),
            'iva_inscripto' => $this->arrayBool($parsed, ['ivaRegistered']),
            'iva_exento_retencion' => $this->arrayBool($parsed, ['ivaWithholdingExclusion']),
            'iva_registered_at' => $this->arrayDate($parsed, ['ivaRegisteredAt']),
            'iva_condition' => $this->arrayString($parsed, ['ivaCondition']),
            'ganancias_inscripto' => $this->arrayBool($parsed, ['gananciasRegistered']),
            'ganancias_exento_retencion' => $this->arrayBool($parsed, ['gananciasWithholdingExclusion']),
            'ganancias_registered_at' => $this->arrayDate($parsed, ['gananciasRegisteredAt']),
            'ganancias_condition' => $this->arrayString($parsed, ['gananciasCondition']),
            'monotributo_inscripto' => $this->arrayBool($parsed, ['monotributoRegistered']),
            'monotributo_registered_at' => $this->arrayDate($parsed, ['monotributoRegisteredAt']),
            'monotributo_category' => $this->arrayString($parsed, ['monotributoCategory']),
            'monotributo_type' => $this->arrayString($parsed, ['monotributoType']),
            'monotributo_activity' => $this->arrayString($parsed, ['monotributoActivity']),
            'monotributo_seniority_months' => $this->arrayInt($parsed, ['monotributoSeniorityMonths']),
            'is_employee' => $this->arrayBool($parsed, ['isEmployee']),
            'is_employer' => $this->arrayBool($parsed, ['isEmployer']),
            'is_retired' => $this->arrayBool($parsed, ['isRetired']),
        ];

        foreach ($fields as $attribute => $value) {
            if ($value !== null) {
                $profile->{$attribute} = $value;
            }
        }

        $activities = $this->sanitizeActivities($parsed['activities'] ?? null);
        if ($activities !== null) {
            $profile->activities = $activities;
        }
    }

    private function inferArcaStatus(array $parsed): ?string
    {
        $explicit = $this->arrayString($parsed, [
            'arcaStatus',
            'afipStatus',
            'estadoFiscal',
            'condicionFiscal',
        ]);
        if ($explicit !== null) {
            return $explicit;
        }

        $novedad = $this->arrayString($parsed, ['resultadoNovedad']);
        $estado = $this->arrayString($parsed, ['resultadoEstado']);
        if ($novedad !== null && $estado !== null && $estado !== '200') {
            return sprintf('%s (código %s)', $novedad, $estado);
        }

        return $novedad ?? ($estado !== null ? sprintf('Código %s', $estado) : null);
    }

    private function inferDgrStatus(array $parsed): ?string
    {
        return $this->arrayString($parsed, [
            'dgrStatus',
            'estadoDgr',
            'condicionDgr',
            'ingresosBrutosEstado',
        ]);
    }

    private function inferBankOwnerName(array $parsed): ?string
    {
        return $this->arrayString($parsed, [
            'bankOwnerName',
            'titularCuenta',
            'titular',
            'nombreTitular',
            'razonSocialTitular',
        ]);
    }

    private function inferBankOwnerDocument(array $parsed): ?string
    {
        return $this->sanitizeDocument($this->arrayString($parsed, [
            'bankOwnerDocument',
            'documentoTitular',
            'titularDocumento',
            'cuitTitular',
            'cuilTitular',
        ]));
    }

    private function inferBankValidationStatus(array $parsed, bool $valid): ?string
    {
        return $this->arrayString($parsed, [
            'cbuEstado',
            'bankValidationStatus',
        ]) ?? ($valid ? 'validado' : null);
    }

    private function formatActivities(mixed $value): array
    {
        $activities = $this->sanitizeActivities($value);

        return $activities ?? [];
    }

    private function sanitizeActivities(mixed $value): ?array
    {
        if (!is_array($value)) {
            return null;
        }

        $activities = [];

        foreach ($value as $item) {
            if (!is_array($item)) {
                continue;
            }

            $code = $this->sanitizeString($item['code'] ?? null);
            $description = $this->sanitizeString($item['description'] ?? null);
            $sector = $this->sanitizeString($item['sector'] ?? null);
            $startDate = $this->formatDateValue($item['startDate'] ?? null);

            if ($code === null && $description === null && $sector === null && $startDate === null) {
                continue;
            }

            $activities[] = [
                'code' => $code,
                'description' => $description,
                'sector' => $sector,
                'startDate' => $startDate,
            ];
        }

        return $activities;
    }

    private function arrayBool(array $payload, array $keys): ?bool
    {
        foreach ($keys as $key) {
            if (!array_key_exists($key, $payload)) {
                continue;
            }

            $value = $this->sanitizeBoolean($payload[$key]);
            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    private function arrayInt(array $payload, array $keys): ?int
    {
        foreach ($keys as $key) {
            if (!array_key_exists($key, $payload)) {
                continue;
            }

            $value = $this->sanitizeInteger($payload[$key]);
            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    private function arrayDate(array $payload, array $keys): ?string
    {
        foreach ($keys as $key) {
            if (!array_key_exists($key, $payload)) {
                continue;
            }

            $value = $payload[$key];
            if (!is_scalar($value)) {
                continue;
            }

            $text = trim((string) $value);
            if ($text === '') {
                continue;
            }

            return $this->normalizeDateString($text);
        }

        return null;
    }

    private function arrayString(array $payload, array $keys): ?string
    {
        foreach ($keys as $key) {
            if (!array_key_exists($key, $payload)) {
                continue;
            }

            $value = $payload[$key];
            if (!is_scalar($value)) {
                continue;
            }

            $text = trim((string) $value);
            if ($text !== '') {
                return $text;
            }
        }

        return null;
    }

    private function normalizeDateString(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        if (preg_match('/^(\d{4})(\d{2})(\d{2})$/', $trimmed, $matches) === 1) {
            return "{$matches[1]}-{$matches[2]}-{$matches[3]}";
        }

        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $trimmed, $matches) === 1) {
            return "{$matches[3]}-{$matches[2]}-{$matches[1]}";
        }

        try {
            return Carbon::parse($trimmed)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }
}

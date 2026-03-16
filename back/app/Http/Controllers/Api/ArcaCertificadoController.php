<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ArcaCertificado;
use App\Models\ArcaEmisor;
use App\Repositories\Arca\ArcaCertificadoRepository;
use App\Services\Arca\ArcaCsrService;
use App\Services\Arca\ArcaCertificateInspector;
use App\Services\Arca\ArcaCertificateStorage;
use App\Services\Arca\Wsaa\TaCacheService;
use App\Services\Facturacion\FacturacionAuditService;
use App\Support\Facturacion\AmbienteArca;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use RuntimeException;
use Throwable;

class ArcaCertificadoController extends Controller
{
    public function __construct(
        private readonly ArcaCsrService $csrService,
        private readonly ArcaCertificateStorage $certificateStorage,
        private readonly ArcaCertificateInspector $certificateInspector,
        private readonly ArcaCertificadoRepository $certificadoRepository,
        private readonly TaCacheService $taCacheService,
        private readonly FacturacionAuditService $auditService,
    ) {
    }

    public function index(Request $request, ArcaEmisor $emisor): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        $certificados = ArcaCertificado::query()
            ->where('emisor_id', $emisor->id)
            ->orderByDesc('valid_to')
            ->orderByDesc('id')
            ->get()
            ->map(fn (ArcaCertificado $certificado) => $this->serializeCertificado($certificado))
            ->values();

        return response()->json(['data' => $certificados]);
    }

    public function generarCsr(Request $request): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para generar CSR.'], 403);
        }

        $validated = $request->validate([
            'emisor_id' => ['required', 'integer', 'exists:arca_emisor,id'],
            'alias' => ['required', 'string', 'max:120'],
            'common_name' => ['required', 'string', 'max:120'],
            'organization' => ['required', 'string', 'max:255'],
            'country' => ['required', 'string', Rule::in(['AR'])],
            'ambiente' => ['required', Rule::in(['HOMO', 'PROD'])],
        ]);

        $emisor = ArcaEmisor::query()->findOrFail((int) $validated['emisor_id']);
        $ambiente = AmbienteArca::fromMixed($validated['ambiente']);
        $alias = trim($validated['alias']);

        $subject = [
            'country' => strtoupper(trim($validated['country'])),
            'organization' => trim($validated['organization']),
            'common_name' => trim($validated['common_name']),
            'serial_number' => 'CUIT ' . trim((string) $emisor->cuit),
        ];

        $generated = $this->csrService->generate($subject);
        $csrPem = $generated['csr_pem'];
        $privateKeyPem = $generated['private_key_pem'];

        $certificado = DB::transaction(function () use ($emisor, $ambiente, $alias, $csrPem, $privateKeyPem, $generated) {
            $csrPath = $this->certificateStorage->storeCsrPem($emisor->id, $alias, $ambiente, $csrPem);
            $keyPath = $this->certificateStorage->storeEncryptedPrivateKey($emisor->id, $alias, $ambiente, $privateKeyPem);

            $existing = ArcaCertificado::query()
                ->where('emisor_id', $emisor->id)
                ->where('alias', $alias)
                ->where('ambiente', $ambiente->value)
                ->first();

            $payload = [
                'subject_dn' => $generated['subject_dn'] ?? null,
                'serial_number_subject' => $subject['serial_number'],
                'csr_pem' => $csrPem,
                'csr_path' => $csrPath,
                'private_key_path_encrypted' => $keyPath,
                'certificado_pem_path' => null,
                'certificate_crt_path' => null,
                'p12_path_encrypted' => null,
                'password_ref' => null,
                'p12_password_ref' => null,
                'thumbprint_sha1' => null,
                'thumbprint_sha256' => null,
                'valid_from' => null,
                'valid_to' => null,
                'activo' => false,
                'estado' => 'CSR_GENERADO',
            ];

            if ($existing) {
                $existing->fill($payload);
                $existing->save();
                return $existing;
            }

            return ArcaCertificado::query()->create(array_merge($payload, [
                'emisor_id' => $emisor->id,
                'alias' => $alias,
                'ambiente' => $ambiente->value,
            ]));
        });

        $this->auditService->record(
            'arca_certificado',
            $certificado->id,
            'certificado.csr_generado',
            null,
            ['alias' => $alias, 'ambiente' => $ambiente->value],
            $request->user()?->id,
            $request->ip()
        );

        return response()->json([
            'ok' => true,
            'certificado_borrador_id' => $certificado->id,
            'alias' => $alias,
            'csr_filename' => sprintf('%s.csr', $alias),
            'csr_pem' => $csrPem,
            'download_url' => sprintf('/api/arca/certificados/%d/csr', $certificado->id),
        ]);
    }

    public function downloadCsr(Request $request, ArcaCertificado $certificado)
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para descargar el CSR.'], 403);
        }

        $csrPem = $certificado->csr_pem ?: $this->certificateStorage->readCsrPem($certificado);
        $filename = sprintf('%s.csr', $certificado->alias);

        return response($csrPem, 200, [
            'Content-Type' => 'application/pkcs10',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    public function importarPorCertificado(Request $request, ArcaCertificado $certificado): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para importar certificados.'], 403);
        }

        $validated = $request->validate([
            'alias' => ['nullable', 'string', 'max:120'],
            'ambiente' => ['nullable', Rule::in(['HOMO', 'PROD'])],
            'crt' => ['nullable', 'file'],
            'key' => ['nullable', 'file'],
            'p12' => ['nullable', 'file'],
            'password' => ['nullable', 'string'],
            'activo' => ['sometimes', 'boolean'],
        ]);

        if (! $request->hasFile('p12') && ! $request->hasFile('crt')) {
            return response()->json(['message' => 'Debes enviar un archivo P12 o un CRT.'], 422);
        }

        if (! empty($validated['alias']) && trim($validated['alias']) !== $certificado->alias) {
            return response()->json(['message' => 'El alias no coincide con el certificado seleccionado.'], 422);
        }

        if (! empty($validated['ambiente']) && $validated['ambiente'] !== ($certificado->ambiente?->value ?? $certificado->ambiente)) {
            return response()->json(['message' => 'El ambiente no coincide con el certificado seleccionado.'], 422);
        }

        if ($request->hasFile('p12')) {
            return $this->importP12OnCert($request, $certificado);
        }

        return $this->importCrtOnCert($request, $certificado);
    }

    public function testWsaaPorCertificado(Request $request, ArcaCertificado $certificado): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        if (! $certificado->certificado_pem_path) {
            return response()->json(['message' => 'El certificado aún no fue importado.'], 422);
        }

        try {
            $token = $this->taCacheService->getValidTa($certificado);
        } catch (Throwable $exception) {
            return response()->json([
                'message' => 'WSAA no respondio correctamente.',
                'error' => $exception->getMessage(),
            ], 502);
        }

        $certificado->refresh();
        $this->auditService->record(
            'arca_certificado',
            $certificado->id,
            'certificado.test_wsaa',
            null,
            ['token_expiration' => $token->expirationTime->toIso8601String()],
            $request->user()?->id,
            $request->ip()
        );

        return response()->json([
            'message' => 'WSAA OK.',
            'data' => [
                'certificado' => $this->serializeCertificado($certificado),
                'generation_time' => $token->generationTime->toIso8601String(),
                'expiration_time' => $token->expirationTime->toIso8601String(),
            ],
        ]);
    }

    public function importar(Request $request, ArcaEmisor $emisor): JsonResponse
    {
        if ($request->hasFile('p12')) {
            return $this->importP12($request, $emisor);
        }

        if ($request->hasFile('crt') && $request->hasFile('key')) {
            return $this->importCrtKey($request, $emisor);
        }

        return response()->json(['message' => 'Debes enviar un archivo p12 o un par crt/key.'], 422);
    }

    public function importCrtKey(Request $request, ArcaEmisor $emisor): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para importar certificados.'], 403);
        }

        $validated = $request->validate([
            'alias' => ['required', 'string', 'max:120'],
            'ambiente' => ['required', Rule::in(['HOMO', 'PROD'])],
            'crt' => ['required', 'file'],
            'key' => ['required', 'file'],
            'password' => ['nullable', 'string'],
            'activo' => ['sometimes', 'boolean'],
        ]);

        $certPem = $this->readUploadedFile($validated['crt']);
        $keyPem = $this->readUploadedFile($validated['key']);

        if ($certPem === '' || $keyPem === '') {
            return response()->json(['message' => 'El CRT o la KEY estan vacios.'], 422);
        }

        $metadata = $this->certificateInspector->inspectPem($certPem);
        $ambiente = AmbienteArca::fromMixed($validated['ambiente']);
        $activo = array_key_exists('activo', $validated) ? (bool) $validated['activo'] : true;

        $certificado = DB::transaction(function () use ($emisor, $validated, $certPem, $keyPem, $metadata, $ambiente, $activo) {
            if ($activo) {
                ArcaCertificado::query()
                    ->where('emisor_id', $emisor->id)
                    ->where('ambiente', $ambiente->value)
                    ->update(['activo' => false]);
            }

            $certPath = $this->certificateStorage->storeCertificatePem($emisor->id, $validated['alias'], $ambiente, $certPem);
            $keyPath = $this->certificateStorage->storeEncryptedPrivateKey($emisor->id, $validated['alias'], $ambiente, $keyPem);
            $passwordRef = $this->certificateStorage->encryptPasswordReference($validated['password'] ?? null);

            $alias = trim($validated['alias']);
            $existing = ArcaCertificado::query()
                ->where('emisor_id', $emisor->id)
                ->where('alias', $alias)
                ->where('ambiente', $ambiente->value)
                ->first();

            if ($existing) {
                $existing->fill([
                    'subject_dn' => $metadata['subject_dn'] ?? null,
                    'serial_number_subject' => $metadata['serial_number_subject'] ?? null,
                    'thumbprint_sha1' => $metadata['thumbprint_sha1'] ?? null,
                    'thumbprint_sha256' => $metadata['thumbprint_sha256'] ?? null,
                    'certificado_pem_path' => $certPath,
                    'certificate_crt_path' => $certPath,
                    'private_key_path_encrypted' => $keyPath,
                    'p12_path_encrypted' => null,
                    'password_ref' => $passwordRef,
                    'p12_password_ref' => $passwordRef,
                    'valid_from' => $this->parseDateTime($metadata['valid_from'] ?? null),
                    'valid_to' => $this->parseDateTime($metadata['valid_to'] ?? null),
                    'activo' => $activo,
                    'estado' => $activo ? 'ACTIVO' : 'CRT_IMPORTADO',
                ]);
                $existing->save();
                return $existing;
            }

            return ArcaCertificado::query()->create([
                'emisor_id' => $emisor->id,
                'alias' => $alias,
                'ambiente' => $ambiente->value,
                'subject_dn' => $metadata['subject_dn'] ?? null,
                'serial_number_subject' => $metadata['serial_number_subject'] ?? null,
                'thumbprint_sha1' => $metadata['thumbprint_sha1'] ?? null,
                'thumbprint_sha256' => $metadata['thumbprint_sha256'] ?? null,
                'certificado_pem_path' => $certPath,
                'certificate_crt_path' => $certPath,
                'private_key_path_encrypted' => $keyPath,
                'p12_path_encrypted' => null,
                'password_ref' => $passwordRef,
                'p12_password_ref' => $passwordRef,
                'valid_from' => $this->parseDateTime($metadata['valid_from'] ?? null),
                'valid_to' => $this->parseDateTime($metadata['valid_to'] ?? null),
                'activo' => $activo,
                'estado' => $activo ? 'ACTIVO' : 'CRT_IMPORTADO',
            ]);
        });

        $this->auditService->record(
            'arca_certificado',
            $certificado->id,
            $certificado->wasRecentlyCreated ? 'certificado.importado.crt_key' : 'certificado.reemplazado.crt_key',
            null,
            $certificado->toArray(),
            $request->user()?->id,
            $request->ip()
        );

        return response()->json([
            'message' => 'Certificado importado correctamente.',
            'data' => $this->serializeCertificado($certificado->fresh()),
        ]);
    }

    private function importP12OnCert(Request $request, ArcaCertificado $certificado): JsonResponse
    {
        $validated = $request->validate([
            'p12' => ['required', 'file'],
            'password' => ['required', 'string'],
            'activo' => ['sometimes', 'boolean'],
        ]);

        $p12Binary = $this->readUploadedFile($validated['p12']);
        if ($p12Binary === '') {
            return response()->json(['message' => 'El archivo P12/PFX esta vacio.'], 422);
        }

        $extracted = $this->certificateInspector->extractFromP12($p12Binary, $validated['password']);
        $metadata = $extracted['metadata'] ?? [];
        $ambiente = AmbienteArca::fromMixed($certificado->ambiente?->value ?? $certificado->ambiente);
        $activo = array_key_exists('activo', $validated) ? (bool) $validated['activo'] : false;

        $certificado = DB::transaction(function () use ($certificado, $ambiente, $activo, $extracted, $metadata, $p12Binary, $validated) {
            if ($activo) {
                ArcaCertificado::query()
                    ->where('emisor_id', $certificado->emisor_id)
                    ->where('ambiente', $ambiente->value)
                    ->update(['activo' => false, 'estado' => 'INACTIVO']);
            }

            $certPath = $this->certificateStorage->storeCertificatePem($certificado->emisor_id, $certificado->alias, $ambiente, $extracted['cert_pem']);
            $keyPath = $this->certificateStorage->storeEncryptedPrivateKey($certificado->emisor_id, $certificado->alias, $ambiente, $extracted['private_key_pem']);
            $p12Path = $this->certificateStorage->storeEncryptedP12($certificado->emisor_id, $certificado->alias, $ambiente, $p12Binary);
            $passwordRef = $this->certificateStorage->encryptPasswordReference($validated['password']);

            $certificado->fill([
                'subject_dn' => $metadata['subject_dn'] ?? null,
                'serial_number_subject' => $metadata['serial_number_subject'] ?? null,
                'thumbprint_sha1' => $metadata['thumbprint_sha1'] ?? null,
                'thumbprint_sha256' => $metadata['thumbprint_sha256'] ?? null,
                'certificado_pem_path' => $certPath,
                'certificate_crt_path' => $certPath,
                'private_key_path_encrypted' => $keyPath,
                'p12_path_encrypted' => $p12Path,
                'password_ref' => $passwordRef,
                'p12_password_ref' => $passwordRef,
                'valid_from' => $this->parseDateTime($metadata['valid_from'] ?? null),
                'valid_to' => $this->parseDateTime($metadata['valid_to'] ?? null),
                'activo' => $activo,
                'estado' => $activo ? 'ACTIVO' : 'CRT_IMPORTADO',
            ]);
            $certificado->save();

            return $certificado;
        });

        $this->auditService->record(
            'arca_certificado',
            $certificado->id,
            'certificado.importado.p12',
            null,
            $certificado->toArray(),
            $request->user()?->id,
            $request->ip()
        );

        return response()->json([
            'message' => 'Certificado importado correctamente.',
            'data' => $this->serializeCertificado($certificado->fresh()),
        ]);
    }

    private function importCrtOnCert(Request $request, ArcaCertificado $certificado): JsonResponse
    {
        $validated = $request->validate([
            'crt' => ['required', 'file'],
            'key' => ['nullable', 'file'],
            'password' => ['nullable', 'string'],
            'activo' => ['sometimes', 'boolean'],
        ]);

        $certPem = $this->readUploadedFile($validated['crt']);
        if ($certPem === '') {
            return response()->json(['message' => 'El CRT esta vacio.'], 422);
        }

        $keyPem = null;
        if ($request->hasFile('key')) {
            $keyPem = $this->readUploadedFile($validated['key']);
            if ($keyPem === '') {
                return response()->json(['message' => 'La KEY esta vacia.'], 422);
            }
        }

        if ($keyPem === null) {
            try {
                $keyPem = $this->certificateStorage->readPrivateKeyPem($certificado);
            } catch (RuntimeException) {
                return response()->json(['message' => 'No hay clave privada asociada en el servidor para este certificado.'], 422);
            }
        }

        if (! $this->certificateKeyMatches($certPem, $keyPem)) {
            return response()->json(['message' => 'El certificado no coincide con la clave privada proporcionada.'], 422);
        }

        $metadata = $this->certificateInspector->inspectPem($certPem);
        $ambiente = AmbienteArca::fromMixed($certificado->ambiente?->value ?? $certificado->ambiente);
        $activo = array_key_exists('activo', $validated) ? (bool) $validated['activo'] : false;

        $certificado = DB::transaction(function () use ($certificado, $certPem, $keyPem, $metadata, $ambiente, $activo, $validated) {
            if ($activo) {
                ArcaCertificado::query()
                    ->where('emisor_id', $certificado->emisor_id)
                    ->where('ambiente', $ambiente->value)
                    ->update(['activo' => false, 'estado' => 'INACTIVO']);
            }

            $certPath = $this->certificateStorage->storeCertificatePem($certificado->emisor_id, $certificado->alias, $ambiente, $certPem);
            $keyPath = $this->certificateStorage->storeEncryptedPrivateKey($certificado->emisor_id, $certificado->alias, $ambiente, $keyPem);
            $passwordRef = $this->certificateStorage->encryptPasswordReference($validated['password'] ?? null);

            $certificado->fill([
                'subject_dn' => $metadata['subject_dn'] ?? null,
                'serial_number_subject' => $metadata['serial_number_subject'] ?? null,
                'thumbprint_sha1' => $metadata['thumbprint_sha1'] ?? null,
                'thumbprint_sha256' => $metadata['thumbprint_sha256'] ?? null,
                'certificado_pem_path' => $certPath,
                'certificate_crt_path' => $certPath,
                'private_key_path_encrypted' => $keyPath,
                'p12_path_encrypted' => null,
                'password_ref' => $passwordRef,
                'p12_password_ref' => $passwordRef,
                'valid_from' => $this->parseDateTime($metadata['valid_from'] ?? null),
                'valid_to' => $this->parseDateTime($metadata['valid_to'] ?? null),
                'activo' => $activo,
                'estado' => $activo ? 'ACTIVO' : 'CRT_IMPORTADO',
            ]);
            $certificado->save();

            return $certificado;
        });

        $this->auditService->record(
            'arca_certificado',
            $certificado->id,
            'certificado.importado.crt_key',
            null,
            $certificado->toArray(),
            $request->user()?->id,
            $request->ip()
        );

        return response()->json([
            'message' => 'Certificado importado correctamente.',
            'data' => $this->serializeCertificado($certificado->fresh()),
        ]);
    }

    public function importP12(Request $request, ArcaEmisor $emisor): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para importar certificados.'], 403);
        }

        $validated = $request->validate([
            'alias' => ['required', 'string', 'max:120'],
            'ambiente' => ['required', Rule::in(['HOMO', 'PROD'])],
            'p12' => ['required', 'file'],
            'password' => ['required', 'string'],
            'activo' => ['sometimes', 'boolean'],
        ]);

        $p12Binary = $this->readUploadedFile($validated['p12']);
        if ($p12Binary === '') {
            return response()->json(['message' => 'El archivo P12/PFX esta vacio.'], 422);
        }

        $extracted = $this->certificateInspector->extractFromP12($p12Binary, $validated['password']);
        $metadata = $extracted['metadata'] ?? [];
        $ambiente = AmbienteArca::fromMixed($validated['ambiente']);
        $activo = array_key_exists('activo', $validated) ? (bool) $validated['activo'] : true;

        $certificado = DB::transaction(function () use ($emisor, $validated, $ambiente, $activo, $extracted, $metadata, $p12Binary) {
            if ($activo) {
                ArcaCertificado::query()
                    ->where('emisor_id', $emisor->id)
                    ->where('ambiente', $ambiente->value)
                    ->update(['activo' => false]);
            }

            $certPath = $this->certificateStorage->storeCertificatePem($emisor->id, $validated['alias'], $ambiente, $extracted['cert_pem']);
            $keyPath = $this->certificateStorage->storeEncryptedPrivateKey($emisor->id, $validated['alias'], $ambiente, $extracted['private_key_pem']);
            $p12Path = $this->certificateStorage->storeEncryptedP12($emisor->id, $validated['alias'], $ambiente, $p12Binary);
            $passwordRef = $this->certificateStorage->encryptPasswordReference($validated['password']);

            $alias = trim($validated['alias']);
            $existing = ArcaCertificado::query()
                ->where('emisor_id', $emisor->id)
                ->where('alias', $alias)
                ->where('ambiente', $ambiente->value)
                ->first();

            if ($existing) {
                $existing->fill([
                    'subject_dn' => $metadata['subject_dn'] ?? null,
                    'serial_number_subject' => $metadata['serial_number_subject'] ?? null,
                    'thumbprint_sha1' => $metadata['thumbprint_sha1'] ?? null,
                    'thumbprint_sha256' => $metadata['thumbprint_sha256'] ?? null,
                    'certificado_pem_path' => $certPath,
                    'certificate_crt_path' => $certPath,
                    'private_key_path_encrypted' => $keyPath,
                    'p12_path_encrypted' => $p12Path,
                    'password_ref' => $passwordRef,
                    'p12_password_ref' => $passwordRef,
                    'valid_from' => $this->parseDateTime($metadata['valid_from'] ?? null),
                    'valid_to' => $this->parseDateTime($metadata['valid_to'] ?? null),
                    'activo' => $activo,
                    'estado' => $activo ? 'ACTIVO' : 'CRT_IMPORTADO',
                ]);
                $existing->save();
                return $existing;
            }

            return ArcaCertificado::query()->create([
                'emisor_id' => $emisor->id,
                'alias' => $alias,
                'ambiente' => $ambiente->value,
                'subject_dn' => $metadata['subject_dn'] ?? null,
                'serial_number_subject' => $metadata['serial_number_subject'] ?? null,
                'thumbprint_sha1' => $metadata['thumbprint_sha1'] ?? null,
                'thumbprint_sha256' => $metadata['thumbprint_sha256'] ?? null,
                'certificado_pem_path' => $certPath,
                'certificate_crt_path' => $certPath,
                'private_key_path_encrypted' => $keyPath,
                'p12_path_encrypted' => $p12Path,
                'password_ref' => $passwordRef,
                'p12_password_ref' => $passwordRef,
                'valid_from' => $this->parseDateTime($metadata['valid_from'] ?? null),
                'valid_to' => $this->parseDateTime($metadata['valid_to'] ?? null),
                'activo' => $activo,
                'estado' => $activo ? 'ACTIVO' : 'CRT_IMPORTADO',
            ]);
        });

        $this->auditService->record(
            'arca_certificado',
            $certificado->id,
            $certificado->wasRecentlyCreated ? 'certificado.importado.p12' : 'certificado.reemplazado.p12',
            null,
            $certificado->toArray(),
            $request->user()?->id,
            $request->ip()
        );

        return response()->json([
            'message' => 'Certificado importado correctamente.',
            'data' => $this->serializeCertificado($certificado->fresh()),
        ]);
    }

    public function testWsaa(Request $request, ArcaEmisor $emisor): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para acceder a facturacion.'], 403);
        }

        $validated = $request->validate([
            'ambiente' => ['nullable', Rule::in(['HOMO', 'PROD'])],
            'certificado_id' => ['nullable', 'integer'],
        ]);

        $ambiente = AmbienteArca::fromMixed($validated['ambiente'] ?? $emisor->ambiente_default?->value ?? 'PROD');
        $certificado = null;

        if (! empty($validated['certificado_id'])) {
            $certificado = ArcaCertificado::query()
                ->where('emisor_id', $emisor->id)
                ->where('id', (int) $validated['certificado_id'])
                ->first();
        } else {
            $certificado = $this->certificadoRepository->findActiveForEmisor($emisor->id, $ambiente);
        }

        if (! $certificado) {
            return response()->json(['message' => 'No hay certificado activo para el emisor y ambiente seleccionados.'], 422);
        }

        try {
            $token = $this->taCacheService->getValidTa($certificado);
        } catch (Throwable $exception) {
            return response()->json([
                'message' => 'WSAA no respondio correctamente.',
                'error' => $exception->getMessage(),
            ], 502);
        }

        $certificado->refresh();
        $this->auditService->record(
            'arca_certificado',
            $certificado->id,
            'certificado.test_wsaa',
            null,
            ['token_expiration' => $token->expirationTime->toIso8601String()],
            $request->user()?->id,
            $request->ip()
        );

        return response()->json([
            'message' => 'WSAA OK.',
            'data' => [
                'certificado' => $this->serializeCertificado($certificado),
                'generation_time' => $token->generationTime->toIso8601String(),
                'expiration_time' => $token->expirationTime->toIso8601String(),
            ],
        ]);
    }

    public function activate(Request $request, ArcaCertificado $certificado): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para gestionar certificados.'], 403);
        }

        DB::transaction(function () use ($certificado) {
            ArcaCertificado::query()
                ->where('emisor_id', $certificado->emisor_id)
                ->where('ambiente', $certificado->ambiente?->value ?? (string) $certificado->ambiente)
                ->update(['activo' => false, 'estado' => 'INACTIVO']);

            $certificado->forceFill(['activo' => true, 'estado' => 'ACTIVO'])->save();
        });

        $this->auditService->record(
            'arca_certificado',
            $certificado->id,
            'certificado.activado',
            null,
            ['activo' => true],
            $request->user()?->id,
            $request->ip()
        );

        return response()->json([
            'message' => 'Certificado activado.',
            'data' => $this->serializeCertificado($certificado->fresh()),
        ]);
    }

    public function deactivate(Request $request, ArcaCertificado $certificado): JsonResponse
    {
        if (! $this->canAccessFacturacion($request->user())) {
            return response()->json(['message' => 'No tenes permisos para gestionar certificados.'], 403);
        }

        $certificado->forceFill(['activo' => false, 'estado' => 'INACTIVO'])->save();

        $this->auditService->record(
            'arca_certificado',
            $certificado->id,
            'certificado.desactivado',
            null,
            ['activo' => false],
            $request->user()?->id,
            $request->ip()
        );

        return response()->json([
            'message' => 'Certificado desactivado.',
            'data' => $this->serializeCertificado($certificado->fresh()),
        ]);
    }

    private function readUploadedFile(UploadedFile $file): string
    {
        $path = $file->getRealPath();
        if ($path === false) {
            throw new RuntimeException('No se pudo leer el archivo subido.');
        }

        return (string) file_get_contents($path);
    }

    private function certificateKeyMatches(string $certPem, string $keyPem): bool
    {
        $cert = openssl_x509_read($certPem);
        if ($cert === false) {
            return false;
        }

        $key = openssl_pkey_get_private($keyPem);
        if ($key === false) {
            return false;
        }

        return (bool) openssl_x509_check_private_key($cert, $key);
    }

    private function parseDateTime(mixed $value): ?Carbon
    {
        $normalized = trim((string) $value);
        if ($normalized === '') {
            return null;
        }

        try {
            return Carbon::parse($normalized);
        } catch (Throwable) {
            return null;
        }
    }

    private function serializeCertificado(ArcaCertificado $certificado): array
    {
        return [
            'id' => $certificado->id,
            'emisor_id' => $certificado->emisor_id,
            'alias' => $certificado->alias,
            'ambiente' => $certificado->ambiente?->value ?? $certificado->ambiente,
            'subject_dn' => $certificado->subject_dn,
            'serial_number_subject' => $certificado->serial_number_subject,
            'thumbprint_sha1' => $certificado->thumbprint_sha1,
            'thumbprint_sha256' => $certificado->thumbprint_sha256,
            'valid_from' => optional($certificado->valid_from)?->toIso8601String(),
            'valid_to' => optional($certificado->valid_to)?->toIso8601String(),
            'activo' => (bool) $certificado->activo,
            'estado' => $certificado->estado,
            'ultimo_login_wsaa_ok_at' => optional($certificado->ultimo_login_wsaa_ok_at)?->toIso8601String(),
            'has_private_key' => $certificado->private_key_path_encrypted ? true : false,
            'has_p12' => $certificado->p12_path_encrypted ? true : false,
            'has_csr' => $certificado->csr_pem || $certificado->csr_path ? true : false,
        ];
    }

    private function canAccessFacturacion($user): bool
    {
        if (! $user) {
            return false;
        }

        $role = strtolower(trim((string) ($user->role ?? '')));
        if ($role !== '' && (str_contains($role, 'admin') || $role === 'encargado')) {
            return true;
        }

        $permissions = $user->permissions ?? null;
        if (! is_array($permissions)) {
            return false;
        }

        return in_array('facturacion', $permissions, true)
            || in_array('liquidaciones', $permissions, true)
            || in_array('pagos', $permissions, true);
    }
}

<?php

namespace App\Services\Arca;

use App\Models\ArcaCertificado;
use App\Support\Facturacion\AmbienteArca;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class ArcaCertificateStorage
{
    public function storeCertificatePem(int $emisorId, string $alias, AmbienteArca|string $ambiente, string $pem): string
    {
        $path = $this->buildRelativePath($emisorId, $alias, $ambiente, 'certificado.pem');
        Storage::disk($this->disk())->put($path, trim($pem) . PHP_EOL);

        return $path;
    }

    public function storeCsrPem(int $emisorId, string $alias, AmbienteArca|string $ambiente, string $pem): string
    {
        $path = $this->buildRelativePath($emisorId, $alias, $ambiente, 'solicitud.csr');
        Storage::disk($this->disk())->put($path, trim($pem) . PHP_EOL);

        return $path;
    }

    public function storeEncryptedPrivateKey(int $emisorId, string $alias, AmbienteArca|string $ambiente, string $privateKeyPem): string
    {
        $path = $this->buildRelativePath($emisorId, $alias, $ambiente, 'private-key.enc');
        Storage::disk($this->disk())->put($path, Crypt::encryptString(base64_encode($privateKeyPem)));

        return Crypt::encryptString($path);
    }

    public function storeEncryptedP12(int $emisorId, string $alias, AmbienteArca|string $ambiente, string $p12Binary): string
    {
        $path = $this->buildRelativePath($emisorId, $alias, $ambiente, 'certificado.p12.enc');
        Storage::disk($this->disk())->put($path, Crypt::encryptString(base64_encode($p12Binary)));

        return Crypt::encryptString($path);
    }

    public function encryptPasswordReference(?string $password): ?string
    {
        $normalized = trim((string) $password);

        return $normalized === '' ? null : Crypt::encryptString($normalized);
    }

    public function decryptPasswordReference(?string $passwordRef): ?string
    {
        $normalized = trim((string) $passwordRef);
        if ($normalized === '') {
            return null;
        }

        try {
            return Crypt::decryptString($normalized);
        } catch (DecryptException $exception) {
            throw new RuntimeException('No se pudo descifrar la referencia de password del certificado.', 0, $exception);
        }
    }

    public function readCertificatePem(ArcaCertificado $certificado): string
    {
        $path = trim((string) $certificado->certificado_pem_path);
        if ($path === '' || ! Storage::disk($this->disk())->exists($path)) {
            throw new RuntimeException('El certificado PEM no está disponible en storage.');
        }

        return (string) Storage::disk($this->disk())->get($path);
    }

    public function readCsrPem(ArcaCertificado $certificado): string
    {
        $path = trim((string) $certificado->csr_path);
        if ($path === '' || ! Storage::disk($this->disk())->exists($path)) {
            throw new RuntimeException('El CSR no está disponible en storage.');
        }

        return (string) Storage::disk($this->disk())->get($path);
    }

    public function readPrivateKeyPem(ArcaCertificado $certificado): string
    {
        return $this->readEncryptedFileContents($certificado->private_key_path_encrypted);
    }

    public function readP12Binary(ArcaCertificado $certificado): string
    {
        return $this->readEncryptedFileContents($certificado->p12_path_encrypted);
    }

    private function readEncryptedFileContents(?string $encryptedPath): string
    {
        $path = $this->decryptPath($encryptedPath);
        if ($path === '' || ! Storage::disk($this->disk())->exists($path)) {
            throw new RuntimeException('El material criptográfico no está disponible en storage.');
        }

        $encryptedPayload = (string) Storage::disk($this->disk())->get($path);

        try {
            return base64_decode(Crypt::decryptString($encryptedPayload), true) ?: '';
        } catch (DecryptException $exception) {
            throw new RuntimeException('No se pudo descifrar el contenido del material criptográfico.', 0, $exception);
        }
    }

    private function decryptPath(?string $encryptedPath): string
    {
        $normalized = trim((string) $encryptedPath);
        if ($normalized === '') {
            return '';
        }

        try {
            return Crypt::decryptString($normalized);
        } catch (DecryptException $exception) {
            throw new RuntimeException('No se pudo descifrar la ruta del material criptográfico.', 0, $exception);
        }
    }

    private function buildRelativePath(int $emisorId, string $alias, AmbienteArca|string $ambiente, string $filename): string
    {
        $target = $ambiente instanceof AmbienteArca ? $ambiente : AmbienteArca::fromMixed((string) $ambiente);
        $slug = trim(preg_replace('/[^a-z0-9\-]+/i', '-', strtolower($alias)), '-');

        return sprintf('arca/certificados/emisor-%d/%s/%s/%s', $emisorId, strtolower($target->value), $slug, $filename);
    }

    private function disk(): string
    {
        return (string) config('services.arca.storage_disk', 'local');
    }
}

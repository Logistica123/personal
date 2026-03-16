<?php

namespace App\Services\Arca;

use RuntimeException;

class ArcaCertificateInspector
{
    /**
     * @return array{
     *   cert_pem:string,
     *   private_key_pem:string,
     *   metadata:array<string,mixed>
     * }
     */
    public function extractFromP12(string $p12Binary, string $password): array
    {
        $certificates = [];
        if (! openssl_pkcs12_read($p12Binary, $certificates, $password)) {
            throw new RuntimeException('No se pudo leer el archivo P12/PFX. Verificá el password.');
        }

        $certPem = (string) ($certificates['cert'] ?? '');
        $privateKeyPem = (string) ($certificates['pkey'] ?? '');
        if ($certPem === '' || $privateKeyPem === '') {
            throw new RuntimeException('El archivo P12/PFX no contiene certificado y clave privada utilizables.');
        }

        return [
            'cert_pem' => $certPem,
            'private_key_pem' => $privateKeyPem,
            'metadata' => $this->inspectPem($certPem),
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function inspectPem(string $certPem): array
    {
        $certificate = openssl_x509_read($certPem);
        if ($certificate === false) {
            throw new RuntimeException('No se pudo leer el certificado PEM.');
        }

        $parsed = openssl_x509_parse($certificate);
        if ($parsed === false) {
            throw new RuntimeException('No se pudo parsear el certificado PEM.');
        }

        $subject = is_array($parsed['subject'] ?? null) ? $parsed['subject'] : [];
        $subjectDn = $this->buildSubjectDn($subject);

        return [
            'subject_dn' => $subjectDn,
            'serial_number_subject' => (string) ($subject['serialNumber'] ?? $parsed['serialNumberHex'] ?? ''),
            'thumbprint_sha1' => openssl_x509_fingerprint($certificate, 'sha1') ?: null,
            'thumbprint_sha256' => openssl_x509_fingerprint($certificate, 'sha256') ?: null,
            'valid_from' => isset($parsed['validFrom_time_t']) ? date('c', (int) $parsed['validFrom_time_t']) : null,
            'valid_to' => isset($parsed['validTo_time_t']) ? date('c', (int) $parsed['validTo_time_t']) : null,
            'subject' => $subject,
            'issuer' => $parsed['issuer'] ?? [],
        ];
    }

    /**
     * @param array<string,mixed> $subject
     */
    private function buildSubjectDn(array $subject): string
    {
        $parts = [];
        foreach ($subject as $key => $value) {
            if (is_array($value)) {
                $value = implode(',', array_map('strval', $value));
            }

            $stringValue = trim((string) $value);
            if ($stringValue === '') {
                continue;
            }

            $parts[] = sprintf('%s=%s', $key, $stringValue);
        }

        return implode(', ', $parts);
    }
}

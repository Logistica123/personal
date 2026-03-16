<?php

namespace App\Services\Arca;

use RuntimeException;

class ArcaCsrService
{
    /**
     * @param array{country:string,organization:string,common_name:string,serial_number:string} $subject
     * @return array{csr_pem:string,private_key_pem:string,subject_dn:string}
     */
    public function generate(array $subject): array
    {
        $privateKey = openssl_pkey_new([
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
            'private_key_bits' => 2048,
        ]);

        if ($privateKey === false) {
            throw new RuntimeException('No se pudo generar la clave privada RSA 2048.');
        }

        $distinguishedName = [
            'C' => $subject['country'],
            'O' => $subject['organization'],
            'CN' => $subject['common_name'],
            'serialNumber' => $subject['serial_number'],
        ];

        $csr = openssl_csr_new($distinguishedName, $privateKey, ['digest_alg' => 'sha256']);
        if ($csr === false) {
            throw new RuntimeException('No se pudo generar el CSR.');
        }

        $csrPem = '';
        if (! openssl_csr_export($csr, $csrPem)) {
            throw new RuntimeException('No se pudo exportar el CSR.');
        }

        $privateKeyPem = '';
        if (! openssl_pkey_export($privateKey, $privateKeyPem)) {
            throw new RuntimeException('No se pudo exportar la clave privada.');
        }

        $subjectDn = sprintf(
            'C=%s, O=%s, CN=%s, serialNumber=%s',
            $distinguishedName['C'],
            $distinguishedName['O'],
            $distinguishedName['CN'],
            $distinguishedName['serialNumber']
        );

        return [
            'csr_pem' => $csrPem,
            'private_key_pem' => $privateKeyPem,
            'subject_dn' => $subjectDn,
        ];
    }
}

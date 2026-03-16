<?php

namespace App\Services\Arca\Wsaa;

use App\Services\Arca\Exceptions\WsaaException;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;

class CmsSigner
{
    public function sign(string $traXml, string $certificatePem, string $privateKeyPem, ?string $privateKeyPassphrase = null): string
    {
        $tmpDir = (string) config('services.arca.tmp_dir', storage_path('app/private/tmp'));
        File::ensureDirectoryExists($tmpDir);

        $prefix = uniqid('arca-wsaa-', true);
        $traPath = $tmpDir . DIRECTORY_SEPARATOR . $prefix . '.xml';
        $certPath = $tmpDir . DIRECTORY_SEPARATOR . $prefix . '.crt';
        $keyPath = $tmpDir . DIRECTORY_SEPARATOR . $prefix . '.key';
        $cmsPath = $tmpDir . DIRECTORY_SEPARATOR . $prefix . '.cms';

        File::put($traPath, $traXml);
        File::put($certPath, $certificatePem);
        File::put($keyPath, $privateKeyPem);

        $command = [
            'openssl',
            'cms',
            '-sign',
            '-binary',
            '-in',
            $traPath,
            '-signer',
            $certPath,
            '-inkey',
            $keyPath,
            '-outform',
            'DER',
            '-nodetach',
            '-nosmimecap',
            '-out',
            $cmsPath,
        ];

        if ($privateKeyPassphrase !== null && $privateKeyPassphrase !== '') {
            $command[] = '-passin';
            $command[] = 'pass:' . $privateKeyPassphrase;
        }

        try {
            $result = Process::timeout(20)->run($command);
            if (! $result->successful()) {
                throw new WsaaException('No se pudo firmar el TRA con OpenSSL: ' . trim($result->errorOutput() ?: $result->output()));
            }

            if (! File::exists($cmsPath)) {
                throw new WsaaException('OpenSSL no generó el archivo CMS esperado.');
            }

            return base64_encode((string) File::get($cmsPath));
        } finally {
            foreach ([$traPath, $certPath, $keyPath, $cmsPath] as $path) {
                if (File::exists($path)) {
                    @File::delete($path);
                }
            }
        }
    }
}
